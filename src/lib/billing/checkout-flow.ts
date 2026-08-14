import type { SubscriptionStatus, WorkspacePlanId } from "../workspace/catalog.ts";
import type { BillingPlanId, BillingSubscriptionStatus } from "./types.ts";
import type { BillingCycle } from "./types.ts";

export type PendingCheckoutSource = "billing" | "legacy";

type BillingCheckoutSubscription = {
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  status: BillingSubscriptionStatus;
  providerSubscriptionId: string | null;
};

type LegacyCheckoutSubscription = {
  planId: WorkspacePlanId;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  mercadoPagoSubscriptionId: string | null;
};

export type SubscriptionCheckoutFlowDecision =
  | {
      type: "block_active_subscription";
      source: PendingCheckoutSource | "none";
    }
  | {
      type: "block_paused_subscription";
      source: PendingCheckoutSource | "none";
    }
  | {
      type: "resume_pending_checkout";
      source: PendingCheckoutSource;
    }
  | {
      type: "replace_pending_checkout";
      source: PendingCheckoutSource;
    }
  | {
      type: "create_new_checkout";
      source: PendingCheckoutSource | "none";
    };

export function resolveSubscriptionCheckoutFlow(input: {
  selectedPlanId: WorkspacePlanId;
  selectedBillingCycle: BillingCycle;
  billingSubscription: BillingCheckoutSubscription | null;
  legacySubscription: LegacyCheckoutSubscription;
}): SubscriptionCheckoutFlowDecision {
  if (input.billingSubscription) {
    return resolveBillingCheckoutFlow({
      selectedPlanId: input.selectedPlanId,
      selectedBillingCycle: input.selectedBillingCycle,
      billingSubscription: input.billingSubscription,
    });
  }

  return resolveLegacyCheckoutFlow(input);
}

function resolveBillingCheckoutFlow(input: {
  selectedPlanId: WorkspacePlanId;
  selectedBillingCycle: BillingCycle;
  billingSubscription: BillingCheckoutSubscription;
}) {
  switch (input.billingSubscription.status) {
    case "active":
    case "past_due":
    case "scheduled_cancel":
      return {
        type: "block_active_subscription",
        source: "billing",
      } as const;
    case "paused":
      return {
        type: "block_paused_subscription",
        source: "billing",
      } as const;
    case "pending":
      return resolvePendingCheckoutFlow({
        selectedPlanId: input.selectedPlanId,
        selectedBillingCycle: input.selectedBillingCycle,
        currentPlanId: input.billingSubscription.planId,
        currentBillingCycle: input.billingSubscription.billingCycle,
        subscriptionId: input.billingSubscription.providerSubscriptionId,
        source: "billing",
      });
    case "canceled":
    case "expired":
      return {
        type: "create_new_checkout",
        source: "billing",
      } as const;
  }
}

function resolveLegacyCheckoutFlow(input: {
  selectedPlanId: WorkspacePlanId;
  selectedBillingCycle: BillingCycle;
  legacySubscription: LegacyCheckoutSubscription;
}) {
  if (input.legacySubscription.status === "active") {
    return {
      type: "block_active_subscription",
      source: "legacy",
    } as const;
  }

  if (input.legacySubscription.status === "paused") {
    return {
      type: "block_paused_subscription",
      source: "legacy",
    } as const;
  }

  if (input.legacySubscription.status === "pending") {
    return resolvePendingCheckoutFlow({
      selectedPlanId: input.selectedPlanId,
      selectedBillingCycle: input.selectedBillingCycle,
      currentPlanId: input.legacySubscription.planId,
      currentBillingCycle: input.legacySubscription.billingCycle,
      subscriptionId: input.legacySubscription.mercadoPagoSubscriptionId,
      source: "legacy",
    });
  }

  return {
    type: "create_new_checkout",
    source: "none",
  } as const;
}

function resolvePendingCheckoutFlow(input: {
  selectedPlanId: WorkspacePlanId;
  selectedBillingCycle: BillingCycle;
  currentPlanId: WorkspacePlanId;
  currentBillingCycle: BillingCycle;
  subscriptionId: string | null;
  source: PendingCheckoutSource;
}) {
  if (
    input.currentPlanId === input.selectedPlanId &&
    input.currentBillingCycle === input.selectedBillingCycle &&
    normalizeOptionalString(input.subscriptionId)
  ) {
    return {
      type: "resume_pending_checkout",
      source: input.source,
    } as const;
  }

  return {
    type: "replace_pending_checkout",
    source: input.source,
  } as const;
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}
