import type { BillingProvider } from "./providers/billing-provider.ts";
import type { BillingService } from "./service.ts";
import type {
  BillingInvoice,
  BillingPrice,
  BillingSubscription,
  BillingSubscriptionChange,
} from "./types.ts";
import { calculateProratedUpgradeAmounts } from "./upgrade-proration.ts";

export class RequestBillingUpgradeError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "RequestBillingUpgradeError";
    this.code = code;
    this.status = status;
  }
}

type UpgradeableSubscription = Pick<
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
  | "currentPeriodStart"
  | "currentPeriodEnd"
  | "priceId"
>;

export async function requestBillingSubscriptionUpgrade(input: {
  subscription: UpgradeableSubscription;
  currentPrice: Pick<BillingPrice, "amountCents">;
  targetPrice: Pick<BillingPrice, "id" | "planId" | "amountCents" | "currency">;
  actorId: string;
  asOf?: string;
  billingService: Pick<BillingService, "requestUpgrade">;
}) {
  const subscription = input.subscription;

  if (subscription.status !== "active") {
    throw new RequestBillingUpgradeError(
      `A assinatura precisa estar ativa para solicitar upgrade. Status atual: ${subscription.status}.`,
      "UPGRADE_INVALID_STATE",
      409,
    );
  }

  if (!subscription.autoRenew || subscription.cancelAtPeriodEnd) {
    throw new RequestBillingUpgradeError(
      "Não é possível solicitar upgrade para uma assinatura sem renovação automática.",
      "UPGRADE_RENEWAL_DISABLED",
      409,
    );
  }

  const asOf = input.asOf ?? new Date().toISOString();
  const proration = calculateProratedUpgradeAmounts({
    currentPrice: input.currentPrice,
    targetPrice: input.targetPrice,
    subscription,
    asOf,
  });

  return input.billingService.requestUpgrade(subscription.id, {
    actorType: "user",
    actorId: input.actorId,
    toPlanId: input.targetPrice.planId,
    priceId: input.targetPrice.id,
    amountCents: proration.netAmountCents,
    currency: input.targetPrice.currency,
    creditAmountCents: proration.creditAmountCents,
    chargeAmountCents: proration.chargeAmountCents,
    periodStart: asOf,
    periodEnd: subscription.currentPeriodEnd,
    paymentMethod: "pix_manual",
    provider: "mercado_pago",
  });
}

export async function applyBillingSubscriptionUpgrade(input: {
  subscription: Pick<
    BillingSubscription,
    | "id"
    | "workspaceId"
    | "billingCycle"
    | "provider"
    | "providerSubscriptionId"
  >;
  change: Pick<
    BillingSubscriptionChange,
    "id" | "toPlanId" | "toBillingCycle" | "status"
  >;
  invoice: Pick<BillingInvoice, "id">;
  actorType: "webhook" | "system";
  source: string;
  description: string;
  nowIso: string;
  dependencies: {
    findActivePrice(input: {
      planId: BillingSubscription["planId"];
      billingCycle: BillingSubscription["billingCycle"];
      asOf?: string;
    }): Promise<BillingPrice | null>;
    getProvider(
      provider: BillingSubscription["provider"],
    ): Pick<BillingProvider, "updateSubscriptionAmount"> | null;
    billingService: Pick<BillingService, "applyUpgrade">;
    updateSubscriptionChange(
      changeId: string,
      mutation: Partial<
        Pick<
          BillingSubscriptionChange,
          "status" | "appliedAt" | "canceledAt" | "invoiceId"
        >
      >,
    ): Promise<BillingSubscriptionChange | null>;
    applyWorkspaceSubscriptionUpdate(input: {
      workspaceId: string;
      planId: BillingSubscription["planId"];
      status: "active";
      source: string;
      mercadoPagoSubscriptionId?: string | null;
      description?: string | null;
    }): Promise<{ changed: boolean }>;
  };
}) {
  if (!input.change.toPlanId) {
    throw new Error(`Upgrade change ${input.change.id} does not define toPlanId.`);
  }

  const targetPrice = await input.dependencies.findActivePrice({
    planId: input.change.toPlanId,
    billingCycle: input.change.toBillingCycle ?? input.subscription.billingCycle,
    asOf: input.nowIso,
  });

  if (!targetPrice) {
    throw new Error(
      `No active billing price found for upgrade change ${input.change.id}.`,
    );
  }

  if (input.subscription.providerSubscriptionId) {
    const provider = input.dependencies.getProvider(input.subscription.provider);

    if (!provider) {
      throw new Error(
        `No provider available to update recurring amount for subscription ${input.subscription.id}.`,
      );
    }

    await provider.updateSubscriptionAmount({
      providerSubscriptionId: input.subscription.providerSubscriptionId,
      amountCents: targetPrice.amountCents,
      currency: targetPrice.currency,
      billingCycle: input.subscription.billingCycle,
    });
  }

  await input.dependencies.billingService.applyUpgrade(input.subscription.id, {
    actorType: input.actorType,
    toPlanId: input.change.toPlanId,
    priceId: targetPrice.id,
    changeId: input.change.id,
  });

  await input.dependencies.updateSubscriptionChange(input.change.id, {
    status: "applied",
    appliedAt: input.nowIso,
  });

  return input.dependencies.applyWorkspaceSubscriptionUpdate({
    workspaceId: input.subscription.workspaceId,
    planId: input.change.toPlanId,
    status: "active",
    source: input.source,
    mercadoPagoSubscriptionId: input.subscription.providerSubscriptionId ?? null,
    description: input.description,
  });
}
