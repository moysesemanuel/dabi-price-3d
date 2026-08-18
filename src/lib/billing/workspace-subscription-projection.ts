import type { WorkspaceSubscription } from "../workspace/catalog.ts";

type WorkspacePreferencesSubscription = WorkspaceSubscription;

type BillingSubscriptionProjectionSnapshot = {
  planId: WorkspacePreferencesSubscription["planId"];
  billingCycle: WorkspacePreferencesSubscription["billingCycle"];
  status: WorkspacePreferencesSubscription["status"];
  providerSubscriptionId: string | null;
} | null;

export function sanitizePersistedWorkspaceSubscription(input: {
  currentSubscription: WorkspacePreferencesSubscription;
  seatsUsed?: number;
  checkoutStartedAt?: string | null;
}) {
  return {
    planId: "starter" as const,
    status: "unpaid" as const,
    billingCycle: "monthly" as const,
    seatsUsed: input.seatsUsed ?? input.currentSubscription.seatsUsed,
    mercadoPagoSubscriptionId: null,
    checkoutStartedAt:
      Object.prototype.hasOwnProperty.call(input, "checkoutStartedAt")
        ? input.checkoutStartedAt ?? null
        : input.currentSubscription.checkoutStartedAt,
  };
}

export function projectWorkspacePreferencesSubscription(input: {
  currentSubscription: WorkspacePreferencesSubscription;
  billingSubscription: BillingSubscriptionProjectionSnapshot;
}) {
  const baseSubscription = sanitizePersistedWorkspaceSubscription({
    currentSubscription: input.currentSubscription,
  });

  if (!input.billingSubscription) {
    return baseSubscription;
  }

  return {
    ...baseSubscription,
    planId: input.billingSubscription.planId,
    billingCycle: input.billingSubscription.billingCycle,
    status: input.billingSubscription.status,
    mercadoPagoSubscriptionId: input.billingSubscription.providerSubscriptionId,
  };
}

export function didProjectedWorkspaceSubscriptionChange(
  currentSubscription: WorkspacePreferencesSubscription,
  nextSubscription: WorkspacePreferencesSubscription,
) {
  return (
    currentSubscription.planId !== nextSubscription.planId ||
    currentSubscription.status !== nextSubscription.status ||
    currentSubscription.billingCycle !== nextSubscription.billingCycle ||
    currentSubscription.mercadoPagoSubscriptionId !==
      nextSubscription.mercadoPagoSubscriptionId ||
    currentSubscription.checkoutStartedAt !== nextSubscription.checkoutStartedAt
  );
}
