import type { BillingPrice, BillingSubscription } from "./types.ts";

export type BillingUpgradeProration = {
  remainingRatio: number;
  creditAmountCents: number;
  chargeAmountCents: number;
  netAmountCents: number;
};

export function calculateProratedUpgradeAmounts(input: {
  currentPrice: Pick<BillingPrice, "amountCents">;
  targetPrice: Pick<BillingPrice, "amountCents">;
  subscription: Pick<
    BillingSubscription,
    "currentPeriodStart" | "currentPeriodEnd" | "planId"
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
    throw new Error("Invalid billing period for prorated upgrade calculation.");
  }

  const effectiveStart = Math.max(asOf, currentPeriodStart);
  const remainingDuration = currentPeriodEnd - effectiveStart;
  const fullDuration = currentPeriodEnd - currentPeriodStart;

  if (remainingDuration <= 0) {
    throw new Error("Cannot calculate upgrade proration after the billing period ends.");
  }

  if (input.targetPrice.amountCents <= input.currentPrice.amountCents) {
    throw new Error("Target plan amount must be greater than the current plan amount.");
  }

  const remainingRatio = remainingDuration / fullDuration;
  const chargeAmountCents = Math.ceil(
    input.targetPrice.amountCents * remainingRatio,
  );
  const creditAmountCents = Math.floor(
    input.currentPrice.amountCents * remainingRatio,
  );
  const netAmountCents = Math.max(chargeAmountCents - creditAmountCents, 0);

  return {
    remainingRatio,
    creditAmountCents,
    chargeAmountCents,
    netAmountCents,
  } satisfies BillingUpgradeProration;
}
