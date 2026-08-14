import type { BillingProvider } from "./providers/billing-provider.ts";
import type { BillingService } from "./service.ts";
import type {
  BillingPlanId,
  BillingPrice,
  BillingSubscription,
} from "./types.ts";

export class ScheduleBillingDowngradeError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ScheduleBillingDowngradeError";
    this.code = code;
    this.status = status;
  }
}

type SchedulableBillingSubscription = Pick<
  BillingSubscription,
  | "id"
  | "workspaceId"
  | "planId"
  | "billingCycle"
  | "status"
  | "autoRenew"
  | "cancelAtPeriodEnd"
  | "provider"
  | "providerSubscriptionId"
  | "currentPeriodEnd"
>;

type ScheduleDowngradeDependencies = {
  billingService: Pick<BillingService, "scheduleDowngrade">;
  provider: Pick<BillingProvider, "updateSubscriptionAmount"> | null;
};

export async function scheduleBillingSubscriptionDowngrade(input: {
  subscription: SchedulableBillingSubscription;
  targetPlanId: BillingPlanId;
  targetPrice: Pick<BillingPrice, "amountCents" | "currency">;
  actorId: string;
  dependencies: ScheduleDowngradeDependencies;
}) {
  const { subscription, targetPlanId, targetPrice, actorId, dependencies } = input;

  if (subscription.status !== "active") {
    throw new ScheduleBillingDowngradeError(
      `A assinatura precisa estar ativa para agendar downgrade. Status atual: ${subscription.status}.`,
      "DOWNGRADE_INVALID_STATE",
      409,
    );
  }

  if (!subscription.autoRenew || subscription.cancelAtPeriodEnd) {
    throw new ScheduleBillingDowngradeError(
      "Não é possível agendar downgrade para uma assinatura sem renovação automática.",
      "DOWNGRADE_RENEWAL_DISABLED",
      409,
    );
  }

  if (!subscription.currentPeriodEnd) {
    throw new ScheduleBillingDowngradeError(
      "A assinatura atual não possui fim de período definido para agendar o downgrade.",
      "DOWNGRADE_PERIOD_END_MISSING",
      409,
    );
  }

  if (subscription.providerSubscriptionId) {
    if (!dependencies.provider) {
      throw new ScheduleBillingDowngradeError(
        "Não foi possível resolver o provider da assinatura atual para preparar a próxima cobrança.",
        "DOWNGRADE_PROVIDER_UNAVAILABLE",
        503,
      );
    }

    await dependencies.provider.updateSubscriptionAmount({
      providerSubscriptionId: subscription.providerSubscriptionId,
      amountCents: targetPrice.amountCents,
      currency: targetPrice.currency,
      billingCycle: subscription.billingCycle,
    });
  }

  return dependencies.billingService.scheduleDowngrade(subscription.id, {
    toPlanId: targetPlanId,
    actorType: "user",
    actorId,
  });
}
