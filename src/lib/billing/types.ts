export type BillingPlanId = "starter" | "growth" | "scale";
export type BillingCycle = "monthly" | "annual";

export type BillingSubscriptionStatus =
  | "pending"
  | "active"
  | "past_due"
  | "scheduled_cancel"
  | "paused"
  | "canceled"
  | "expired";

export type BillingInvoiceType =
  | "subscription"
  | "renewal"
  | "upgrade"
  | "adjustment";

export type BillingInvoiceStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "refunded"
  | "partially_refunded"
  | "canceled"
  | "charged_back";

export type BillingSubscriptionChangeType =
  | "upgrade"
  | "downgrade"
  | "cycle_change"
  | "cancel"
  | "reactivate";

export type BillingSubscriptionChangeStatus =
  | "pending_payment"
  | "scheduled"
  | "applied"
  | "canceled"
  | "failed";

export type BillingPaymentMethodType =
  | "card"
  | "pix_manual"
  | "pix_automatic"
  | "account_money"
  | "boleto"
  | "unknown";

export type BillingWebhookEventStatus =
  | "received"
  | "processing"
  | "processed"
  | "ignored"
  | "failed";

export type BillingAuditActorType =
  | "user"
  | "super_admin"
  | "system"
  | "webhook";

export type BillingProviderName = "mercado_pago";
export type BillingIsoDateTimeString = string;

export const billingPlanMeta: Record<
  BillingPlanId,
  {
    commercialName: string;
  }
> = {
  starter: {
    commercialName: "DaBi Start",
  },
  growth: {
    commercialName: "DaBi Pro",
  },
  scale: {
    commercialName: "DaBi Max",
  },
};

export const currentBillingSubscriptionStatuses = [
  "pending",
  "active",
  "past_due",
  "scheduled_cancel",
  "paused",
] as const satisfies BillingSubscriptionStatus[];

export const terminalBillingSubscriptionStatuses = [
  "canceled",
  "expired",
] as const satisfies BillingSubscriptionStatus[];

export type BillingPrice = {
  id: string;
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  amountCents: number;
  currency: string;
  activeFrom: BillingIsoDateTimeString;
  activeUntil: BillingIsoDateTimeString | null;
  createdAt: BillingIsoDateTimeString;
  updatedAt: BillingIsoDateTimeString;
};

export type BillingSubscription = {
  id: string;
  workspaceId: string;
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  priceId: string | null;
  status: BillingSubscriptionStatus;
  autoRenew: boolean;
  currentPeriodStart: BillingIsoDateTimeString | null;
  currentPeriodEnd: BillingIsoDateTimeString | null;
  gracePeriodEndsAt: BillingIsoDateTimeString | null;
  cancelAtPeriodEnd: boolean;
  cancelRequestedAt: BillingIsoDateTimeString | null;
  endedAt: BillingIsoDateTimeString | null;
  accessUntil: BillingIsoDateTimeString | null;
  provider: BillingProviderName | null;
  providerSubscriptionId: string | null;
  createdAt: BillingIsoDateTimeString;
  updatedAt: BillingIsoDateTimeString;
};

export type BillingInvoice = {
  id: string;
  subscriptionId: string;
  workspaceId: string;
  priceId: string | null;
  type: BillingInvoiceType;
  status: BillingInvoiceStatus;
  amountCents: number;
  currency: string;
  periodStart: BillingIsoDateTimeString | null;
  periodEnd: BillingIsoDateTimeString | null;
  paymentMethod: BillingPaymentMethodType | null;
  provider: BillingProviderName | null;
  providerPaymentId: string | null;
  providerAuthorizedPaymentId: string | null;
  paymentExpiresAt: BillingIsoDateTimeString | null;
  paidAt: BillingIsoDateTimeString | null;
  failedAt: BillingIsoDateTimeString | null;
  refundedAt: BillingIsoDateTimeString | null;
  createdAt: BillingIsoDateTimeString;
  updatedAt: BillingIsoDateTimeString;
};

export type BillingSubscriptionChange = {
  id: string;
  subscriptionId: string;
  workspaceId: string;
  type: BillingSubscriptionChangeType;
  status: BillingSubscriptionChangeStatus;
  fromPlanId: BillingPlanId | null;
  toPlanId: BillingPlanId | null;
  fromBillingCycle: BillingCycle | null;
  toBillingCycle: BillingCycle | null;
  effectiveAt: BillingIsoDateTimeString;
  creditAmountCents: number;
  chargeAmountCents: number;
  invoiceId: string | null;
  requestedByType: string | null;
  requestedById: string | null;
  createdAt: BillingIsoDateTimeString;
  appliedAt: BillingIsoDateTimeString | null;
  canceledAt: BillingIsoDateTimeString | null;
};

export type BillingPaymentMethod = {
  id: string;
  workspaceId: string;
  type: BillingPaymentMethodType;
  provider: BillingProviderName | null;
  providerPaymentMethodId: string | null;
  providerCustomerId: string | null;
  providerMandateId: string | null;
  label: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: BillingIsoDateTimeString;
  updatedAt: BillingIsoDateTimeString;
};

export type BillingWebhookEvent = {
  id: string;
  provider: BillingProviderName;
  providerEventId: string;
  eventType: string;
  resourceId: string | null;
  payloadHash: string;
  status: BillingWebhookEventStatus;
  attempts: number;
  receivedAt: BillingIsoDateTimeString;
  processedAt: BillingIsoDateTimeString | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: BillingIsoDateTimeString;
  updatedAt: BillingIsoDateTimeString;
};

export type BillingAuditEvent = {
  id: string;
  workspaceId: string | null;
  subscriptionId: string | null;
  invoiceId: string | null;
  actorType: BillingAuditActorType;
  actorId: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: BillingIsoDateTimeString;
};
