import type { BillingProvider } from "./providers/billing-provider.ts";
import type { BillingService } from "./service.ts";
import type {
  BillingInvoice,
  BillingPrice,
  BillingSubscription,
  BillingSubscriptionChange,
} from "./types.ts";

export class RequestBillingCycleChangeError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "RequestBillingCycleChangeError";
    this.code = code;
    this.status = status;
  }
}

type CycleChangeSubscription = Pick<
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
>;

export function calculateMonthlyToAnnualCycleChangeAmounts(input: {
  currentPrice: Pick<BillingPrice, "amountCents">;
  targetAnnualPrice: Pick<BillingPrice, "amountCents">;
  subscription: Pick<
    BillingSubscription,
    "currentPeriodStart" | "currentPeriodEnd"
  >;
  asOf: string;
}) {
  const currentPeriodStart = Date.parse(input.subscription.currentPeriodStart ?? "");
  const currentPeriodEnd = Date.parse(input.subscription.currentPeriodEnd ?? "");
  const asOf = Date.parse(input.asOf);

  if (
    Number.isNaN(currentPeriodStart) ||
    Number.isNaN(currentPeriodEnd) ||
    Number.isNaN(asOf) ||
    currentPeriodEnd <= currentPeriodStart
  ) {
    throw new Error("Invalid billing period for cycle change calculation.");
  }

  const effectiveStart = Math.max(asOf, currentPeriodStart);
  const remainingDuration = currentPeriodEnd - effectiveStart;

  if (remainingDuration <= 0) {
    throw new Error("Cannot calculate cycle change after the billing period ends.");
  }

  const remainingRatio = remainingDuration / (currentPeriodEnd - currentPeriodStart);
  const creditAmountCents = Math.floor(
    input.currentPrice.amountCents * remainingRatio,
  );
  const chargeAmountCents = input.targetAnnualPrice.amountCents;

  return {
    remainingRatio,
    creditAmountCents,
    chargeAmountCents,
    netAmountCents: Math.max(chargeAmountCents - creditAmountCents, 0),
  };
}

export async function requestMonthlyToAnnualCycleChange(input: {
  subscription: CycleChangeSubscription;
  currentPrice: Pick<BillingPrice, "amountCents">;
  targetAnnualPrice: Pick<BillingPrice, "id" | "billingCycle" | "amountCents" | "currency">;
  actorId: string;
  asOf?: string;
  billingService: Pick<BillingService, "requestCycleChange">;
}) {
  const { subscription } = input;

  assertSubscriptionCanChangeCycle(subscription);

  if (subscription.billingCycle !== "monthly") {
    throw new RequestBillingCycleChangeError(
      "A mudança imediata de ciclo só está disponível de mensal para anual.",
      "CYCLE_CHANGE_DIRECTION_INVALID",
      409,
    );
  }

  if (input.targetAnnualPrice.billingCycle !== "annual") {
    throw new RequestBillingCycleChangeError(
      "O preço de destino precisa ser anual.",
      "CYCLE_CHANGE_TARGET_PRICE_INVALID",
      409,
    );
  }

  const asOf = input.asOf ?? new Date().toISOString();
  const amounts = calculateMonthlyToAnnualCycleChangeAmounts({
    currentPrice: input.currentPrice,
    targetAnnualPrice: input.targetAnnualPrice,
    subscription,
    asOf,
  });

  return input.billingService.requestCycleChange(subscription.id, {
    actorType: "user",
    actorId: input.actorId,
    priceId: input.targetAnnualPrice.id,
    amountCents: amounts.netAmountCents,
    currency: input.targetAnnualPrice.currency,
    creditAmountCents: amounts.creditAmountCents,
    chargeAmountCents: amounts.chargeAmountCents,
    periodStart: asOf,
    periodEnd: addBillingCycle(asOf, "annual"),
    paymentMethod: "pix_manual",
    provider: "mercado_pago",
  });
}

