import {
  type MercadoPagoPayment,
  normalizeMercadoPagoSubscriptionStatus,
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoSubscription,
} from "../../../payments/mercado-pago.ts";
import type {
  BillingProviderManualPayment,
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
  const paymentMethod = mapMercadoPagoAutomaticPaymentMethod(
    normalizeOptionalString(authorizedPayment.payment?.payment_method_id) ??
      normalizeOptionalString(authorizedPayment.payment_method_id),
  );

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
    paymentMethod,
  };
}

export function mapMercadoPagoPaymentToBillingManualPayment(
  payment: MercadoPagoPayment,
): BillingProviderManualPayment {
  return {
    provider: "mercado_pago",
    providerPaymentId: normalizeOptionalString(payment.id) ?? "",
    providerAuthorizedPaymentId: null,
    status:
      normalizeOptionalString(payment.status) ??
      normalizeOptionalString(payment.status_detail),
    providerSubscriptionId: null,
    externalReference: normalizeOptionalString(payment.external_reference),
    paymentMethod:
      normalizeOptionalString(payment.payment_method_id) === "pix"
        ? "pix_manual"
        : "unknown",
    checkoutUrl: normalizeOptionalString(
      payment.point_of_interaction?.transaction_data?.ticket_url,
    ),
    qrCode: normalizeOptionalString(
      payment.point_of_interaction?.transaction_data?.qr_code,
    ),
    qrCodeBase64: normalizeOptionalString(
      payment.point_of_interaction?.transaction_data?.qr_code_base64,
    ),
    expiresAt: normalizeOptionalString(payment.date_of_expiration),
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

function mapMercadoPagoAutomaticPaymentMethod(paymentMethodId: string | null) {
  if (!paymentMethodId) {
    return null;
  }

  if (paymentMethodId === "pix") {
    return "pix_automatic" as const;
  }

  if (paymentMethodId === "account_money") {
    return "account_money" as const;
  }

  if (paymentMethodId.startsWith("bol")) {
    return "boleto" as const;
  }

  return null;
}
