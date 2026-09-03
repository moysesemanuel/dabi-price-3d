import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { scheduleBillingSubscriptionDowngrade, ScheduleBillingDowngradeError } from "@/lib/billing/downgrade-management";
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

type ScheduleDowngradePayload = {
  planId?: string;
};

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/billing/subscriptions/downgrade",
  );

  let session;

  try {
    session = await requireCurrentAuthSession();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
    ) {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para agendar o downgrade da assinatura.",
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

  let body: ScheduleDowngradePayload;

  try {
    body = (await request.json()) as ScheduleDowngradePayload;
  } catch {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Payload inválido.",
        code: "DOWNGRADE_INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const targetPlanId = normalizeDowngradePlanId(body.planId);

  if (!targetPlanId) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Informe um plano válido para agendar o downgrade.",
        code: "DOWNGRADE_INVALID_PLAN",
      },
      { status: 400 },
    );
  }

  const subscription = await findCurrentBillingSubscriptionForWorkspace(
    session.workspace.id,
  );

  if (!subscription) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Este workspace não possui uma assinatura ativa para downgrade.",
        code: "DOWNGRADE_SUBSCRIPTION_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const targetPriceExists = await findActiveBillingPrice({
    planId: targetPlanId,
    billingCycle: subscription.billingCycle,
  });

  if (!targetPriceExists) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "Não existe um preço ativo configurado para o plano de destino no ciclo atual.",
        code: "DOWNGRADE_PRICE_NOT_FOUND",
      },
      { status: 503 },
    );
  }

  try {
    const scheduledChange = await runWithServerBillingSubscriptionOperationClaim(
      subscription.id,
      async () => {
        const currentSubscription =
          await findCurrentBillingSubscriptionForWorkspace(session.workspace.id);

        if (!currentSubscription || currentSubscription.id !== subscription.id) {
          throw new ScheduleBillingDowngradeError(
            "A assinatura foi alterada enquanto o downgrade estava sendo iniciado. Atualize a página e tente novamente.",
            "DOWNGRADE_SUBSCRIPTION_CHANGED_CONCURRENTLY",
            409,
          );
        }

        const currentTargetPrice = await findActiveBillingPrice({
          planId: targetPlanId,
          billingCycle: currentSubscription.billingCycle,
        });

        if (!currentTargetPrice) {
          throw new ScheduleBillingDowngradeError(
            "Não existe um preço ativo configurado para o plano de destino no ciclo atual.",
            "DOWNGRADE_PRICE_NOT_FOUND",
            503,
          );
        }

        return scheduleBillingSubscriptionDowngrade({
          subscription: currentSubscription,
          targetPlanId,
          targetPrice: currentTargetPrice,
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

    logRouteEvent(
      requestContext,
      "info",
      "billing_downgrade_scheduled",
      {
        workspaceId: session.workspace.id,
        userId: session.user.id,
        subscriptionId: subscription.id,
        targetPlanId,
        changeId: scheduledChange.id,
        effectiveAt: scheduledChange.effectiveAt,
      },
    );

    return jsonWithRequestId(requestContext, {
      ok: true,
      subscriptionId: subscription.id,
      changeId: scheduledChange.id,
      targetPlanId,
      effectiveAt: scheduledChange.effectiveAt,
      status: scheduledChange.status,
    });
  } catch (error) {
    logRouteEvent(
      requestContext,
      "error",
      "billing_downgrade_schedule_failed",
      {
        workspaceId: session.workspace.id,
        userId: session.user.id,
        subscriptionId: subscription.id,
        targetPlanId,
        error: serializeError(error),
      },
    );

    if (error instanceof ScheduleBillingDowngradeError) {
      return jsonWithRequestId(
        requestContext,
        {
          error: error.message,
          code: error.code,
        },
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

    if (error instanceof Error) {
      return jsonWithRequestId(
        requestContext,
        {
          error: error.message,
          code: "DOWNGRADE_SCHEDULE_FAILED",
        },
        { status: 409 },
      );
    }

    return jsonWithRequestId(
      requestContext,
      {
        error: "Não foi possível agendar o downgrade da assinatura.",
        code: "DOWNGRADE_SCHEDULE_FAILED",
      },
      { status: 502 },
    );
  }
}

function normalizeDowngradePlanId(value: string | undefined) {
  return value === "starter" || value === "growth" ? value : null;
}
