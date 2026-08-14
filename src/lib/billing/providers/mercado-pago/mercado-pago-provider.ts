import {
  createMercadoPagoPixPayment,
  createMercadoPagoRecurringSubscription,
  getMercadoPagoPayment,
  getMercadoPagoAuthorizedPayment,
  getMercadoPagoSubscription,
  updateMercadoPagoSubscriptionAmount,
  updateMercadoPagoSubscriptionStatus,
  type MercadoPagoPayment,
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoSubscription,
} from "../../../payments/mercado-pago.ts";
import type {
  BillingProvider,
  BillingProviderManualPayment,
  BillingProviderManualPaymentInput,
  BillingProviderPayment,
  BillingProviderRecurringSubscription,
  BillingProviderRecurringSubscriptionInput,
  BillingProviderSubscriptionAmountUpdateInput,
} from "../billing-provider.ts";
import type { BillingCycle } from "../../types.ts";
import {
  mapMercadoPagoPaymentToBillingManualPayment,
  mapMercadoPagoAuthorizedPaymentToBillingPayment,
  mapMercadoPagoSubscriptionToBillingSubscription,
} from "./mercado-pago-mappers.ts";

type MercadoPagoProviderDependencies = {
  createRecurringSubscription(
    input: BillingProviderRecurringSubscriptionInput,
  ): Promise<MercadoPagoSubscription>;
  createManualPayment(
    input: BillingProviderManualPaymentInput,
  ): Promise<MercadoPagoPayment>;
  getManualPayment(providerPaymentId: string): Promise<MercadoPagoPayment>;
  getSubscription(providerSubscriptionId: string): Promise<MercadoPagoSubscription>;
  getPayment(providerPaymentId: string): Promise<MercadoPagoAuthorizedPayment>;
  updateSubscriptionStatus(input: {
    subscriptionId: string;
    status: "authorized" | "paused" | "canceled";
  }): Promise<MercadoPagoSubscription>;
  updateSubscriptionAmount(input: {
    subscriptionId: string;
    amountCents: number;
    currency: string;
    billingCycle: BillingCycle;
  }): Promise<MercadoPagoSubscription>;
};

const defaultDependencies: MercadoPagoProviderDependencies = {
  createRecurringSubscription: createMercadoPagoRecurringSubscription,
  createManualPayment: createMercadoPagoPixPayment,
  getManualPayment: getMercadoPagoPayment,
  getSubscription: getMercadoPagoSubscription,
  getPayment: getMercadoPagoAuthorizedPayment,
  updateSubscriptionStatus: updateMercadoPagoSubscriptionStatus,
  updateSubscriptionAmount: updateMercadoPagoSubscriptionAmount,
};

export class MercadoPagoProvider implements BillingProvider {
  readonly name = "mercado_pago" as const;
  private readonly dependencies: MercadoPagoProviderDependencies;

  constructor(dependencies: MercadoPagoProviderDependencies = defaultDependencies) {
    this.dependencies = dependencies;
  }

  async createRecurringSubscription(
    input: BillingProviderRecurringSubscriptionInput,
  ): Promise<BillingProviderRecurringSubscription> {
    const subscription = await this.dependencies.createRecurringSubscription(input);
    return mapMercadoPagoSubscriptionToBillingSubscription(subscription);
  }

  async createManualPayment(
    input: BillingProviderManualPaymentInput,
  ): Promise<BillingProviderManualPayment> {
    const payment = await this.dependencies.createManualPayment(input);
    return mapMercadoPagoPaymentToBillingManualPayment(payment);
  }

  async getManualPayment(
    providerPaymentId: string,
  ): Promise<BillingProviderManualPayment> {
    const payment = await this.dependencies.getManualPayment(providerPaymentId);
    return mapMercadoPagoPaymentToBillingManualPayment(payment);
  }

  async getSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription> {
    const subscription = await this.dependencies.getSubscription(
      providerSubscriptionId,
    );
    return mapMercadoPagoSubscriptionToBillingSubscription(subscription);
  }

  async getPayment(providerPaymentId: string): Promise<BillingProviderPayment> {
    const authorizedPayment = await this.dependencies.getPayment(providerPaymentId);
    return mapMercadoPagoAuthorizedPaymentToBillingPayment(authorizedPayment);
  }

  async cancelSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription> {
    const subscription = await this.dependencies.updateSubscriptionStatus({
      subscriptionId: providerSubscriptionId,
      status: "canceled",
    });

    return mapMercadoPagoSubscriptionToBillingSubscription(subscription);
  }

  async pauseSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription> {
    const subscription = await this.dependencies.updateSubscriptionStatus({
      subscriptionId: providerSubscriptionId,
      status: "paused",
    });

    return mapMercadoPagoSubscriptionToBillingSubscription(subscription);
  }

  async resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<BillingProviderRecurringSubscription> {
    const subscription = await this.dependencies.updateSubscriptionStatus({
      subscriptionId: providerSubscriptionId,
      status: "authorized",
    });

    return mapMercadoPagoSubscriptionToBillingSubscription(subscription);
  }

  async updateSubscriptionAmount(
    input: BillingProviderSubscriptionAmountUpdateInput,
  ): Promise<BillingProviderRecurringSubscription> {
    const subscription = await this.dependencies.updateSubscriptionAmount({
      subscriptionId: input.providerSubscriptionId,
      amountCents: input.amountCents,
      currency: input.currency,
      billingCycle: input.billingCycle,
    });

    return mapMercadoPagoSubscriptionToBillingSubscription(subscription);
  }
}