export async function scheduleAnnualToMonthlyCycleChange(input: {
  subscription: CycleChangeSubscription;
  targetMonthlyPrice: Pick<BillingPrice, "amountCents" | "currency" | "billingCycle">;
  actorId: string;
  dependencies: {
    billingService: Pick<BillingService, "scheduleCycleChange">;
    provider: Pick<BillingProvider, "updateSubscriptionAmount"> | null;
  };
}) {
  const { subscription } = input;

  assertSubscriptionCanChangeCycle(subscription);

  if (subscription.billingCycle !== "annual") {
    throw new RequestBillingCycleChangeError(
      "A mudança agendada de ciclo só está disponível de anual para mensal.",
      "CYCLE_CHANGE_DIRECTION_INVALID",
      409,
    );
  }

  if (input.targetMonthlyPrice.billingCycle !== "monthly") {
    throw new RequestBillingCycleChangeError(
      "O preço de destino precisa ser mensal.",
      "CYCLE_CHANGE_TARGET_PRICE_INVALID",
      409,
    );
  }

  if (subscription.providerSubscriptionId) {
    if (!input.dependencies.provider) {
      throw new RequestBillingCycleChangeError(
        "Não foi possível resolver o provider para preparar a próxima cobrança mensal.",
        "CYCLE_CHANGE_PROVIDER_UNAVAILABLE",
        503,
      );
    }

    await input.dependencies.provider.updateSubscriptionAmount({
      providerSubscriptionId: subscription.providerSubscriptionId,
      amountCents: input.targetMonthlyPrice.amountCents,
      currency: input.targetMonthlyPrice.currency,
      billingCycle: "monthly",
    });
  }

  return input.dependencies.billingService.scheduleCycleChange(subscription.id, {
    actorType: "user",
    actorId: input.actorId,
  });
}

export async function applyBillingSubscriptionCycleChange(input: {
  subscription: Pick<
    BillingSubscription,
    "id" | "workspaceId" | "planId" | "provider" | "providerSubscriptionId"
  >;
  change: Pick<
    BillingSubscriptionChange,
    "id" | "toBillingCycle" | "toPlanId" | "status"
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
    billingService: Pick<BillingService, "applyCycleChange">;
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
      billingCycle?: BillingSubscription["billingCycle"];
      status: "active";
      source: string;
      mercadoPagoSubscriptionId?: string | null;
      description?: string | null;
    }): Promise<{ changed: boolean }>;
  };
}) {
  if (input.change.toBillingCycle !== "annual") {
    throw new Error(
      `Paid cycle change ${input.change.id} must change the subscription to annual.`,
    );
  }

  const planId = input.change.toPlanId ?? input.subscription.planId;
  const targetPrice = await input.dependencies.findActivePrice({
    planId,
    billingCycle: "annual",
    asOf: input.nowIso,
  });

  if (!targetPrice) {
    throw new Error(
      `No active annual billing price found for cycle change ${input.change.id}.`,
    );
  }

  if (input.subscription.providerSubscriptionId) {
    const provider = input.dependencies.getProvider(input.subscription.provider);

    if (!provider) {
      throw new Error(
        `No provider available to update recurring cycle for subscription ${input.subscription.id}.`,
      );
    }

    await provider.updateSubscriptionAmount({
      providerSubscriptionId: input.subscription.providerSubscriptionId,
      amountCents: targetPrice.amountCents,
      currency: targetPrice.currency,
      billingCycle: "annual",
    });
  }

  const currentPeriodEnd = addBillingCycle(input.nowIso, "annual");
  await input.dependencies.billingService.applyCycleChange(input.subscription.id, {
    actorType: input.actorType,
    billingCycle: "annual",
    priceId: targetPrice.id,
    currentPeriodStart: input.nowIso,
    currentPeriodEnd,
    changeId: input.change.id,
  });

  await input.dependencies.updateSubscriptionChange(input.change.id, {
    status: "applied",
    appliedAt: input.nowIso,
  });

  return input.dependencies.applyWorkspaceSubscriptionUpdate({
    workspaceId: input.subscription.workspaceId,
    planId,
    billingCycle: "annual",
    status: "active",
    source: input.source,
    mercadoPagoSubscriptionId: input.subscription.providerSubscriptionId ?? null,
    description: input.description,
  });
}

function assertSubscriptionCanChangeCycle(subscription: CycleChangeSubscription) {
  if (subscription.status !== "active") {
    throw new RequestBillingCycleChangeError(
      `A assinatura precisa estar ativa para mudar o ciclo. Status atual: ${subscription.status}.`,
      "CYCLE_CHANGE_INVALID_STATE",
      409,
    );
  }

  if (!subscription.autoRenew || subscription.cancelAtPeriodEnd) {
    throw new RequestBillingCycleChangeError(
      "Não é possível mudar o ciclo de uma assinatura sem renovação automática.",
      "CYCLE_CHANGE_RENEWAL_DISABLED",
      409,
    );
  }

  if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
    throw new RequestBillingCycleChangeError(
      "A assinatura atual não possui período válido para mudar o ciclo.",
      "CYCLE_CHANGE_PERIOD_MISSING",
      409,
    );
  }
}

function addBillingCycle(startAt: string, billingCycle: "monthly" | "annual") {
  const date = new Date(startAt);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid billing cycle start: ${startAt}`);
  }

  if (billingCycle === "annual") {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }

  return date.toISOString();
}
