import {
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import {
  getMercadoPagoAccessToken,
  getMercadoPagoTestAccessToken,
  getMercadoPagoWebhookSecret,
  verifyMercadoPagoWebhookSignature,
  type MercadoPagoWebhookPayload,
} from "@/lib/payments/mercado-pago";
import {
  normalizeMercadoPagoWebhookEvent,
  resolveMercadoPagoWebhookEnvelope,
} from "@/lib/billing/providers/mercado-pago/mercado-pago-webhook-adapter";
import { createBillingWebhookService } from "@/lib/billing/server-webhook-service";

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/payments/mercado-pago/webhook",
  );

  if (!isPlatformPersistenceAvailable()) {
    logRouteEvent(requestContext, "error", "mercado_pago_webhook.persistence_missing");

    return jsonWithRequestId(
      requestContext,
      {
        error: "Persistência de workspace indisponível sem DATABASE_URL.",
        code: "MP_WEBHOOK_PERSISTENCE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  let payload: MercadoPagoWebhookPayload | null = null;

  try {
    payload = (await request.json()) as MercadoPagoWebhookPayload;
  } catch {
    payload = null;
  }

  const requestUrl = new URL(request.url);
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  const envelope = resolveMercadoPagoWebhookEnvelope({
    requestUrl,
    payload,
    xRequestId,
  });

  if (!envelope.topic || !envelope.dataId || !envelope.providerEventId) {
    logRouteEvent(requestContext, "warn", "mercado_pago_webhook.invalid_payload", {
      topic: envelope.topic,
      dataId: envelope.dataId,
      providerEventId: envelope.providerEventId,
      liveMode: payload?.live_mode ?? null,
    });

    return jsonWithRequestId(
      requestContext,
      {
        error: "Webhook do Mercado Pago sem topic, data.id ou event id.",
        code: "MP_WEBHOOK_INVALID_PAYLOAD",
      },
      { status: 400 },
    );
  }

  const webhookSecret = getMercadoPagoWebhookSecret();

  if (!webhookSecret) {
    logRouteEvent(requestContext, "error", "mercado_pago_webhook.secret_missing", {
      liveMode: payload?.live_mode ?? null,
    });

    return jsonWithRequestId(
      requestContext,
      {
        error: "MERCADO_PAGO_WEBHOOK_SECRET é obrigatório para processar webhooks.",
        code: "MP_WEBHOOK_SECRET_MISSING",
      },
      { status: 503 },
    );
  }

  if (
    !verifyMercadoPagoWebhookSignature({
      xSignature,
      xRequestId,
      dataId: envelope.dataId,
      secret: webhookSecret,
    })
  ) {
    logRouteEvent(requestContext, "warn", "mercado_pago_webhook.signature_rejected", {
      topic: envelope.topic,
      dataId: envelope.dataId,
      providerEventId: envelope.providerEventId,
      xRequestId,
      hasSignature: Boolean(xSignature),
    });

    return jsonWithRequestId(
      requestContext,
      {
        error: "Assinatura do webhook do Mercado Pago inválida.",
        code: "MP_WEBHOOK_INVALID_SIGNATURE",
      },
      { status: 401 },
    );
  }

  const accessToken = resolveWebhookAccessToken(payload?.live_mode);

  if (!accessToken) {
    logRouteEvent(requestContext, "error", "mercado_pago_webhook.access_token_missing", {
      liveMode: payload?.live_mode ?? null,
    });

    return jsonWithRequestId(
      requestContext,
      {
        error:
          payload?.live_mode === false
            ? "MERCADO_PAGO_TEST_ACCESS_TOKEN é obrigatório para consultar webhooks de sandbox do Mercado Pago."
            : "MERCADO_PAGO_ACCESS_TOKEN é obrigatório para consultar o status da assinatura após o webhook.",
        code:
          payload?.live_mode === false
            ? "MP_WEBHOOK_TEST_ACCESS_TOKEN_MISSING"
            : "MP_WEBHOOK_ACCESS_TOKEN_MISSING",
      },
      { status: 503 },
    );
  }

  try {
    const normalizedEvent = await normalizeMercadoPagoWebhookEvent({
      topic: envelope.topic,
      dataId: envelope.dataId,
      accessToken,
      providerEventId: envelope.providerEventId,
      payloadHash: envelope.payloadHash,
    });
    const outcome = await createBillingWebhookService().processEvent(
      normalizedEvent,
    );

    logRouteEvent(requestContext, outcome.logLevel, outcome.event, outcome.details);

    return jsonWithRequestId(
      requestContext,
      {
        ok: true,
        topic: envelope.topic,
        dataId: envelope.dataId,
        providerEventId: envelope.providerEventId,
        outcome: outcome.body,
      },
      { status: outcome.status },
    );
  } catch (error) {
    logRouteEvent(requestContext, "error", "mercado_pago_webhook.processing_failed", {
      topic: envelope.topic,
      dataId: envelope.dataId,
      providerEventId: envelope.providerEventId,
      error: serializeError(error),
    });

    return jsonWithRequestId(
      requestContext,
      {
        error:
          "Falha ao processar a notificação do Mercado Pago. Revise o token, os tópicos configurados e os logs operacionais.",
        code: "MP_WEBHOOK_PROCESSING_FAILED",
      },
      { status: 500 },
    );
  }
}

function resolveWebhookAccessToken(liveMode?: boolean) {
  if (liveMode === false) {
    return getMercadoPagoTestAccessToken();
  }

  return getMercadoPagoAccessToken();
}
