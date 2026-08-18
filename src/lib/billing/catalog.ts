import { getWorkspacePlan, workspacePlans } from "../workspace/catalog.ts";
import { billingPlanMeta, type BillingCycle, type BillingPlanId } from "./types.ts";

export type BillingCatalogPrice = {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  amountCents: number;
  currency: "BRL";
  activeFrom: string;
  activeUntil: null;
};

export function resolveBillingPriceAmountCents(input: {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
}) {
  const plan = getWorkspacePlan(input.planId);
  const amount =
    input.billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;

  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  const amountCents = Math.round(amount * 100);

  return amountCents > 0 ? amountCents : null;
}

export function resolveBillingCatalogPrice(input: {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  activeFrom: string;
}) {
  const amountCents = resolveBillingPriceAmountCents(input);

  if (!amountCents) {
    return null;
  }

  return {
    planId: input.planId,
    billingCycle: input.billingCycle,
    amountCents,
    currency: "BRL" as const,
    activeFrom: input.activeFrom,
    activeUntil: null,
  };
}

export function listBillingBootstrapPrices(input: {
  activeFrom: string;
}) {
  return workspacePlans
    .flatMap((plan) =>
      (["monthly", "annual"] as const)
        .map((billingCycle) =>
          resolveBillingCatalogPrice({
            planId: plan.id,
            billingCycle,
            activeFrom: input.activeFrom,
          }),
        )
        .filter((price): price is BillingCatalogPrice => Boolean(price)),
    );
}

export function getBillingPlanCommercialName(planId: BillingPlanId) {
  return billingPlanMeta[planId].commercialName;
}
