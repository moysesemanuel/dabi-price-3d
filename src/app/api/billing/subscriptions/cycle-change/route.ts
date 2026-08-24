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
import { runWithServerBillingSubscriptionOperationClaim } from "@/lib/billing/server-subscription-operation-claim";
import { BillingSubscriptionOperationInProgressError } from "@/lib/billing/subscription-operation-claim";
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

  const targetMonthlyPriceExists = await findActiveBillingPrice({
    planId: subscription.planId,
    billingCycle: "monthly",
  });

  if (!targetMonthlyPriceExists) {
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
    const change = await runWithServerBillingSubscriptionOperationClaim(
      subscription.id,
      async () => {
        const currentSubscription =
          await findCurrentBillingSubscriptionForWorkspace(session.workspace.id);

        if (!currentSubscription || currentSubscription.id !== subscription.id) {
          throw new RequestBillingCycleChangeError(
            "A assinatura foi alterada enquanto a mudança de ciclo estava sendo iniciada. Atualize a página e tente novamente.",
            "CYCLE_CHANGE_SUBSCRIPTION_CHANGED_CONCURRENTLY",
            409,
          );
        }

        const currentTargetMonthlyPrice = await findActiveBillingPrice({
          planId: currentSubscription.planId,
          billingCycle: "monthly",
        });

        if (!currentTargetMonthlyPrice) {
          throw new RequestBillingCycleChangeError(
            "Não existe preço mensal ativo para o plano atual.",
            "CYCLE_CHANGE_PRICE_NOT_FOUND",
            503,
          );
        }

        return scheduleAnnualToMonthlyCycleChange({
          subscription: currentSubscription,
          targetMonthlyPrice: currentTargetMonthlyPrice,
          actorId: session.user.id,
          dependencies: {
            billingService: createBillingService(),
            provider: currentSubscription.provider
              ? getBillingProvider(currentSubscription.provider)
              : null,
          },
        });
      },
    );

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

    if (error instanceof BillingSubscriptionOperationInProgressError) {
      return jsonWithRequestId(
        requestContext,
        {
          error:
            "Uma atualização desta assinatura já está em andamento. Aguarde alguns segundos e tente novamente.",
          code: "SUBSCRIPTION_OPERATION_IN_PROGRESS",
        },
        { status: 409 },
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
