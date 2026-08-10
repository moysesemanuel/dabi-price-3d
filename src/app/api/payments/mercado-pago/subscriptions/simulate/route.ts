import { isSuperAdminSession } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { applyWorkspaceSubscriptionUpdate } from "@/lib/server/platform";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import { workspacePlans, type WorkspacePlanId } from "@/lib/settings/app-preferences";

type SimulateSubscriptionPayload = {
  planId?: string;
};

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/payments/mercado-pago/subscriptions/simulate",
  );

  let session;

  try {
    session = await requireCurrentAuthSession();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para simular a assinatura do workspace.",
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
        error: "Apenas super admin pode simular assinaturas internamente.",
        code: "SIMULATED_SUBSCRIPTION_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  let body: SimulateSubscriptionPayload;

  try {
    body = (await request.json()) as SimulateSubscriptionPayload;
  } catch {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Payload inválido.",
        code: "SIMULATED_SUBSCRIPTION_INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const planId = normalizePlanId(body.planId);

  if (!planId) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Informe um plano válido para simulação.",
        code: "SIMULATED_SUBSCRIPTION_INVALID_PLAN",
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyWorkspaceSubscriptionUpdate({
      workspaceId: session.workspace.id,
      planId,
      status: "active",
      source: "internal-subscription-simulation",
      mercadoPagoSubscriptionId: `simulated-${session.workspace.id}-${planId}`,
      description: `Assinatura simulada internamente para ${planId} por ${session.user.email}.`,
    });

    logRouteEvent(requestContext, "info", "internal_subscription_simulated", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      changed: result.changed,
    });

    return jsonWithRequestId(requestContext, {
      ok: true,
      planId,
      changed: result.changed,
      subscription: result.nextPreferences.subscription,
    });
  } catch (error) {
    logRouteEvent(requestContext, "error", "internal_subscription_simulation_failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      error: serializeError(error),
    });

    return jsonWithRequestId(
      requestContext,
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível simular a assinatura do workspace.",
        code: "SIMULATED_SUBSCRIPTION_FAILED",
      },
      { status: 500 },
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

function isAuthenticationRequiredError(error: unknown) {
  return error instanceof Error && error.message === "AUTHENTICATION_REQUIRED";
}
