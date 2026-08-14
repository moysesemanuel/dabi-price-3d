import {
  findBillingInvoiceByProviderPaymentId,
  getBillingInvoiceById,
  getBillingSubscriptionById,
  updateBillingInvoice,
} from "@/lib/billing/repository";
import { createBillingService } from "@/lib/billing/server-service";
import {
  normalizeBillingManualPaymentState,
  resolveInvoiceStatusFromManualPaymentState,
} from "@/lib/billing/manual-payment-status";
import {
  findPrimaryWorkspaceForUser,
  findUserByEmail,
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
  applyWorkspaceSubscriptionUpdate,
} from "@/lib/server/platform";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import {
  extractMercadoPagoWebhookDataId,
  extractMercadoPagoWebhookTopic,
  getMercadoPagoAccessToken,
  getMercadoPagoAuthorizedPaymentWithToken,
  getMercadoPagoPaymentWithToken,
  getMercadoPagoSubscriptionWithToken,
  getMercadoPagoTestAccessToken,
  getMercadoPagoWebhookSecret,
  normalizeMercadoPagoSubscriptionStatus,
  resolveMercadoPagoWorkspaceHint,
  verifyMercadoPagoWebhookSignature,
  type MercadoPagoPayment,
  type MercadoPagoAuthorizedPayment,
  type MercadoPagoSubscription,
  type MercadoPagoWebhookPayload,
  type MercadoPagoWebhookTopic,
} from "@/lib/payments/mercado-pago";
import { resolveWorkspacePlanIdForSubscription } from "@/lib/payments/subscription-plan-resolution";

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
  const topic = extractMercadoPagoWebhookTopic({ requestUrl, payload });
  const dataId = extractMercadoPagoWebhookDataId({ requestUrl, payload });

  if (!topic || !dataId) {
    logRouteEvent(requestContext, "warn", "mercado_pago_webhook.invalid_payload", {
      topic,
      dataId,
      payload,
    });

    return jsonWithRequestId(
      requestContext,
      {
        error: "Webhook do Mercado Pago sem topic ou data.id.",
        code: "MP_WEBHOOK_INVALID_PAYLOAD",
      },
      { status: 400 },
    );
  }

  const webhookSecret = getMercadoPagoWebhookSecret();
  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
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

  if (
    webhookSecret &&
    !verifyMercadoPagoWebhookSignature({
      xSignature,
      xRequestId,
      dataId,
      secret: webhookSecret,
    })
  ) {
    logRouteEvent(requestContext, "warn", "mercado_pago_webhook.signature_rejected", {
      topic,
      dataId,
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

  try {
    const outcome = await processMercadoPagoWebhookTopic({ topic, dataId, accessToken });

    logRouteEvent(requestContext, outcome.logLevel, outcome.event, outcome.details);

    return jsonWithRequestId(
      requestContext,
      {
        ok: true,
        topic,
        dataId,
        outcome: outcome.body,
      },
      { status: outcome.status },
    );
  } catch (error) {
    logRouteEvent(requestContext, "error", "mercado_pago_webhook.processing_failed", {
      topic,
      dataId,
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

async function processMercadoPagoWebhookTopic(input: {
  topic: MercadoPagoWebhookTopic;
  dataId: string;
  accessToken: string;
}) {
  switch (input.topic) {
    case "subscription_preapproval": {
      const subscription = await getMercadoPagoSubscriptionWithToken(
        input.dataId,
        input.accessToken,
      );
      return syncWorkspaceFromSubscription({
        sourceTopic: input.topic,
        sourceDataId: input.dataId,
        subscription,
        recurringChargeApproved: false,
      });
    }

    case "subscription_authorized_payment": {
      const authorizedPayment = await getMercadoPagoAuthorizedPaymentWithToken(
        input.dataId,
        input.accessToken,
      );
      const preapprovalId = authorizedPayment.preapproval_id?.trim();

      if (!preapprovalId) {
        return {
          status: 202,
          logLevel: "warn" as const,
          event: "mercado_pago_webhook.authorized_payment_without_preapproval",
          details: {
            authorizedPaymentId: input.dataId,
          },
          body: {
            handled: false,
            reason: "authorized_payment_without_preapproval_id",
          },
        };
      }

      const subscription = await getMercadoPagoSubscriptionWithToken(
        preapprovalId,
        input.accessToken,
      );

      return syncWorkspaceFromSubscription({
        sourceTopic: input.topic,
        sourceDataId: input.dataId,
        subscription,
        authorizedPayment,
        recurringChargeApproved:
          authorizedPayment.payment?.status?.trim().toLowerCase() === "approved",
      });
    }

    case "subscription_preapproval_plan": {
      return {
        status: 202,
        logLevel: "info" as const,
        event: "mercado_pago_webhook.subscription_plan_ignored",
        details: {
          mercadoPagoPlanId: input.dataId,
        },
        body: {
          handled: false,
          reason: "subscription_plan_not_used",
        },
      };
    }

    case "payment":
    {
      const payment = await getMercadoPagoPaymentWithToken(
        input.dataId,
        input.accessToken,
      );

      return syncInvoiceFromPayment({
        sourceTopic: input.topic,
        sourceDataId: input.dataId,
        payment,
      });
    }

    default:
      return {
        status: 202,
        logLevel: "info" as const,
        event: "mercado_pago_webhook.topic_ignored",
        details: {
          topic: input.topic,
          dataId: input.dataId,
        },
        body: {
          handled: false,
          reason: "topic_not_implemented",
        },
      };
  }
}

function resolveWebhookAccessToken(liveMode?: boolean) {
  if (liveMode === false) {
    return getMercadoPagoTestAccessToken();
  }

  return getMercadoPagoAccessToken();
}

async function syncWorkspaceFromSubscription(input: {
  sourceTopic: MercadoPagoWebhookTopic;
  sourceDataId: string;
  subscription: MercadoPagoSubscription;
  authorizedPayment?: MercadoPagoAuthorizedPayment;
  recurringChargeApproved: boolean;
}) {
  const subscriptionStatus = normalizeMercadoPagoSubscriptionStatus(
    input.subscription.status,
  );

  const workspaceTarget = await resolveWorkspaceTarget(input.subscription);

  if (!workspaceTarget?.workspaceId) {
    return {
      status: 202,
      logLevel: "warn" as const,
      event: "mercado_pago_webhook.workspace_not_resolved",
      details: {
        topic: input.sourceTopic,
        sourceDataId: input.sourceDataId,
        externalReference: input.subscription.external_reference ?? null,
        backUrl: input.subscription.back_url ?? null,
      },
      body: {
        handled: false,
        reason: "workspace_not_resolved",
      },
    };
  }

  const workspacePreferences = await getWorkspacePreferences(
    workspaceTarget.workspaceId,
  );

  const workspacePlanId = resolveWorkspacePlanIdForSubscription({
    mercadoPagoSubscriptionId: input.subscription.id,
    savedMercadoPagoSubscriptionId:
      workspacePreferences.subscription.mercadoPagoSubscriptionId,
    savedWorkspacePlanId: workspacePreferences.subscription.planId,
  });

  if (!workspacePlanId) {
    return {
      status: 202,
      logLevel: "warn" as const,
      event: "mercado_pago_webhook.plan_not_mapped",
      details: {
        topic: input.sourceTopic,
        sourceDataId: input.sourceDataId,
        workspaceId: workspaceTarget.workspaceId,
        subscriptionId: input.subscription.id,
      },
      body: {
        handled: false,
        reason: "plan_not_mapped",
      },
    };
  }

  const workspaceSubscriptionStatus =
    input.recurringChargeApproved || subscriptionStatus === "active"
      ? "active"
      : subscriptionStatus === "pending" ||
        subscriptionStatus === "paused" ||
        subscriptionStatus === "canceled"
        ? subscriptionStatus
        : null;

  if (!workspaceSubscriptionStatus) {
    return {
      status: 202,
      logLevel: "info" as const,
      event: "mercado_pago_webhook.subscription_status_ignored",
      details: {
        topic: input.sourceTopic,
        sourceDataId: input.sourceDataId,
        workspaceId: workspaceTarget.workspaceId,
        workspacePlanId,
        subscriptionStatus,
        recurringChargeApproved: input.recurringChargeApproved,
      },
      body: {
        handled: false,
        reason: "subscription_status_ignored",
        workspacePlanId,
        subscriptionStatus,
      },
    };
  }

  const syncResult = await applyWorkspaceSubscriptionUpdate({
    workspaceId: workspaceTarget.workspaceId,
    planId: workspacePlanId,
    status: workspaceSubscriptionStatus,
    source: "mercado-pago-webhook",
    mercadoPagoSubscriptionId: input.subscription.id,
    description: `Assinatura Mercado Pago sincronizada via ${input.sourceTopic}. Plano ${workspacePlanId}, status ${workspaceSubscriptionStatus}.`,
  });

  return {
    status: 200,
    logLevel: "info" as const,
    event: "mercado_pago_webhook.subscription_synced",
    details: {
      topic: input.sourceTopic,
      sourceDataId: input.sourceDataId,
      workspaceId: workspaceTarget.workspaceId,
      workspacePlanId,
      changed: syncResult.changed,
      subscriptionId: input.subscription.id,
      authorizedPaymentId: input.authorizedPayment?.id ?? null,
    },
    body: {
      handled: true,
      workspaceId: workspaceTarget.workspaceId,
      workspacePlanId,
      changed: syncResult.changed,
    },
  };
}

async function resolveWorkspaceTarget(subscription: MercadoPagoSubscription) {
  const hint = resolveMercadoPagoWorkspaceHint({
    externalReference: subscription.external_reference,
    backUrl: subscription.back_url,
  });

  if (hint?.workspaceId) {
    return {
      workspaceId: hint.workspaceId,
    };
  }

  if (hint?.email) {
    const userByHintEmail = await findUserByEmail(hint.email);

    if (userByHintEmail) {
      const primaryWorkspace = await findPrimaryWorkspaceForUser(userByHintEmail.id);

      if (primaryWorkspace) {
        return {
          workspaceId: primaryWorkspace.workspace_id,
        };
      }
    }
  }

  const payerEmail =
    typeof subscription.payer_email === "string"
      ? subscription.payer_email.trim().toLowerCase()
      : "";

  if (!payerEmail) {
    return null;
  }

  const user = await findUserByEmail(payerEmail);

  if (!user) {
    return null;
  }

  const primaryWorkspace = await findPrimaryWorkspaceForUser(user.id);

  if (!primaryWorkspace) {
    return null;
  }

  return {
    workspaceId: primaryWorkspace.workspace_id,
  };
}

async function syncInvoiceFromPayment(input: {
  sourceTopic: MercadoPagoWebhookTopic;
  sourceDataId: string;
  payment: MercadoPagoPayment;
}) {
  const invoice = await resolveInvoiceTarget(input.payment);

  if (!invoice) {
    return {
      status: 202,
      logLevel: "warn" as const,
      event: "mercado_pago_webhook.invoice_not_resolved",
      details: {
        topic: input.sourceTopic,
        sourceDataId: input.sourceDataId,
        externalReference: input.payment.external_reference ?? null,
        paymentId: String(input.payment.id),
      },
      body: {
        handled: false,
        reason: "invoice_not_resolved",
      },
    };
  }

  const subscription = await getBillingSubscriptionById(invoice.subscriptionId);

  if (!subscription) {
    return {
      status: 202,
      logLevel: "warn" as const,
      event: "mercado_pago_webhook.invoice_subscription_missing",
      details: {
        topic: input.sourceTopic,
        sourceDataId: input.sourceDataId,
        invoiceId: invoice.id,
        subscriptionId: invoice.subscriptionId,
      },
      body: {
        handled: false,
        reason: "invoice_subscription_missing",
      },
    };
  }

  const paymentState = normalizeBillingManualPaymentState(input.payment.status);
  const nextInvoiceStatus = resolveInvoiceStatusFromManualPaymentState(paymentState);

  if (!nextInvoiceStatus) {
    return {
      status: 202,
      logLevel: "info" as const,
      event: "mercado_pago_webhook.payment_status_ignored",
      details: {
        topic: input.sourceTopic,
        sourceDataId: input.sourceDataId,
        invoiceId: invoice.id,
        paymentId: String(input.payment.id),
        paymentStatus: input.payment.status ?? null,
      },
      body: {
        handled: false,
        reason: "payment_status_ignored",
      },
    };
  }

  const nowIso = new Date().toISOString();
  await updateBillingInvoice(invoice.id, {
    status: nextInvoiceStatus,
    provider: "mercado_pago",
    providerPaymentId: String(input.payment.id),
    paymentMethod:
      input.payment.payment_method_id?.trim().toLowerCase() === "pix"
        ? "pix_manual"
        : invoice.paymentMethod,
    paymentExpiresAt: input.payment.date_of_expiration ?? invoice.paymentExpiresAt,
    paidAt:
      nextInvoiceStatus === "paid"
        ? input.payment.date_approved ?? invoice.paidAt ?? nowIso
        : invoice.paidAt,
    failedAt:
      nextInvoiceStatus === "failed" || nextInvoiceStatus === "expired"
        ? invoice.failedAt ?? nowIso
        : invoice.failedAt,
  });

  if (nextInvoiceStatus !== "paid") {
    return {
      status: 200,
      logLevel: "info" as const,
      event: "mercado_pago_webhook.invoice_synced",
      details: {
        topic: input.sourceTopic,
        sourceDataId: input.sourceDataId,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
        paymentStatus: input.payment.status ?? null,
        invoiceStatus: nextInvoiceStatus,
      },
      body: {
        handled: true,
        invoiceId: invoice.id,
        invoiceStatus: nextInvoiceStatus,
      },
    };
  }

  const billingService = createBillingService();
  const currentPeriodStart = input.payment.date_approved ?? nowIso;
  const currentPeriodEnd = addBillingCycle(currentPeriodStart, subscription.billingCycle);

  if (subscription.status === "pending") {
    await billingService.activateSubscription(subscription.id, {
      actorType: "webhook",
      currentPeriodStart,
      currentPeriodEnd,
      accessUntil: currentPeriodEnd,
    });
  }

  const syncResult = await applyWorkspaceSubscriptionUpdate({
    workspaceId: subscription.workspaceId,
    planId: subscription.planId,
    status: "active",
    source: "mercado-pago-webhook-payment",
    mercadoPagoSubscriptionId: null,
    description: `Pagamento manual Mercado Pago aprovado via ${input.sourceTopic}. Invoice ${invoice.id} paga e assinatura ativada.`,
  });

  return {
    status: 200,
    logLevel: "info" as const,
    event: "mercado_pago_webhook.manual_payment_activated",
    details: {
      topic: input.sourceTopic,
      sourceDataId: input.sourceDataId,
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      changed: syncResult.changed,
    },
    body: {
      handled: true,
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      activated: true,
    },
  };
}

async function resolveInvoiceTarget(payment: MercadoPagoPayment) {
  const externalReference =
    typeof payment.external_reference === "string" ||
      typeof payment.external_reference === "number"
      ? String(payment.external_reference).trim()
      : "";

  if (externalReference.startsWith("billing_invoice:")) {
    const invoiceId = externalReference.slice("billing_invoice:".length).trim();

    if (invoiceId) {
      const invoice = await getBillingInvoiceById(invoiceId);

      if (invoice) {
        return invoice;
      }
    }
  }

  return findBillingInvoiceByProviderPaymentId({
    provider: "mercado_pago",
    providerPaymentId: String(payment.id),
  });
}

function addBillingCycle(startAt: string, billingCycle: "monthly" | "annual") {
  const startDate = new Date(startAt);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error(`Invalid start date for billing cycle: ${startAt}`);
  }

  if (billingCycle === "annual") {
    startDate.setFullYear(startDate.getFullYear() + 1);
  } else {
    startDate.setMonth(startDate.getMonth() + 1);
  }

  return startDate.toISOString();
}
