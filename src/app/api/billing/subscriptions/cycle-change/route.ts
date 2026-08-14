import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  RequestBillingCycleChangeError,
  scheduleAnnualToMonthlyCycleChange,
} from "@/lib/billing/cycle-change-management";
import { getBillingProvider } from "@/lib/billing/providers";
import {
  findActiveBillingPrice,
  findCurrentBillingSubscriptionForWorkspace,
} from "@/lib/billing/repository";
import { createBillingService } from "@/lib/billing/server-service";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/billing/subscriptions/cycle-change",
  );

  let session;

  try {
    session = await requireCurrentAuthSession();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para agendar a mudança de ciclo.",
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

  const subscription = await findCurrentBillingSubscriptionForWorkspace(
    session.workspace.id,
  );

  if (!subscription) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Este workspace não possui uma assinatura corrente para mudar o ciclo.",
        code: "CYCLE_CHANGE_SUBSCRIPTION_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const targetMonthlyPrice = await findActiveBillingPrice({
    planId: subscription.planId,
    billingCycle: "monthly",
  });

  if (!targetMonthlyPrice) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Não existe preço mensal ativo para o plano atual.",
        code: "CYCLE_CHANGE_PRICE_NOT_FOUND",
      },
      { status: 503 },
    );
  }

  try {
    const change = await scheduleAnnualToMonthlyCycleChange({
      subscription,
      targetMonthlyPrice,
      actorId: session.user.id,
      dependencies: {
        billingService: createBillingService(),
        provider: subscription.provider
          ? getBillingProvider(subscription.provider)
          : null,
      },
    });

    logRouteEvent(requestContext, "info", "billing_cycle_change_scheduled", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      subscriptionId: subscription.id,
      changeId: change.id,
      effectiveAt: change.effectiveAt,
    });

    return jsonWithRequestId(requestContext, {
      ok: true,
      subscriptionId: subscription.id,
      changeId: change.id,
      effectiveAt: change.effectiveAt,
      status: change.status,
    });
  } catch (error) {
    logRouteEvent(requestContext, "error", "billing_cycle_change_schedule_failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      subscriptionId: subscription.id,
      error: serializeError(error),
    });

    if (error instanceof RequestBillingCycleChangeError) {
      return jsonWithRequestId(
        requestContext,
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return jsonWithRequestId(
      requestContext,
      {
        error: "Não foi possível agendar a mudança de ciclo.",
        code: "CYCLE_CHANGE_SCHEDULE_FAILED",
      },
      { status: 502 },
    );
  }
}
