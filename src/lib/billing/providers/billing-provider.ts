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
  status: string | null;
  providerSubscriptionId: string | null;
  externalReference: string | null;
  paymentMethod: BillingPaymentMethodType | null;
};

export interface BillingProvider {
  readonly name: BillingProviderName;

  createRecurringSubscription(
    input: BillingProviderRecurringSubscriptionInput,
  ): Promise<BillingProviderRecurringSubscription>;

  getSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription>;

  getPayment(providerPaymentId: string): Promise<BillingProviderPayment>;

  cancelSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription>;

  pauseSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription>;

  resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription>;
}
