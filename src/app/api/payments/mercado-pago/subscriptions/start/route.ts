import { isSuperAdminSession } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  createMercadoPagoSubscriptionCheckout,
  getMercadoPagoTestAccessToken,
} from "@/lib/payments/mercado-pago";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import type { BillingCycle } from "@/lib/billing/types";
import { workspacePlans, type WorkspacePlanId } from "@/lib/settings/app-preferences";

type StartSubscriptionPayload = {
  planId?: string;
  billingCycle?: string;
  payerEmail?: string;
};

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/payments/mercado-pago/subscriptions/start",
  );
  let session;

  try {
    session = await requireCurrentAuthSession();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para iniciar a assinatura de teste.",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    throw error;
  }

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

  const sandboxAccessToken = getMercadoPagoTestAccessToken();

  if (!sandboxAccessToken) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "MERCADO_PAGO_TEST_ACCESS_TOKEN é obrigatório para iniciar a assinatura de sandbox com comprador de teste.",
        code: "MP_TEST_ACCESS_TOKEN_MISSING",
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
  const billingCycle = normalizeBillingCycle(body.billingCycle);
  const payerEmail = normalizeEmail(body.payerEmail);

  if (!planId || !billingCycle || !payerEmail) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Informe um plano, ciclo e e-mail válidos para o comprador de teste.",
        code: "MP_TEST_SUBSCRIPTION_INVALID_INPUT",
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
        code: "MP_TEST_SUBSCRIPTION_PLAN_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  if (planId === "scale") {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "O plano DaBi Equipe continua com contratação consultiva e não deve usar o checkout automático de sandbox.",
        code: "MP_TEST_SUBSCRIPTION_CONSULTATIVE_PLAN",
      },
      { status: 409 },
    );
  }

  const appBaseUrl = new URL(request.url).origin;
  const backUrl = new URL("/contato", appBaseUrl);
  backUrl.searchParams.set("origin", "mercado-pago");
  backUrl.searchParams.set("plan", planId);
  backUrl.searchParams.set("billingCycle", billingCycle);
  backUrl.searchParams.set("workspaceId", session.workspace.id);

  try {
    const subscription = await createMercadoPagoSubscriptionCheckout({
      planId,
      billingCycle,
      payerEmail,
      workspaceId: session.workspace.id,
      reason: `${selectedPlan.label} - ${session.workspace.name}`,
      backUrl: backUrl.toString(),
      accessTokenOverride: sandboxAccessToken,
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
      billingCycle,
      payerEmail,
      subscriptionId: subscription.id,
      accessTokenSource: "test",
    });

    return jsonWithRequestId(requestContext, {
      ok: true,
      planId,
      billingCycle,
      payerEmail,
      subscriptionId: subscription.id,
      initPoint: subscription.init_point,
    });
  } catch (error) {
    logRouteEvent(requestContext, "error", "mercado_pago_subscription_checkout_failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      billingCycle,
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

function normalizeBillingCycle(value?: string): BillingCycle | null {
  if (value === "monthly" || value === "annual") {
    return value;
  }

  return null;
}

function isAuthenticationRequiredError(error: unknown) {
  return error instanceof Error && error.message === "AUTHENTICATION_REQUIRED";
}
