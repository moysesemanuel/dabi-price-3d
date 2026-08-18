import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  createMercadoPagoSubscriptionCheckout,
  getMercadoPagoAccessToken,
  getMercadoPagoSubscriptionWithToken,
  isMercadoPagoApiError,
  normalizeMercadoPagoSubscriptionStatus,
  resolveMercadoPagoCheckoutAction,
  resolvePendingSubscriptionRecovery,
} from "@/lib/payments/mercado-pago";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import {
  workspacePlans,
  type WorkspacePlanId,
} from "@/lib/settings/app-preferences";
import {
  applyWorkspaceSubscriptionUpdate,
  claimWorkspaceSubscriptionCheckout,
  getWorkspacePreferences,
  releaseWorkspaceSubscriptionCheckout,
  type AuthenticatedWorkspaceSession,
} from "@/lib/server/platform";

type CheckoutSubscriptionPayload = {
  planId?: string;
};

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/payments/mercado-pago/subscriptions/checkout",
  );

  let session: AuthenticatedWorkspaceSession;

  try {
    session = await requireCurrentAuthSession();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para contratar um plano.",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    throw error;
  }

  if (!canManageWorkspaceBilling(session)) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Apenas o proprietário do workspace pode alterar a assinatura.",
        code: "BILLING_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  let body: CheckoutSubscriptionPayload;

  try {
    body = (await request.json()) as CheckoutSubscriptionPayload;
  } catch {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Payload inválido.",
        code: "SUBSCRIPTION_CHECKOUT_INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const planId = normalizePlanId(body.planId);

  if (!planId) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Informe um plano válido.",
        code: "SUBSCRIPTION_CHECKOUT_INVALID_PLAN",
      },
      { status: 400 },
    );
  }

  const selectedPlan = workspacePlans.find((plan) => plan.id === planId);

  if (!selectedPlan) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Plano não encontrado.",
        code: "SUBSCRIPTION_CHECKOUT_PLAN_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  if (planId === "scale") {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "O plano DaBi Equipe possui contratação consultiva e não pode ser assinado diretamente pelo checkout.",
        code: "SUBSCRIPTION_CHECKOUT_CONSULTATIVE_PLAN",
      },
      { status: 409 },
    );
  }

  const currentPreferences = await getWorkspacePreferences(session.workspace.id);
  const currentSubscription = currentPreferences.subscription;
  const checkoutAction = resolveMercadoPagoCheckoutAction({
    subscriptionStatus: currentSubscription.status,
    mercadoPagoSubscriptionId: currentSubscription.mercadoPagoSubscriptionId,
  });

  if (checkoutAction === "block_active_subscription") {
    return buildActiveSubscriptionConflict(requestContext);
  }

  if (checkoutAction === "block_paused_subscription") {
    return buildPausedSubscriptionConflict(requestContext);
  }

  const accessToken = getMercadoPagoAccessToken();

  if (!accessToken) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "A integração de pagamentos ainda não está configurada neste ambiente.",
        code: "MERCADO_PAGO_ACCESS_TOKEN_MISSING",
      },
      { status: 503 },
    );
  }

  if (
    checkoutAction === "resume_pending_checkout" &&
    currentSubscription.mercadoPagoSubscriptionId
  ) {
    const recoveryResponse = await recoverPendingCheckout({
      requestContext,
      session,
      currentSubscription,
      selectedPlanId: planId,
      accessToken,
    });

    if (recoveryResponse) {
      return recoveryResponse;
    }
  }

  const checkoutClaim = await claimWorkspaceSubscriptionCheckout({
    workspaceId: session.workspace.id,
    startedAt: new Date().toISOString(),
  });

  if (!checkoutClaim.claimed) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "Já existe uma tentativa de contratação em andamento para este workspace.",
        code: "SUBSCRIPTION_CHECKOUT_ALREADY_IN_PROGRESS",
      },
      { status: 409 },
    );
  }

  const appBaseUrl = new URL(request.url).origin;
  const backUrl = new URL("/app/planos", appBaseUrl);

  backUrl.searchParams.set("origin", "mercado-pago");
  backUrl.searchParams.set("plan", planId);

  logRouteEvent(
    requestContext,
    "info",
    "mercado_pago_checkout.create_started",
    {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      status: currentSubscription.status,
    },
  );

  try {
    const subscription = await createMercadoPagoSubscriptionCheckout({
      planId,
      payerEmail: session.user.email,
      workspaceId: session.workspace.id,
      reason: `${selectedPlan.label} - ${session.workspace.name}`,
      backUrl: backUrl.toString(),
    });

    if (!subscription.init_point) {
      await releaseWorkspaceSubscriptionCheckout({
        workspaceId: session.workspace.id,
      });

      return jsonWithRequestId(
        requestContext,
        {
          error:
            "O Mercado Pago criou a assinatura, mas não retornou a URL de checkout.",
          code: "SUBSCRIPTION_CHECKOUT_MISSING_INIT_POINT",
        },
        { status: 502 },
      );
    }

    await applyWorkspaceSubscriptionUpdate({
      workspaceId: session.workspace.id,
      planId,
      status: "pending",
      source: "mercado-pago-checkout",
      mercadoPagoSubscriptionId: subscription.id,
      description: `Checkout da assinatura ${selectedPlan.label} criado no Mercado Pago e aguardando confirmação.`,
    });

    logRouteEvent(
      requestContext,
      "info",
      "mercado_pago_checkout.create_succeeded",
      {
        workspaceId: session.workspace.id,
        userId: session.user.id,
        planId,
        subscriptionId: subscription.id,
        status: "pending",
      },
    );

    return jsonWithRequestId(requestContext, {
      ok: true,
      planId,
      subscriptionId: subscription.id,
      initPoint: subscription.init_point,
    });
  } catch (error) {
    await releaseWorkspaceSubscriptionCheckout({
      workspaceId: session.workspace.id,
    });

    logRouteEvent(
      requestContext,
      "error",
      "mercado_pago_checkout.create_failed",
      {
        workspaceId: session.workspace.id,
        userId: session.user.id,
        planId,
        status: currentSubscription.status,
        error: serializeError(error),
      },
    );

    return jsonWithRequestId(
      requestContext,
      {
        error: "Não foi possível iniciar a assinatura no Mercado Pago.",
        code: "SUBSCRIPTION_CHECKOUT_CREATE_FAILED",
      },
      { status: 502 },
    );
  }
}

