import { isSuperAdminSession } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  createMercadoPagoSubscriptionCheckout,
  getMercadoPagoAccessToken,
  hasMercadoPagoSubscription,
} from "@/lib/payments/mercado-pago";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import { workspacePlans, type WorkspacePlanId } from "@/lib/settings/app-preferences";

type StartSubscriptionPayload = {
  planId?: string;
  payerEmail?: string;
};

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/payments/mercado-pago/subscriptions/start",
  );

  const session = await requireCurrentAuthSession();

  if (!isSuperAdminSession(session)) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Apenas super admin pode iniciar assinaturas de teste por integração.",
        code: "MP_TEST_SUBSCRIPTION_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  if (!getMercadoPagoAccessToken()) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "MERCADO_PAGO_ACCESS_TOKEN é obrigatório para iniciar a assinatura por integração.",
        code: "MP_ACCESS_TOKEN_MISSING",
      },
      { status: 503 },
    );
  }

  let body: StartSubscriptionPayload;

  try {
    body = (await request.json()) as StartSubscriptionPayload;
  } catch {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Payload inválido.",
        code: "MP_TEST_SUBSCRIPTION_INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const planId = normalizePlanId(body.planId);
  const payerEmail = normalizeEmail(body.payerEmail);

  if (!planId || !payerEmail) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Informe um plano válido e o e-mail do comprador de teste.",
        code: "MP_TEST_SUBSCRIPTION_INVALID_INPUT",
      },
      { status: 400 },
    );
  }

  if (!hasMercadoPagoSubscription(planId)) {
    return jsonWithRequestId(
      requestContext,
      {
        error: `O plano ${planId} ainda não tem URL pública de assinatura configurada.`,
        code: "MP_TEST_SUBSCRIPTION_PLAN_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const selectedPlan = workspacePlans.find((plan) => plan.id === planId);

  if (!selectedPlan) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Plano não encontrado.",
        code: "MP_TEST_SUBSCRIPTION_PLAN_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const appBaseUrl = new URL(request.url).origin;
  const backUrl = new URL("/contato", appBaseUrl);
  backUrl.searchParams.set("origin", "mercado-pago");
  backUrl.searchParams.set("plan", planId);
  backUrl.searchParams.set("workspaceId", session.workspace.id);

  try {
    const subscription = await createMercadoPagoSubscriptionCheckout({
      planId,
      payerEmail,
      workspaceId: session.workspace.id,
      workspaceName: session.workspace.name,
      reason: `${selectedPlan.label} - ${session.workspace.name}`,
      backUrl: backUrl.toString(),
    });

    if (!subscription.init_point) {
      return jsonWithRequestId(
        requestContext,
        {
          error:
            "O Mercado Pago criou a assinatura, mas não retornou init_point para redirecionamento.",
          code: "MP_TEST_SUBSCRIPTION_MISSING_INIT_POINT",
        },
        { status: 502 },
      );
    }

    logRouteEvent(requestContext, "info", "mercado_pago_subscription_checkout_created", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      payerEmail,
      subscriptionId: subscription.id,
    });

    return jsonWithRequestId(requestContext, {
      ok: true,
      planId,
      payerEmail,
      subscriptionId: subscription.id,
      initPoint: subscription.init_point,
    });
  } catch (error) {
    logRouteEvent(requestContext, "error", "mercado_pago_subscription_checkout_failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      payerEmail,
      error: serializeError(error),
    });

    return jsonWithRequestId(
      requestContext,
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao criar a assinatura de teste no Mercado Pago.",
        code: "MP_TEST_SUBSCRIPTION_CREATE_FAILED",
      },
      { status: 502 },
    );
  }
}

function normalizePlanId(value?: string): WorkspacePlanId | null {
  if (!value) {
    return null;
  }

  return workspacePlans.some((plan) => plan.id === value)
    ? (value as WorkspacePlanId)
    : null;
}

function normalizeEmail(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}
