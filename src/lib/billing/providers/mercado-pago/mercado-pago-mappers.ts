import {
  normalizeMercadoPagoSubscriptionStatus,
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoSubscription,
} from "../../../payments/mercado-pago.ts";
import type {
  BillingProviderPayment,
  BillingProviderRecurringSubscription,
} from "../billing-provider.ts";

export function mapMercadoPagoSubscriptionToBillingSubscription(
  subscription: MercadoPagoSubscription,
): BillingProviderRecurringSubscription {
  return {
    provider: "mercado_pago",
    providerSubscriptionId: subscription.id,
    status: normalizeMercadoPagoSubscriptionStatus(subscription.status),
    checkoutUrl: normalizeOptionalString(subscription.init_point),
    externalReference: normalizeOptionalString(subscription.external_reference),
    payerEmail: normalizeOptionalString(subscription.payer_email),
  };
}

export function mapMercadoPagoAuthorizedPaymentToBillingPayment(
  authorizedPayment: MercadoPagoAuthorizedPayment,
): BillingProviderPayment {
  return {
    provider: "mercado_pago",
    providerPaymentId:
      normalizeOptionalString(authorizedPayment.payment?.id) ??
      String(authorizedPayment.id),
    providerAuthorizedPaymentId: String(authorizedPayment.id),
    status:
      normalizeOptionalString(authorizedPayment.payment?.status) ??
      normalizeOptionalString(authorizedPayment.status),
    providerSubscriptionId:
      normalizeOptionalString(authorizedPayment.preapproval_id) ?? null,
    externalReference: normalizeOptionalString(authorizedPayment.external_reference),
    paymentMethod: null,
  };
}

function normalizeOptionalString(value: unknown) {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}
