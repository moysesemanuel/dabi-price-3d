import type {
  BillingCycle,
  BillingPaymentMethodType,
  BillingProviderName,
} from "../types.ts";

export type BillingProviderRecurringSubscriptionInput = {
  externalReference: string;
  payerEmail: string;
  reason: string;
  returnUrl: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
};

export type BillingProviderRecurringSubscription = {
  provider: BillingProviderName;
  providerSubscriptionId: string;
  status: string | null;
  checkoutUrl: string | null;
  externalReference: string | null;
  payerEmail: string | null;
};

export type BillingProviderPayment = {
  provider: BillingProviderName;
  providerPaymentId: string;
  providerAuthorizedPaymentId: string | null;
  status: string | null;
  providerSubscriptionId: string | null;
  externalReference: string | null;
  paymentMethod: BillingPaymentMethodType | null;
  approvedAt?: string | null;
};

export type BillingProviderManualPaymentInput = {
  externalReference: string;
  idempotencyKey: string;
  payerEmail: string | null;
  reason: string;
  amountCents: number;
  currency: string;
  returnUrl: string | null;
  notificationUrl: string;
};

export type BillingProviderManualPayment = BillingProviderPayment & {
  checkoutUrl: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  expiresAt: string | null;
};

export type BillingProviderSubscriptionAmountUpdateInput = {
  providerSubscriptionId: string;
  amountCents: number;
  currency: string;
  billingCycle: BillingCycle;
};

export interface BillingProvider {
  readonly name: BillingProviderName;

  createRecurringSubscription(
    input: BillingProviderRecurringSubscriptionInput,
  ): Promise<BillingProviderRecurringSubscription>;

  createManualPayment(
    input: BillingProviderManualPaymentInput,
  ): Promise<BillingProviderManualPayment>;

  getManualPayment(
    providerPaymentId: string,
  ): Promise<BillingProviderManualPayment>;

  getSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription>;

  getPayment(providerPaymentId: string): Promise<BillingProviderPayment>;

  listAuthorizedPayments?(
    providerSubscriptionId: string,
  ): Promise<BillingProviderPayment[]>;

  cancelSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription>;

  pauseSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription>;

  resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription>;

  updateSubscriptionAmount(
    input: BillingProviderSubscriptionAmountUpdateInput,
  ): Promise<BillingProviderRecurringSubscription>;
}
