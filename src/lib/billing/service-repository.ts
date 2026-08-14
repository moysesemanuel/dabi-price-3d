import type { BillingServiceRepository } from "./service.ts";
import type {
  BillingAuditActorType,
  BillingCycle,
  BillingInvoice,
  BillingInvoiceStatus,
  BillingInvoiceType,
  BillingPaymentMethodType,
  BillingPlanId,
  BillingProviderName,
  BillingSubscription,
  BillingSubscriptionChange,
  BillingSubscriptionChangeStatus,
  BillingSubscriptionChangeType,
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
  createBillingSubscriptionChange(input: {
    subscriptionId: string;
    workspaceId: string;
    type: BillingSubscriptionChangeType;
    status: BillingSubscriptionChangeStatus;
    fromPlanId?: BillingPlanId | null;
    toPlanId?: BillingPlanId | null;
    fromBillingCycle?: BillingCycle | null;
    toBillingCycle?: BillingCycle | null;
    effectiveAt: string;
    creditAmountCents?: number;
    chargeAmountCents?: number;
    invoiceId?: string | null;
    requestedByType?: BillingAuditActorType | null;
    requestedById?: string | null;
  }): Promise<BillingSubscriptionChange | null>;
  findLatestOpenBillingSubscriptionChange(input: {
    subscriptionId: string;
    type?: BillingSubscriptionChangeType;
  }): Promise<BillingSubscriptionChange | null>;
  updateBillingSubscriptionChange(
    changeId: string,
    mutation: Partial<
      Pick<
        BillingSubscriptionChange,
        "status" | "appliedAt" | "canceledAt" | "invoiceId"
      >
    >,
  ): Promise<BillingSubscriptionChange | null>;
  createBillingInvoice(input: {
    subscriptionId: string;
    workspaceId: string;
    priceId?: string | null;
    type: BillingInvoiceType;
    status: BillingInvoiceStatus;
    amountCents: number;
    currency?: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    paymentMethod?: BillingPaymentMethodType | null;
    provider?: BillingProviderName | null;
    providerPaymentId?: string | null;
    providerAuthorizedPaymentId?: string | null;
    paymentExpiresAt?: string | null;
    paidAt?: string | null;
    failedAt?: string | null;
    refundedAt?: string | null;
  }): Promise<BillingInvoice | null>;
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
    createSubscriptionChange(input) {
      return dependencies.createBillingSubscriptionChange(input);
    },
    findLatestOpenSubscriptionChange(input) {
      return dependencies.findLatestOpenBillingSubscriptionChange(input);
    },
    updateSubscriptionChange(changeId, mutation) {
      return dependencies.updateBillingSubscriptionChange(changeId, mutation);
    },
    createInvoice(input) {
      return dependencies.createBillingInvoice(input);
    },
  };
}

export type { BillingServiceRepositoryDependencies, BillingSubscriptionMutation };
