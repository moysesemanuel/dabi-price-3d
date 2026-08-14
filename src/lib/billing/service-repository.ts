import type { BillingServiceRepository } from "./service.ts";
import type {
  BillingAuditActorType,
  BillingSubscription,
  BillingSubscriptionStatus,
} from "./types.ts";

type BillingSubscriptionMutation = Partial<
  Pick<
    BillingSubscription,
    | "planId"
    | "billingCycle"
    | "priceId"
    | "status"
    | "autoRenew"
    | "currentPeriodStart"
    | "currentPeriodEnd"
    | "gracePeriodEndsAt"
    | "cancelAtPeriodEnd"
    | "cancelRequestedAt"
    | "endedAt"
    | "accessUntil"
    | "provider"
    | "providerSubscriptionId"
  >
>;

type BillingServiceRepositoryDependencies = {
  createBillingSubscription(input: {
    workspaceId: string;
    planId: BillingSubscription["planId"];
    billingCycle: BillingSubscription["billingCycle"];
    priceId?: string | null;
    status: BillingSubscriptionStatus;
    autoRenew?: boolean;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    gracePeriodEndsAt?: string | null;
    cancelAtPeriodEnd?: boolean;
    cancelRequestedAt?: string | null;
    endedAt?: string | null;
    accessUntil?: string | null;
    provider?: BillingSubscription["provider"];
    providerSubscriptionId?: BillingSubscription["providerSubscriptionId"];
  }): Promise<BillingSubscription | null>;
  getBillingSubscriptionById(subscriptionId: string): Promise<BillingSubscription | null>;
  updateBillingSubscription(
    subscriptionId: string,
    mutation: BillingSubscriptionMutation,
  ): Promise<BillingSubscription | null>;
  appendBillingAuditEvent(input: {
    workspaceId?: string | null;
    subscriptionId?: string | null;
    invoiceId?: string | null;
    actorType: BillingAuditActorType;
    actorId?: string | null;
    action: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<void>;
};

export function createBillingServiceRepository(
  dependencies: BillingServiceRepositoryDependencies,
): BillingServiceRepository {
  return {
    createSubscription(input) {
      return dependencies.createBillingSubscription(input);
    },
    getSubscriptionById(subscriptionId) {
      return dependencies.getBillingSubscriptionById(subscriptionId);
    },
    updateSubscription(subscriptionId, mutation) {
      return dependencies.updateBillingSubscription(subscriptionId, mutation);
    },
    appendAuditEvent(input) {
      return dependencies.appendBillingAuditEvent(input);
    },
  };
}

export type { BillingServiceRepositoryDependencies, BillingSubscriptionMutation };