async function recoverPendingCheckout(input: {
  requestContext: ReturnType<typeof createRouteRequestContext>;
  session: AuthenticatedWorkspaceSession;
  currentSubscription: Awaited<ReturnType<typeof getWorkspacePreferences>>["subscription"];
  selectedPlanId: WorkspacePlanId;
  accessToken: string;
}) {
  const subscriptionId = input.currentSubscription.mercadoPagoSubscriptionId;

  if (!subscriptionId) {
    return null;
  }

  logRouteEvent(
    input.requestContext,
    "info",
    "mercado_pago_checkout.resume_started",
    {
      workspaceId: input.session.workspace.id,
      userId: input.session.user.id,
      planId: input.currentSubscription.planId,
      selectedPlanId: input.selectedPlanId,
      subscriptionId,
    },
  );

  try {
    const remoteSubscription = await getMercadoPagoSubscriptionWithToken(
      subscriptionId,
      input.accessToken,
    );
    const recovery = resolvePendingSubscriptionRecovery({
      remoteStatus: normalizeMercadoPagoSubscriptionStatus(
        remoteSubscription.status,
      ),
      initPoint: remoteSubscription.init_point,
    });

    if (recovery.type === "resume_checkout") {
      logRouteEvent(
        input.requestContext,
        "info",
        "mercado_pago_checkout.resume_succeeded",
        {
          workspaceId: input.session.workspace.id,
          userId: input.session.user.id,
          planId: input.currentSubscription.planId,
          selectedPlanId: input.selectedPlanId,
          subscriptionId,
        },
      );

      return jsonWithRequestId(input.requestContext, {
        ok: true,
        resumed: true,
        planId: input.currentSubscription.planId,
        subscriptionId,
        initPoint: recovery.initPoint,
      });
    }

    if (recovery.type === "missing_init_point") {
      logRouteEvent(
        input.requestContext,
        "error",
        "mercado_pago_checkout.resume_missing_init_point",
        {
          workspaceId: input.session.workspace.id,
          userId: input.session.user.id,
          planId: input.currentSubscription.planId,
          selectedPlanId: input.selectedPlanId,
          subscriptionId,
          remoteStatus: recovery.remoteStatus,
        },
      );

      return jsonWithRequestId(
        input.requestContext,
        {
          error:
            "Não foi possível recuperar o checkout pendente. Tente novamente em instantes.",
          code: "SUBSCRIPTION_PENDING_WITHOUT_CHECKOUT_URL",
        },
        { status: 502 },
      );
    }

    if (recovery.type === "sync_local_status") {
      await applyWorkspaceSubscriptionUpdate({
        workspaceId: input.session.workspace.id,
        planId: input.currentSubscription.planId,
        status: recovery.nextStatus,
        source: "mercado-pago-checkout-recovery",
        mercadoPagoSubscriptionId: subscriptionId,
        description: `Checkout pendente reconciliado com status remoto ${recovery.remoteStatus}.`,
      });

      return recovery.nextStatus === "active"
        ? buildActiveSubscriptionConflict(input.requestContext, { refresh: true })
        : buildPausedSubscriptionConflict(input.requestContext, { refresh: true });
    }

    if (recovery.type === "allow_new_checkout") {
      await applyWorkspaceSubscriptionUpdate({
        workspaceId: input.session.workspace.id,
        planId: input.currentSubscription.planId,
        status: recovery.nextStatus,
        source: "mercado-pago-checkout-recovery",
        mercadoPagoSubscriptionId: recovery.clearSubscriptionId
          ? null
          : subscriptionId,
        description:
          recovery.remoteStatus === "not_found"
            ? "Assinatura pendente não encontrada no Mercado Pago. O workspace voltou para contratação disponível."
            : "Assinatura pendente encerrada no Mercado Pago. Uma nova tentativa de contratação pode ser iniciada.",
      });

      if (recovery.remoteStatus === "not_found") {
        logRouteEvent(
          input.requestContext,
          "warn",
          "mercado_pago_checkout.resume_remote_not_found",
          {
            workspaceId: input.session.workspace.id,
            userId: input.session.user.id,
            planId: input.currentSubscription.planId,
            selectedPlanId: input.selectedPlanId,
            subscriptionId,
          },
        );
      }

      return null;
    }

    logRouteEvent(
      input.requestContext,
      "error",
      "mercado_pago_checkout.resume_failed",
      {
        workspaceId: input.session.workspace.id,
        userId: input.session.user.id,
        planId: input.currentSubscription.planId,
        selectedPlanId: input.selectedPlanId,
        subscriptionId,
        remoteStatus: recovery.remoteStatus,
      },
    );

    return jsonWithRequestId(
      input.requestContext,
      {
        error:
          "Não foi possível recuperar o checkout pendente. Tente novamente em instantes.",
        code: "SUBSCRIPTION_PENDING_UNRECOVERABLE",
      },
      { status: 409 },
    );
  } catch (error) {
    if (isMercadoPagoApiError(error) && error.status === 404) {
      await applyWorkspaceSubscriptionUpdate({
        workspaceId: input.session.workspace.id,
        planId: input.currentSubscription.planId,
        status: "unpaid",
        source: "mercado-pago-checkout-recovery",
        mercadoPagoSubscriptionId: null,
        description:
          "Assinatura pendente não encontrada no Mercado Pago. O workspace voltou para contratação disponível.",
      });

      logRouteEvent(
        input.requestContext,
        "warn",
        "mercado_pago_checkout.resume_remote_not_found",
        {
          workspaceId: input.session.workspace.id,
          userId: input.session.user.id,
          planId: input.currentSubscription.planId,
          selectedPlanId: input.selectedPlanId,
          subscriptionId,
          mercadoPagoStatus: error.status,
        },
      );

      return null;
    }

    logRouteEvent(
      input.requestContext,
      "error",
      "mercado_pago_checkout.resume_failed",
      {
        workspaceId: input.session.workspace.id,
        userId: input.session.user.id,
        planId: input.currentSubscription.planId,
        selectedPlanId: input.selectedPlanId,
        subscriptionId,
        error: serializeError(error),
      },
    );

    return jsonWithRequestId(
      input.requestContext,
      {
        error:
          "Não foi possível recuperar o checkout pendente. Tente novamente em instantes.",
        code: "SUBSCRIPTION_PENDING_RESUME_FAILED",
      },
      { status: 502 },
    );
  }
}

