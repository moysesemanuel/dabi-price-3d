import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { resolveSubscriptionCheckoutFlow } from "@/lib/billing/checkout-flow";
import { getBillingProvider } from "@/lib/billing/providers";
import {
  findActiveBillingPrice,
  findCurrentBillingSubscriptionForWorkspace,
  updateBillingSubscription,
} from "@/lib/billing/repository";
import { createBillingService } from "@/lib/billing/server-service";
import type { BillingSubscription } from "@/lib/billing/types";
import {
  getMercadoPagoAccessToken,
  isMercadoPagoApiError,
  normalizeMercadoPagoSubscriptionStatus,
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

type WorkspacePreferencesSubscription =
  Awaited<ReturnType<typeof getWorkspacePreferences>>["subscription"];

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
  const currentBillingSubscription = await findCurrentBillingSubscriptionForWorkspace(
    session.workspace.id,
  );
  const checkoutFlow = resolveSubscriptionCheckoutFlow({
    selectedPlanId: planId,
    billingSubscription: currentBillingSubscription
      ? {
          planId: currentBillingSubscription.planId,
          status: currentBillingSubscription.status,
          providerSubscriptionId: currentBillingSubscription.providerSubscriptionId,
        }
      : null,
    legacySubscription: currentSubscription,
  });

  if (checkoutFlow.type === "block_active_subscription") {
    return buildActiveSubscriptionConflict(requestContext);
  }

  if (checkoutFlow.type === "block_paused_subscription") {
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

  const billingService = createBillingService();
  const provider = getBillingProvider("mercado_pago");
  let shouldReleaseCheckoutClaim = false;
  let createdBillingSubscriptionId: string | null = null;

  if (checkoutFlow.type === "resume_pending_checkout") {
    const recoveryResponse = await reconcilePendingCheckout({
      requestContext,
      session,
      source: checkoutFlow.source,
      shouldResumeCheckout: true,
      currentBillingSubscription,
      currentSubscription,
      selectedPlanId: planId,
      selectedPlanLabel: selectedPlan.label,
      billingService,
      provider,
    });

    if (recoveryResponse) {
      return recoveryResponse;
    }
  }

  if (
    checkoutFlow.type === "create_new_checkout" ||
    checkoutFlow.type === "replace_pending_checkout" ||
    checkoutFlow.type === "resume_pending_checkout"
  ) {
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

    shouldReleaseCheckoutClaim = true;
  }

  try {
    if (checkoutFlow.type === "replace_pending_checkout") {
      const replacementResponse = await reconcilePendingCheckout({
        requestContext,
        session,
        source: checkoutFlow.source,
        shouldResumeCheckout: false,
        currentBillingSubscription,
        currentSubscription,
        selectedPlanId: planId,
        selectedPlanLabel: selectedPlan.label,
        billingService,
        provider,
      });

      if (replacementResponse) {
        return replacementResponse;
      }
    }

    const price = await findActiveBillingPrice({
      planId,
      billingCycle: "monthly",
    });

    if (!price) {
      return jsonWithRequestId(
        requestContext,
        {
          error:
            "Não existe um preço ativo configurado para este plano no billing atual.",
          code: "SUBSCRIPTION_CHECKOUT_PRICE_NOT_FOUND",
        },
        { status: 503 },
      );
    }

    const appBaseUrl = new URL(request.url).origin;
    const backUrl = new URL("/app/checkout", appBaseUrl);

    backUrl.searchParams.set("origin", "mercado-pago");
    backUrl.searchParams.set("plan", planId);
    backUrl.searchParams.set("workspaceId", session.workspace.id);

    logRouteEvent(
      requestContext,
      "info",
      "mercado_pago_checkout.create_started",
      {
        workspaceId: session.workspace.id,
        userId: session.user.id,
        planId,
        legacyStatus: currentSubscription.status,
        billingStatus: currentBillingSubscription?.status ?? null,
      },
    );

    const localSubscription = await billingService.createSubscription({
      workspaceId: session.workspace.id,
      planId,
      billingCycle: "monthly",
      priceId: price.id,
      autoRenew: true,
      provider: "mercado_pago",
    });
    createdBillingSubscriptionId = localSubscription.id;

    const providerSubscription = await provider.createRecurringSubscription({
      externalReference: `billing_subscription:${localSubscription.id}`,
      payerEmail: session.user.email,
      reason: `${selectedPlan.label} - ${session.workspace.name}`,
      returnUrl: backUrl.toString(),
      amountCents: price.amountCents,
      currency: price.currency,
      billingCycle: "monthly",
    });

    if (!providerSubscription.providerSubscriptionId) {
      await billingService.finalizeCancellation(localSubscription.id, {
        actorType: "system",
      });

      return jsonWithRequestId(
        requestContext,
        {
          error:
            "O provider criou a contratação, mas não retornou o identificador da assinatura.",
          code: "SUBSCRIPTION_CHECKOUT_MISSING_PROVIDER_SUBSCRIPTION_ID",
        },
        { status: 502 },
      );
    }

    const updatedSubscription = await updateBillingSubscription(localSubscription.id, {
      providerSubscriptionId: providerSubscription.providerSubscriptionId,
      autoRenew: true,
    });

    if (!updatedSubscription) {
      await billingService.finalizeCancellation(localSubscription.id, {
        actorType: "system",
      });

      return jsonWithRequestId(
        requestContext,
        {
          error:
            "A assinatura foi criada no provider, mas não foi possível persistir o vínculo no billing local.",
          code: "SUBSCRIPTION_CHECKOUT_LOCAL_SYNC_FAILED",
        },
        { status: 502 },
      );
    }

    if (!providerSubscription.checkoutUrl) {
      await billingService.finalizeCancellation(updatedSubscription.id, {
        actorType: "system",
      });

      return jsonWithRequestId(
        requestContext,
        {
          error:
            "O provider criou a assinatura, mas não retornou a URL de checkout.",
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
      mercadoPagoSubscriptionId: updatedSubscription.providerSubscriptionId,
      description: `Checkout da assinatura ${selectedPlan.label} criado no Mercado Pago e aguardando confirmação.`,
    });
    shouldReleaseCheckoutClaim = false;

    logRouteEvent(
      requestContext,
      "info",
      "mercado_pago_checkout.create_succeeded",
      {
        workspaceId: session.workspace.id,
        userId: session.user.id,
        planId,
        localSubscriptionId: updatedSubscription.id,
        subscriptionId: updatedSubscription.providerSubscriptionId,
        status: "pending",
      },
    );

    return jsonWithRequestId(requestContext, {
      ok: true,
      planId,
      subscriptionId: updatedSubscription.providerSubscriptionId,
      billingSubscriptionId: updatedSubscription.id,
      initPoint: providerSubscription.checkoutUrl,
    });
  } catch (error) {
    if (createdBillingSubscriptionId) {
      await billingService
        .finalizeCancellation(createdBillingSubscriptionId, {
          actorType: "system",
        })
        .catch(() => null);
    }

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
  } finally {
    if (shouldReleaseCheckoutClaim) {
      await releaseWorkspaceSubscriptionCheckout({
        workspaceId: session.workspace.id,
      });
    }
  }
}

async function reconcilePendingCheckout(input: {
  requestContext: ReturnType<typeof createRouteRequestContext>;
  session: AuthenticatedWorkspaceSession;
  source: "billing" | "legacy";
  shouldResumeCheckout: boolean;
  currentBillingSubscription: BillingSubscription | null;
  currentSubscription: WorkspacePreferencesSubscription;
  selectedPlanId: WorkspacePlanId;
  selectedPlanLabel: string;
  billingService: ReturnType<typeof createBillingService>;
  provider: ReturnType<typeof getBillingProvider>;
}) {
  const providerSubscriptionId =
    input.source === "billing"
      ? input.currentBillingSubscription?.providerSubscriptionId ?? null
      : input.currentSubscription.mercadoPagoSubscriptionId;
  const pendingPlanId =
    input.source === "billing"
      ? input.currentBillingSubscription?.planId ?? input.currentSubscription.planId
      : input.currentSubscription.planId;

  if (!providerSubscriptionId) {
    if (!input.shouldResumeCheckout) {
      await clearPendingCheckoutState({
        session: input.session,
        source: input.source,
        currentBillingSubscription: input.currentBillingSubscription,
        currentSubscription: input.currentSubscription,
        billingService: input.billingService,
        nextLegacyStatus: "unpaid",
        providerSubscriptionId: null,
        sourceName: "mercado-pago-checkout-replacement",
        description:
          "A contratação pendente anterior não possuía vínculo remoto válido e foi encerrada para abrir um novo checkout.",
      });
    }

    return null;
  }

  logRouteEvent(
    input.requestContext,
    "info",
    input.shouldResumeCheckout
      ? "mercado_pago_checkout.resume_started"
      : "mercado_pago_checkout.replace_started",
    {
      workspaceId: input.session.workspace.id,
      userId: input.session.user.id,
      source: input.source,
      planId: pendingPlanId,
      selectedPlanId: input.selectedPlanId,
      subscriptionId: providerSubscriptionId,
    },
  );

  try {
    const remoteSubscription = await input.provider.getSubscription(
      providerSubscriptionId,
    );
    const recovery = resolvePendingSubscriptionRecovery({
      remoteStatus: normalizeMercadoPagoSubscriptionStatus(
        remoteSubscription.status,
      ),
      initPoint: remoteSubscription.checkoutUrl,
    });

    if (recovery.type === "resume_checkout") {
      if (!input.shouldResumeCheckout) {
        await cancelPendingCheckoutForReplacement({
          session: input.session,
          source: input.source,
          currentBillingSubscription: input.currentBillingSubscription,
          currentSubscription: input.currentSubscription,
          providerSubscriptionId,
          selectedPlanLabel: input.selectedPlanLabel,
          billingService: input.billingService,
          provider: input.provider,
        });

        return null;
      }

      logRouteEvent(
        input.requestContext,
        "info",
        "mercado_pago_checkout.resume_succeeded",
        {
          workspaceId: input.session.workspace.id,
          userId: input.session.user.id,
          source: input.source,
          planId: pendingPlanId,
          selectedPlanId: input.selectedPlanId,
          subscriptionId: providerSubscriptionId,
        },
      );

      return jsonWithRequestId(input.requestContext, {
        ok: true,
        resumed: true,
        planId: pendingPlanId,
        subscriptionId: providerSubscriptionId,
        initPoint: recovery.initPoint,
      });
    }

    if (recovery.type === "missing_init_point") {
      if (!input.shouldResumeCheckout) {
        await cancelPendingCheckoutForReplacement({
          session: input.session,
          source: input.source,
          currentBillingSubscription: input.currentBillingSubscription,
          currentSubscription: input.currentSubscription,
          providerSubscriptionId,
          selectedPlanLabel: input.selectedPlanLabel,
          billingService: input.billingService,
          provider: input.provider,
        });

        return null;
      }

      logRouteEvent(
        input.requestContext,
        "error",
        "mercado_pago_checkout.resume_missing_init_point",
        {
          workspaceId: input.session.workspace.id,
          userId: input.session.user.id,
          source: input.source,
          planId: pendingPlanId,
          selectedPlanId: input.selectedPlanId,
          subscriptionId: providerSubscriptionId,
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
      await syncPendingCheckoutStatus({
        session: input.session,
        source: input.source,
        currentBillingSubscription: input.currentBillingSubscription,
        currentSubscription: input.currentSubscription,
        billingService: input.billingService,
        providerSubscriptionId,
        nextStatus: recovery.nextStatus,
        description: `Checkout pendente reconciliado com status remoto ${recovery.remoteStatus}.`,
      });

      return recovery.nextStatus === "active"
        ? buildActiveSubscriptionConflict(input.requestContext, { refresh: true })
        : buildPausedSubscriptionConflict(input.requestContext, { refresh: true });
    }

    if (recovery.type === "allow_new_checkout") {
      await clearPendingCheckoutState({
        session: input.session,
        source: input.source,
        currentBillingSubscription: input.currentBillingSubscription,
        currentSubscription: input.currentSubscription,
        billingService: input.billingService,
        nextLegacyStatus: recovery.nextStatus,
        providerSubscriptionId: recovery.clearSubscriptionId
          ? null
          : providerSubscriptionId,
        sourceName: "mercado-pago-checkout-recovery",
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
            source: input.source,
            planId: pendingPlanId,
            selectedPlanId: input.selectedPlanId,
            subscriptionId: providerSubscriptionId,
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
        source: input.source,
        planId: pendingPlanId,
        selectedPlanId: input.selectedPlanId,
        subscriptionId: providerSubscriptionId,
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
      await clearPendingCheckoutState({
        session: input.session,
        source: input.source,
        currentBillingSubscription: input.currentBillingSubscription,
        currentSubscription: input.currentSubscription,
        billingService: input.billingService,
        nextLegacyStatus: "unpaid",
        providerSubscriptionId: null,
        sourceName: "mercado-pago-checkout-recovery",
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
          source: input.source,
          planId: pendingPlanId,
          selectedPlanId: input.selectedPlanId,
          subscriptionId: providerSubscriptionId,
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
        source: input.source,
        planId: pendingPlanId,
        selectedPlanId: input.selectedPlanId,
        subscriptionId: providerSubscriptionId,
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

async function cancelPendingCheckoutForReplacement(input: {
  session: AuthenticatedWorkspaceSession;
  source: "billing" | "legacy";
  currentBillingSubscription: BillingSubscription | null;
  currentSubscription: WorkspacePreferencesSubscription;
  providerSubscriptionId: string;
  selectedPlanLabel: string;
  billingService: ReturnType<typeof createBillingService>;
  provider: ReturnType<typeof getBillingProvider>;
}) {
  try {
    await input.provider.cancelSubscription(input.providerSubscriptionId);
  } catch (error) {
    if (!(isMercadoPagoApiError(error) && error.status === 404)) {
      throw error;
    }
  }

  await clearPendingCheckoutState({
    session: input.session,
    source: input.source,
    currentBillingSubscription: input.currentBillingSubscription,
    currentSubscription: input.currentSubscription,
    billingService: input.billingService,
    nextLegacyStatus: "unpaid",
    providerSubscriptionId: null,
    sourceName: "mercado-pago-checkout-replacement",
    description: `A contratação pendente anterior foi encerrada para trocar o plano antes do primeiro pagamento e abrir o checkout de ${input.selectedPlanLabel}.`,
  });
}

async function clearPendingCheckoutState(input: {
  session: AuthenticatedWorkspaceSession;
  source: "billing" | "legacy";
  currentBillingSubscription: BillingSubscription | null;
  currentSubscription: WorkspacePreferencesSubscription;
  billingService: ReturnType<typeof createBillingService>;
  nextLegacyStatus: WorkspacePreferencesSubscription["status"];
  providerSubscriptionId: string | null;
  sourceName: string;
  description: string;
}) {
  const planId =
    input.source === "billing"
      ? input.currentBillingSubscription?.planId ?? input.currentSubscription.planId
      : input.currentSubscription.planId;

  if (
    input.source === "billing" &&
    input.currentBillingSubscription &&
    input.currentBillingSubscription.status === "pending"
  ) {
    await input.billingService.finalizeCancellation(input.currentBillingSubscription.id, {
      actorType: "system",
    });
  }

  await applyWorkspaceSubscriptionUpdate({
    workspaceId: input.session.workspace.id,
    planId,
    status: input.nextLegacyStatus,
    source: input.sourceName,
    mercadoPagoSubscriptionId: input.providerSubscriptionId,
    description: input.description,
  });
}

async function syncPendingCheckoutStatus(input: {
  session: AuthenticatedWorkspaceSession;
  source: "billing" | "legacy";
  currentBillingSubscription: BillingSubscription | null;
  currentSubscription: WorkspacePreferencesSubscription;
  billingService: ReturnType<typeof createBillingService>;
  providerSubscriptionId: string;
  nextStatus: "active" | "paused";
  description: string;
}) {
  const planId =
    input.source === "billing"
      ? input.currentBillingSubscription?.planId ?? input.currentSubscription.planId
      : input.currentSubscription.planId;

  if (
    input.source === "billing" &&
    input.currentBillingSubscription &&
    input.currentBillingSubscription.status === "pending"
  ) {
    if (input.nextStatus === "active") {
      await input.billingService.activateSubscription(input.currentBillingSubscription.id, {
        actorType: "system",
      });
    } else {
      await input.billingService.pauseSubscription(input.currentBillingSubscription.id, {
        actorType: "system",
      });
    }
  }

  await applyWorkspaceSubscriptionUpdate({
    workspaceId: input.session.workspace.id,
    planId,
    status: input.nextStatus,
    source: "mercado-pago-checkout-recovery",
    mercadoPagoSubscriptionId: input.providerSubscriptionId,
    description: input.description,
  });
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
