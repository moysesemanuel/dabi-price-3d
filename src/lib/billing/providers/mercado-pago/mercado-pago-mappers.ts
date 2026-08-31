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
  const approvedAt =
    normalizeOptionalString(authorizedPayment.date_approved) ??
      normalizeOptionalString(authorizedPayment.payment?.date_approved);
  const amountCents = normalizeMercadoPagoAmountToCents(
    authorizedPayment.payment?.transaction_amount ??
      authorizedPayment.transaction_amount,
  );
  const currency =
    normalizeOptionalString(authorizedPayment.payment?.currency_id) ??
    normalizeOptionalString(authorizedPayment.currency_id);

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
    ...(approvedAt ? { approvedAt } : {}),
    ...(amountCents !== null ? { amountCents } : {}),
    ...(currency ? { currency } : {}),
  };
}

export function mapMercadoPagoPaymentToBillingManualPayment(
  payment: MercadoPagoPayment,
): BillingProviderManualPayment {
  const approvedAt = normalizeOptionalString(payment.date_approved);
  const amountCents = normalizeMercadoPagoAmountToCents(
    payment.transaction_amount,
  );
  const currency = normalizeOptionalString(payment.currency_id);

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
    ...(approvedAt ? { approvedAt } : {}),
    ...(amountCents !== null ? { amountCents } : {}),
    ...(currency ? { currency } : {}),
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

function normalizeMercadoPagoAmountToCents(value: unknown) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }

  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) {
    return null;
  }

  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
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