function buildActiveSubscriptionConflict(
  requestContext: ReturnType<typeof createRouteRequestContext>,
  options?: {
    refresh?: boolean;
  },
) {
  return jsonWithRequestId(
    requestContext,
    {
      error: "Este workspace já possui uma assinatura ativa.",
      code: "SUBSCRIPTION_ALREADY_ACTIVE",
      refresh: options?.refresh ?? false,
    },
    { status: 409 },
  );
}

function buildPausedSubscriptionConflict(
  requestContext: ReturnType<typeof createRouteRequestContext>,
  options?: {
    refresh?: boolean;
  },
) {
  return jsonWithRequestId(
    requestContext,
    {
      error:
        "Este workspace possui uma assinatura pausada. Reative ou cancele a assinatura atual antes de contratar outra.",
      code: "SUBSCRIPTION_ALREADY_PAUSED",
      refresh: options?.refresh ?? false,
    },
    { status: 409 },
  );
}

function normalizePlanId(value?: string): WorkspacePlanId | null {
  if (!value) {
    return null;
  }

  return workspacePlans.some((plan) => plan.id === value)
    ? (value as WorkspacePlanId)
    : null;
}

function isAuthenticationRequiredError(error: unknown) {
  return error instanceof Error && error.message === "AUTHENTICATION_REQUIRED";
}
