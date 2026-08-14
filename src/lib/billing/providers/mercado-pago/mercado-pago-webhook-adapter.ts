import { createHash } from "node:crypto";
import {
  extractMercadoPagoWebhookDataId,
  extractMercadoPagoWebhookTopic,
  getMercadoPagoAuthorizedPaymentWithToken,
  getMercadoPagoPaymentWithToken,
  getMercadoPagoSubscriptionWithToken,
  normalizeMercadoPagoSubscriptionStatus,
  resolveMercadoPagoWorkspaceHint,
  type MercadoPagoWebhookPayload,
} from "../../../payments/mercado-pago.ts";
import type { BillingWebhookNormalizedEvent } from "../../webhook-service.ts";

export function resolveMercadoPagoWebhookEnvelope(input: {
  requestUrl: URL;
  payload: MercadoPagoWebhookPayload | null;
  xRequestId: string | null;
}) {
  const topic = extractMercadoPagoWebhookTopic({
    requestUrl: input.requestUrl,
    payload: input.payload,
  });
  const dataId = extractMercadoPagoWebhookDataId({
    requestUrl: input.requestUrl,
    payload: input.payload,
  });
  const providerEventId =
    normalizeOptionalString(input.xRequestId) ??
    normalizeOptionalString(input.payload?.id) ??
    (topic && dataId ? `${topic}:${dataId}` : null);

  return {
    topic,
    dataId,
    providerEventId,
    payloadHash: createHash("sha256")
      .update(JSON.stringify(input.payload ?? null))
      .digest("hex"),
  };
}

export async function normalizeMercadoPagoWebhookEvent(input: {
  topic: string;
  dataId: string;
  accessToken: string;
  providerEventId: string;
  payloadHash: string;
}) {
  switch (input.topic) {
    case "subscription_preapproval": {
      const subscription = await getMercadoPagoSubscriptionWithToken(
        input.dataId,
        input.accessToken,
      );
      const workspaceHint = resolveMercadoPagoWorkspaceHint({
        externalReference: subscription.external_reference,
        backUrl: subscription.back_url,
      });

      return {
        provider: "mercado_pago",
        providerEventId: input.providerEventId,
        eventType: input.topic,
        resourceId: input.dataId,
        payloadHash: input.payloadHash,
        kind: "subscription",
        sourceTopic: input.topic,
        recurringChargeApproved: false,
        subscription: {
          providerSubscriptionId: subscription.id,
          status: normalizeMercadoPagoSubscriptionStatus(subscription.status),
          externalReference: normalizeOptionalString(
            subscription.external_reference,
          ),
          payerEmail: normalizeOptionalString(subscription.payer_email),
          workspaceHints: {
            workspaceId: workspaceHint?.workspaceId ?? null,
            email:
              workspaceHint?.email ??
              normalizeOptionalString(subscription.payer_email),
          },
        },
      } satisfies BillingWebhookNormalizedEvent;
    }

    case "subscription_authorized_payment": {
      const authorizedPayment = await getMercadoPagoAuthorizedPaymentWithToken(
        input.dataId,
        input.accessToken,
      );
      const preapprovalId = normalizeOptionalString(
        authorizedPayment.preapproval_id,
      );

      if (!preapprovalId) {
        return {
          provider: "mercado_pago",
          providerEventId: input.providerEventId,
          eventType: input.topic,
          resourceId: input.dataId,
          payloadHash: input.payloadHash,
          kind: "ignored",
          sourceTopic: input.topic,
          reason: "authorized_payment_without_preapproval_id",
          details: {
            authorizedPaymentId: input.dataId,
          },
        } satisfies BillingWebhookNormalizedEvent;
      }

      const subscription = await getMercadoPagoSubscriptionWithToken(
        preapprovalId,
        input.accessToken,
      );
      const workspaceHint = resolveMercadoPagoWorkspaceHint({
        externalReference: subscription.external_reference,
        backUrl: subscription.back_url,
      });

      return {
        provider: "mercado_pago",
        providerEventId: input.providerEventId,
        eventType: input.topic,
        resourceId: input.dataId,
        payloadHash: input.payloadHash,
        kind: "subscription",
        sourceTopic: input.topic,
        recurringChargeApproved:
          normalizeOptionalString(authorizedPayment.payment?.status) ===
          "approved",
        authorizedPaymentId: String(authorizedPayment.id),
        subscription: {
          providerSubscriptionId: subscription.id,
          status: normalizeMercadoPagoSubscriptionStatus(subscription.status),
          externalReference: normalizeOptionalString(
            subscription.external_reference,
          ),
          payerEmail: normalizeOptionalString(subscription.payer_email),
          workspaceHints: {
            workspaceId: workspaceHint?.workspaceId ?? null,
            email:
              workspaceHint?.email ??
              normalizeOptionalString(subscription.payer_email),
          },
        },
      } satisfies BillingWebhookNormalizedEvent;
    }

    case "payment": {
      const payment = await getMercadoPagoPaymentWithToken(
        input.dataId,
        input.accessToken,
      );

      return {
        provider: "mercado_pago",
        providerEventId: input.providerEventId,
        eventType: input.topic,
        resourceId: input.dataId,
        payloadHash: input.payloadHash,
        kind: "manual_payment",
        sourceTopic: input.topic,
        manualPayment: {
          providerPaymentId: String(payment.id),
          status:
            normalizeOptionalString(payment.status) ??
            normalizeOptionalString(payment.status_detail),
          externalReference: normalizeOptionalString(payment.external_reference),
          paymentMethod:
            normalizeOptionalString(payment.payment_method_id) === "pix"
              ? "pix_manual"
              : "unknown",
          expiresAt: normalizeOptionalString(payment.date_of_expiration),
          approvedAt: normalizeOptionalString(payment.date_approved),
        },
      } satisfies BillingWebhookNormalizedEvent;
    }

    case "subscription_preapproval_plan":
      return {
        provider: "mercado_pago",
        providerEventId: input.providerEventId,
        eventType: input.topic,
        resourceId: input.dataId,
        payloadHash: input.payloadHash,
        kind: "ignored",
        sourceTopic: input.topic,
        reason: "subscription_plan_not_used",
        details: {
          mercadoPagoPlanId: input.dataId,
        },
      } satisfies BillingWebhookNormalizedEvent;
    default:
      return {
        provider: "mercado_pago",
        providerEventId: input.providerEventId,
        eventType: input.topic,
        resourceId: input.dataId,
        payloadHash: input.payloadHash,
        kind: "ignored",
        sourceTopic: input.topic,
        reason: "topic_not_implemented",
        details: {
          topic: input.topic,
          dataId: input.dataId,
        },
      } satisfies BillingWebhookNormalizedEvent;
  }
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
