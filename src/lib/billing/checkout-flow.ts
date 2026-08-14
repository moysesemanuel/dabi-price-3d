import type { SubscriptionStatus, WorkspacePlanId } from "../workspace/catalog.ts";
import type { BillingPlanId, BillingSubscriptionStatus } from "./types.ts";

export type PendingCheckoutSource = "billing" | "legacy";

type BillingCheckoutSubscription = {
  planId: BillingPlanId;
  status: BillingSubscriptionStatus;
  providerSubscriptionId: string | null;
};

type LegacyCheckoutSubscription = {
  planId: WorkspacePlanId;
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
  billingSubscription: BillingCheckoutSubscription | null;
  legacySubscription: LegacyCheckoutSubscription;
}): SubscriptionCheckoutFlowDecision {
  if (input.billingSubscription) {
    return resolveBillingCheckoutFlow({
      selectedPlanId: input.selectedPlanId,
      billingSubscription: input.billingSubscription,
    });
  }

  return resolveLegacyCheckoutFlow(input);
}

function resolveBillingCheckoutFlow(input: {
  selectedPlanId: WorkspacePlanId;
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
        currentPlanId: input.billingSubscription.planId,
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
      currentPlanId: input.legacySubscription.planId,
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
  currentPlanId: WorkspacePlanId;
  subscriptionId: string | null;
  source: PendingCheckoutSource;
}) {
  if (
    input.currentPlanId === input.selectedPlanId &&
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
