import {
  normalizeBillingManualPaymentState,
  resolveInvoiceStatusFromManualPaymentState,
} from "./manual-payment-status.ts";
import { applyBillingSubscriptionCycleChange } from "./cycle-change-management.ts";
import { applyBillingSubscriptionUpgrade } from "./upgrade-management.ts";
import type { BillingPrice } from "./types.ts";
import type { BillingService } from "./service.ts";
import type {
  BillingInvoice,
  BillingPaymentMethodType,
  BillingProviderName,
  BillingSubscription,
  BillingSubscriptionChange,
  BillingWebhookEvent,
  BillingWebhookEventStatus,
} from "./types.ts";

const DEFAULT_PAST_DUE_GRACE_PERIOD_DAYS = 5;

type BillingWebhookActor = {
  providerEventId: string;
  eventType: string;
  resourceId: string | null;
  payloadHash: string;
  provider: BillingProviderName;
};

type BillingWebhookWorkspaceHints = {
  workspaceId: string | null;
  email: string | null;
};

type BillingWebhookSubscriptionPayload = {
  providerSubscriptionId: string;
  status: string | null;
  externalReference: string | null;
  payerEmail: string | null;
  workspaceHints: BillingWebhookWorkspaceHints;
};

type BillingWebhookManualPaymentPayload = {
  providerPaymentId: string;
  status: string | null;
  externalReference: string | null;
  paymentMethod: BillingPaymentMethodType | null;
  expiresAt: string | null;
  approvedAt: string | null;
};

type BillingWebhookAuthorizedPaymentPayload = {
  providerAuthorizedPaymentId: string;
  providerPaymentId: string | null;
  providerSubscriptionId: string;
  status: string | null;
  externalReference: string | null;
  payerEmail: string | null;
  workspaceHints: BillingWebhookWorkspaceHints;
  paymentMethod: BillingPaymentMethodType | null;
  approvedAt: string | null;
};

export type BillingWebhookNormalizedEvent =
  | (BillingWebhookActor & {
      kind: "subscription";
      sourceTopic: string;
      recurringChargeApproved: boolean;
      authorizedPaymentId?: string | null;
      subscription: BillingWebhookSubscriptionPayload;
    })
  | (BillingWebhookActor & {
      kind: "manual_payment";
      sourceTopic: string;
      manualPayment: BillingWebhookManualPaymentPayload;
    })
  | (BillingWebhookActor & {
      kind: "authorized_payment";
      sourceTopic: string;
      authorizedPayment: BillingWebhookAuthorizedPaymentPayload;
    })
  | (BillingWebhookActor & {
      kind: "ignored";
      sourceTopic: string;
      reason: string;
      details?: Record<string, unknown>;
    });

export type BillingWebhookProcessOutcome = {
  status: number;
  logLevel: "info" | "warn" | "error";
  event: string;
  details: Record<string, unknown>;
  body: Record<string, unknown>;
};

export type BillingWebhookServiceDependencies = {
  createWebhookEvent(input: {
    provider: BillingProviderName;
    providerEventId: string;
    eventType: string;
    resourceId?: string | null;
    payloadHash: string;
    status?: BillingWebhookEventStatus;
  }): Promise<BillingWebhookEvent | null>;
  claimWebhookEventProcessing?(input: {
    provider: BillingProviderName;
    providerEventId: string;
    eventType: string;
  }): Promise<BillingWebhookEvent | null>;
  updateWebhookEventStatus(input: {
    provider: BillingProviderName;
    providerEventId: string;
    eventType: string;
    status: BillingWebhookEventStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
    processedAt?: string | null;
  }): Promise<BillingWebhookEvent | null>;
  getInvoiceById(invoiceId: string): Promise<BillingInvoice | null>;
  findInvoiceByProviderPaymentId(input: {
    provider: BillingProviderName;
    providerPaymentId: string;
  }): Promise<BillingInvoice | null>;
  findInvoiceByProviderAuthorizedPaymentId(input: {
    provider: BillingProviderName;
    providerAuthorizedPaymentId: string;
  }): Promise<BillingInvoice | null>;
  createInvoice(input: {
    subscriptionId: string;
    workspaceId: string;
    priceId?: string | null;
    type: BillingInvoice["type"];
    status: BillingInvoice["status"];
    amountCents: number;
    currency?: string;
    periodStart?: string | null;
    periodEnd?: string | null;
    paymentMethod?: BillingPaymentMethodType | null;
    provider?: BillingProviderName | null;
    providerPaymentId?: string | null;
    providerAuthorizedPaymentId?: string | null;
    paidAt?: string | null;
    failedAt?: string | null;
  }): Promise<BillingInvoice | null>;
  updateInvoice(
    invoiceId: string,
    mutation: Partial<
      Pick<
        BillingInvoice,
        | "status"
        | "provider"
        | "providerPaymentId"
        | "providerAuthorizedPaymentId"
        | "paymentMethod"
        | "paymentExpiresAt"
        | "paidAt"
        | "failedAt"
      >
    >,
  ): Promise<BillingInvoice | null>;
  transitionPendingInvoice?(
    invoiceId: string,
    mutation: Partial<
      Pick<
        BillingInvoice,
        | "status"
        | "provider"
        | "providerPaymentId"
        | "providerAuthorizedPaymentId"
        | "paymentMethod"
        | "paymentExpiresAt"
        | "paidAt"
        | "failedAt"
      >
    >,
  ): Promise<BillingInvoice | null>;
  claimInvoiceEffect?(invoiceId: string): Promise<string | null>;
  completeInvoiceEffect?(input: {
    invoiceId: string;
    claimToken: string;
  }): Promise<boolean>;
  releaseInvoiceEffectClaim?(input: {
    invoiceId: string;
    claimToken: string;
  }): Promise<boolean>;
  withSubscriptionOperation?<T>(
    subscriptionId: string,
    operation: () => Promise<T>,
  ): Promise<T>;
  getSubscriptionById(subscriptionId: string): Promise<BillingSubscription | null>;
  findSubscriptionByProviderSubscriptionId(input: {
    provider: BillingProviderName;
    providerSubscriptionId: string;
  }): Promise<BillingSubscription | null>;
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  findPrimaryWorkspaceForUser(
    userId: string,
  ): Promise<{ workspace_id: string } | null>;
  applyWorkspaceSubscriptionUpdate(input: {
    workspaceId: string;
    planId: BillingSubscription["planId"];
    billingCycle?: BillingSubscription["billingCycle"];
    status: "pending" | "active" | "paused" | "canceled";
    source: string;
    mercadoPagoSubscriptionId?: string | null;
    description?: string | null;
  }): Promise<{ changed: boolean }>;
  getSubscriptionChangeByInvoiceId(
    invoiceId: string,
  ): Promise<BillingSubscriptionChange | null>;
  updateSubscriptionChange(
    changeId: string,
    mutation: Partial<
      Pick<
        BillingSubscriptionChange,
        "status" | "appliedAt" | "canceledAt" | "invoiceId"
      >
    >,
  ): Promise<BillingSubscriptionChange | null>;
  findActivePrice(input: {
    planId: BillingSubscription["planId"];
    billingCycle: BillingSubscription["billingCycle"];
    asOf?: string;
  }): Promise<BillingPrice | null>;
  getProvider(
    provider: BillingSubscription["provider"] | BillingInvoice["provider"],
  ): Pick<
    import("./providers/billing-provider.ts").BillingProvider,
    "updateSubscriptionAmount"
  > | null;
  billingService: Pick<
    BillingService,
    | "activateSubscription"
    | "renewSubscription"
    | "markPastDue"
    | "applyUpgrade"
    | "applyCycleChange"
  >;
  clock?: {
    now(): Date;
  };
};

export class BillingWebhookService {
  private readonly dependencies: BillingWebhookServiceDependencies;

  constructor(dependencies: BillingWebhookServiceDependencies) {
    this.dependencies = dependencies;
  }

  private async transitionPendingInvoice(
    invoiceId: string,
    mutation: Parameters<BillingWebhookServiceDependencies["updateInvoice"]>[1],
  ) {
    if (this.dependencies.transitionPendingInvoice) {
      const invoice = await this.dependencies.transitionPendingInvoice(
        invoiceId,
        mutation,
      );

      return { applied: invoice !== null, invoice };
    }

    await this.dependencies.updateInvoice(invoiceId, mutation);
    return { applied: true, invoice: null };
  }

  private async runPaidInvoiceEffect<T>(
    invoiceId: string,
    subscriptionId: string,
    effect: () => Promise<T>,
  ): Promise<{ claimed: boolean; value?: T }> {
    const runEffect = () =>
      this.dependencies.withSubscriptionOperation
        ? this.dependencies.withSubscriptionOperation(subscriptionId, effect)
        : effect();

    if (
      !this.dependencies.claimInvoiceEffect ||
      !this.dependencies.completeInvoiceEffect
    ) {
      return { claimed: true, value: await runEffect() };
    }

    const claimToken = await this.dependencies.claimInvoiceEffect(invoiceId);

    if (!claimToken) {
      return { claimed: false };
    }

    try {
      const value = await runEffect();
      const completed = await this.dependencies.completeInvoiceEffect({
        invoiceId,
        claimToken,
      });

      if (!completed) {
        throw new Error("Billing invoice effect claim was lost before completion.");
      }

      return { claimed: true, value };
    } catch (error) {
      await this.dependencies
        .releaseInvoiceEffectClaim?.({ invoiceId, claimToken })
        .catch(() => undefined);
      throw error;
    }
  }
  async processEvent(
    normalizedEvent: BillingWebhookNormalizedEvent,
  ): Promise<BillingWebhookProcessOutcome> {
    const webhookEvent = await this.dependencies.createWebhookEvent({
      provider: normalizedEvent.provider,
      providerEventId: normalizedEvent.providerEventId,
      eventType: normalizedEvent.eventType,
      resourceId: normalizedEvent.resourceId,
      payloadHash: normalizedEvent.payloadHash,
      status: "received",
    });

    if (!webhookEvent) {
      throw new Error("Failed to create billing webhook event.");
    }

    if (
      webhookEvent.status === "processed" ||
      webhookEvent.status === "ignored"
    ) {
      await this.dependencies.updateWebhookEventStatus({
        provider: normalizedEvent.provider,
        providerEventId: normalizedEvent.providerEventId,
        eventType: normalizedEvent.eventType,
        status: webhookEvent.status,
        processedAt: webhookEvent.processedAt,
        errorCode: webhookEvent.errorCode,
        errorMessage: webhookEvent.errorMessage,
      });

      return {
        status: 200,
        logLevel: "info",
        event: "billing_webhook.duplicate_event",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          finalStatus: webhookEvent.status,
        },
        body: {
          handled: webhookEvent.status === "processed",
          duplicate: true,
          finalStatus: webhookEvent.status,
        },
      };
    }

    const claimedEvent = this.dependencies.claimWebhookEventProcessing
      ? await this.dependencies.claimWebhookEventProcessing({
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
        })
      : null;

    if (this.dependencies.claimWebhookEventProcessing && !claimedEvent) {
      return {
        status: 200,
        logLevel: "info",
        event: "billing_webhook.in_progress_duplicate",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
        },
        body: {
          handled: false,
          duplicate: true,
          finalStatus: "processing",
        },
      };
    }

    if (!this.dependencies.claimWebhookEventProcessing) {
      await this.dependencies.updateWebhookEventStatus({
        provider: normalizedEvent.provider,
        providerEventId: normalizedEvent.providerEventId,
        eventType: normalizedEvent.eventType,
        status: "processing",
      });
    }

    try {
      const outcome = await this.processNormalizedEvent(normalizedEvent);

      await this.dependencies.updateWebhookEventStatus({
        provider: normalizedEvent.provider,
        providerEventId: normalizedEvent.providerEventId,
        eventType: normalizedEvent.eventType,
        status: outcome.body.handled === false ? "ignored" : "processed",
        processedAt: this.now().toISOString(),
        errorCode: null,
        errorMessage: null,
      });

      return outcome;
    } catch (error) {
      await this.dependencies.updateWebhookEventStatus({
        provider: normalizedEvent.provider,
        providerEventId: normalizedEvent.providerEventId,
        eventType: normalizedEvent.eventType,
        status: "failed",
        errorCode: "BILLING_WEBHOOK_PROCESSING_FAILED",
        errorMessage: serializeErrorMessage(error),
      });

      throw error;
    }
  }

  private async processNormalizedEvent(
    normalizedEvent: BillingWebhookNormalizedEvent,
  ): Promise<BillingWebhookProcessOutcome> {
    switch (normalizedEvent.kind) {
      case "ignored":
        return {
          status: 202,
          logLevel: "info",
          event: "billing_webhook.event_ignored",
          details: {
            provider: normalizedEvent.provider,
            providerEventId: normalizedEvent.providerEventId,
            eventType: normalizedEvent.eventType,
            resourceId: normalizedEvent.resourceId,
            reason: normalizedEvent.reason,
            ...(normalizedEvent.details ?? {}),
          },
          body: {
            handled: false,
            reason: normalizedEvent.reason,
          },
        };
      case "subscription":
        return this.syncSubscriptionEvent(normalizedEvent);
      case "authorized_payment":
        return this.syncAuthorizedPaymentEvent(normalizedEvent);
      case "manual_payment":
        return this.syncManualPaymentEvent(normalizedEvent);
    }
  }

  private async syncSubscriptionEvent(
    normalizedEvent: Extract<
      BillingWebhookNormalizedEvent,
      { kind: "subscription" }
    >,
  ): Promise<BillingWebhookProcessOutcome> {
    const localSubscription = await this.resolveLocalSubscriptionFromWebhook(
      normalizedEvent.provider,
      normalizedEvent.subscription.providerSubscriptionId,
      normalizedEvent.subscription.externalReference,
    );
    const workspaceTarget = localSubscription
      ? {
          workspaceId: localSubscription.workspaceId,
        }
      : await this.resolveWorkspaceTarget(
          normalizedEvent.subscription.workspaceHints,
          normalizedEvent.subscription.payerEmail,
        );

    if (!workspaceTarget?.workspaceId) {
      return {
        status: 202,
        logLevel: "warn",
        event: "billing_webhook.workspace_not_resolved",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          externalReference: normalizedEvent.subscription.externalReference,
          payerEmail: normalizedEvent.subscription.payerEmail,
        },
        body: {
          handled: false,
          reason: "workspace_not_resolved",
        },
      };
    }

    const workspacePlanId = localSubscription?.planId ?? null;

    if (!workspacePlanId) {
      return {
        status: 202,
        logLevel: "warn",
        event: "billing_webhook.plan_not_mapped",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          workspaceId: workspaceTarget.workspaceId,
          providerSubscriptionId:
            normalizedEvent.subscription.providerSubscriptionId,
        },
        body: {
          handled: false,
          reason: "plan_not_mapped",
        },
      };
    }

    const nextStatus = resolveWorkspaceSubscriptionStatus({
      subscriptionStatus: normalizedEvent.subscription.status,
      recurringChargeApproved: normalizedEvent.recurringChargeApproved,
    });

    if (!nextStatus) {
      return {
        status: 202,
        logLevel: "info",
        event: "billing_webhook.subscription_status_ignored",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          workspaceId: workspaceTarget.workspaceId,
          providerSubscriptionId:
            normalizedEvent.subscription.providerSubscriptionId,
          subscriptionStatus: normalizedEvent.subscription.status,
          recurringChargeApproved: normalizedEvent.recurringChargeApproved,
        },
        body: {
          handled: false,
          reason: "subscription_status_ignored",
        },
      };
    }

    const syncResult = await this.dependencies.applyWorkspaceSubscriptionUpdate({
      workspaceId: workspaceTarget.workspaceId,
      planId: workspacePlanId,
      status: nextStatus,
      source: "billing-webhook",
      mercadoPagoSubscriptionId:
        normalizedEvent.subscription.providerSubscriptionId,
      description: `Assinatura sincronizada via ${normalizedEvent.sourceTopic}.`,
    });

    return {
      status: 200,
      logLevel: "info",
      event: "billing_webhook.subscription_synced",
      details: {
        provider: normalizedEvent.provider,
        providerEventId: normalizedEvent.providerEventId,
        eventType: normalizedEvent.eventType,
        resourceId: normalizedEvent.resourceId,
        workspaceId: workspaceTarget.workspaceId,
        workspacePlanId,
        changed: syncResult.changed,
        providerSubscriptionId:
          normalizedEvent.subscription.providerSubscriptionId,
        authorizedPaymentId: normalizedEvent.authorizedPaymentId ?? null,
      },
      body: {
        handled: true,
        workspaceId: workspaceTarget.workspaceId,
        workspacePlanId,
        changed: syncResult.changed,
      },
    };
  }

  private async resolveLocalSubscriptionFromWebhook(
    provider: BillingProviderName,
    providerSubscriptionId: string,
    externalReference: string | null,
  ) {
    const localByProviderSubscriptionId =
      await this.dependencies.findSubscriptionByProviderSubscriptionId({
        provider,
        providerSubscriptionId,
      });

    if (localByProviderSubscriptionId) {
      return localByProviderSubscriptionId;
    }

    const localSubscriptionId =
      extractBillingSubscriptionIdFromExternalReference(externalReference);

    if (!localSubscriptionId) {
      return null;
    }

    return this.dependencies.getSubscriptionById(localSubscriptionId);
  }

  private async syncAuthorizedPaymentEvent(
    normalizedEvent: Extract<
      BillingWebhookNormalizedEvent,
      { kind: "authorized_payment" }
    >,
  ): Promise<BillingWebhookProcessOutcome> {
    const subscription =
      await this.dependencies.findSubscriptionByProviderSubscriptionId({
        provider: normalizedEvent.provider,
        providerSubscriptionId:
          normalizedEvent.authorizedPayment.providerSubscriptionId,
      });

    if (!subscription) {
      return {
        status: 202,
        logLevel: "warn",
        event: "billing_webhook.authorized_payment_subscription_not_resolved",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          providerAuthorizedPaymentId:
            normalizedEvent.authorizedPayment.providerAuthorizedPaymentId,
          providerSubscriptionId:
            normalizedEvent.authorizedPayment.providerSubscriptionId,
        },
        body: {
          handled: false,
          reason: "subscription_not_resolved",
        },
      };
    }

    const invoiceType = resolveAuthorizedPaymentInvoiceType(subscription.status);

    if (!invoiceType) {
      return {
        status: 202,
        logLevel: "warn",
        event: "billing_webhook.authorized_payment_ignored",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          providerAuthorizedPaymentId:
            normalizedEvent.authorizedPayment.providerAuthorizedPaymentId,
        },
        body: {
          handled: false,
          reason: "subscription_status_not_chargeable",
        },
      };
    }

    const paymentState = normalizeBillingManualPaymentState(
      normalizedEvent.authorizedPayment.status,
    );
    const nextInvoiceStatus =
      resolveInvoiceStatusFromManualPaymentState(paymentState);

    if (!nextInvoiceStatus) {
      return {
        status: 202,
        logLevel: "info",
        event: "billing_webhook.authorized_payment_status_ignored",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          subscriptionId: subscription.id,
          paymentStatus: normalizedEvent.authorizedPayment.status,
        },
        body: {
          handled: false,
          reason: "payment_status_ignored",
        },
      };
    }

    const nowIso = this.now().toISOString();
    const effectivePaidAt =
      normalizedEvent.authorizedPayment.approvedAt ??
      (nextInvoiceStatus === "paid" ? nowIso : null);

    let invoice =
      await this.dependencies.findInvoiceByProviderAuthorizedPaymentId({
        provider: normalizedEvent.provider,
        providerAuthorizedPaymentId:
          normalizedEvent.authorizedPayment.providerAuthorizedPaymentId,
      });

    if (
      !invoice &&
      normalizedEvent.authorizedPayment.providerPaymentId
    ) {
      invoice = await this.dependencies.findInvoiceByProviderPaymentId({
        provider: normalizedEvent.provider,
        providerPaymentId: normalizedEvent.authorizedPayment.providerPaymentId,
      });
    }

    if (!invoice) {
      const activePrice = await this.dependencies.findActivePrice({
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        asOf: effectivePaidAt ?? nowIso,
      });

      if (!activePrice) {
        return {
          status: 202,
          logLevel: "warn",
          event: "billing_webhook.authorized_payment_price_not_resolved",
          details: {
            provider: normalizedEvent.provider,
            providerEventId: normalizedEvent.providerEventId,
            eventType: normalizedEvent.eventType,
            resourceId: normalizedEvent.resourceId,
            subscriptionId: subscription.id,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
          },
          body: {
            handled: false,
            reason: "price_not_resolved",
          },
        };
      }

      const periodStart = resolveAuthorizedPaymentPeriodStart({
        invoiceType,
        subscription,
        approvedAt: effectivePaidAt ?? nowIso,
      });
      const periodEnd = addBillingCycle(periodStart, subscription.billingCycle);

      invoice = await this.dependencies.createInvoice({
        subscriptionId: subscription.id,
        workspaceId: subscription.workspaceId,
        priceId: activePrice.id,
        type: invoiceType,
        status: "pending",
        amountCents: activePrice.amountCents,
        currency: activePrice.currency,
        periodStart,
        periodEnd,
        paymentMethod:
          normalizedEvent.authorizedPayment.paymentMethod ?? "unknown",
        provider: normalizedEvent.provider,
        providerPaymentId:
          normalizedEvent.authorizedPayment.providerPaymentId ?? null,
        providerAuthorizedPaymentId:
          normalizedEvent.authorizedPayment.providerAuthorizedPaymentId,
        paidAt: null,
        failedAt: null,
      });

      if (!invoice) {
        invoice = await this.dependencies.findInvoiceByProviderAuthorizedPaymentId({
          provider: normalizedEvent.provider,
          providerAuthorizedPaymentId:
            normalizedEvent.authorizedPayment.providerAuthorizedPaymentId,
        });
      }

      if (!invoice && normalizedEvent.authorizedPayment.providerPaymentId) {
        invoice = await this.dependencies.findInvoiceByProviderPaymentId({
          provider: normalizedEvent.provider,
          providerPaymentId: normalizedEvent.authorizedPayment.providerPaymentId,
        });
      }

      if (!invoice) {
        throw new Error("Failed to materialize authorized payment invoice.");
      }
    }

    const transitionedInvoice = await this.transitionPendingInvoice(invoice.id, {
      status: nextInvoiceStatus,
      provider: normalizedEvent.provider,
      providerPaymentId:
        normalizedEvent.authorizedPayment.providerPaymentId ??
        invoice.providerPaymentId,
      providerAuthorizedPaymentId:
        normalizedEvent.authorizedPayment.providerAuthorizedPaymentId,
      paymentMethod:
        normalizedEvent.authorizedPayment.paymentMethod ?? invoice.paymentMethod,
      paidAt:
        nextInvoiceStatus === "paid"
          ? effectivePaidAt ?? invoice.paidAt ?? nowIso
          : invoice.paidAt,
      failedAt:
        nextInvoiceStatus === "failed" || nextInvoiceStatus === "expired"
          ? invoice.failedAt ?? nowIso
          : invoice.failedAt,
    });

    if (!transitionedInvoice.applied) {
      return this.createInvoiceAlreadyTransitionedOutcome({
        normalizedEvent,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
      });
    }

    invoice = transitionedInvoice.invoice ?? invoice;

    if (nextInvoiceStatus !== "paid") {
      let effectApplied = false;

      if (invoice.type === "renewal" && subscription.status === "active") {
        await this.dependencies.billingService.markPastDue(subscription.id, {
          actorType: "webhook",
          gracePeriodEndsAt: addDays(this.now(), DEFAULT_PAST_DUE_GRACE_PERIOD_DAYS),
        });
        await this.dependencies.applyWorkspaceSubscriptionUpdate({
          workspaceId: subscription.workspaceId,
          planId: subscription.planId,
          billingCycle: subscription.billingCycle,
          status: "active",
          mercadoPagoSubscriptionId: subscription.providerSubscriptionId,
          source: "billing-webhook-authorized-payment",
          description:
            "Falha na renovação automática registrada com período de tolerância ativo.",
        });
        effectApplied = true;
      }

      return {
        status: 200,
        logLevel: "info",
        event: "billing_webhook.authorized_payment_synced",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          invoiceStatus: nextInvoiceStatus,
          effectApplied,
        },
        body: {
          handled: true,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          invoiceStatus: nextInvoiceStatus,
          effectApplied,
        },
      };
    }

    const paidEffect = await this.runPaidInvoiceEffect(
      invoice.id,
      subscription.id,
      async () => {
      const currentPeriodStart =
        invoice.periodStart ??
        resolveAuthorizedPaymentPeriodStart({
          invoiceType: invoice.type,
          subscription,
          approvedAt: effectivePaidAt ?? nowIso,
        });
      const currentPeriodEnd =
        invoice.periodEnd ?? addBillingCycle(currentPeriodStart, subscription.billingCycle);

      if (invoice.type === "subscription") {
        await this.dependencies.billingService.activateSubscription(subscription.id, {
          actorType: "webhook",
          currentPeriodStart,
          currentPeriodEnd,
          accessUntil: currentPeriodEnd,
        });
      } else if (invoice.type === "renewal") {
        await this.dependencies.billingService.renewSubscription(subscription.id, {
          actorType: "webhook",
          currentPeriodStart,
          currentPeriodEnd,
          accessUntil: currentPeriodEnd,
        });
      } else {
        return {
          status: 200,
          logLevel: "info" as const,
          event: "billing_webhook.authorized_payment_without_effect",
          details: {
            provider: normalizedEvent.provider,
            providerEventId: normalizedEvent.providerEventId,
            eventType: normalizedEvent.eventType,
            resourceId: normalizedEvent.resourceId,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            invoiceType: invoice.type,
          },
          body: {
            handled: true,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            effectApplied: false,
            reason: "invoice_type_not_supported",
          },
        };
      }

      const syncResult = await this.dependencies.applyWorkspaceSubscriptionUpdate({
        workspaceId: subscription.workspaceId,
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        status: "active",
        source: "billing-webhook-authorized-payment",
        mercadoPagoSubscriptionId: subscription.providerSubscriptionId,
        description: `Cobrança recorrente confirmada via ${normalizedEvent.sourceTopic}.`,
      });

      return {
        status: 200,
        logLevel: "info" as const,
        event: "billing_webhook.authorized_payment_applied",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          invoiceType: invoice.type,
          changed: syncResult.changed,
        },
        body: {
          handled: true,
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          renewed: invoice.type === "renewal",
          activated: invoice.type === "subscription",
        },
      };
      },
    );

    if (!paidEffect.claimed || !paidEffect.value) {
      return this.createInvoiceEffectClaimedOutcome({
        normalizedEvent,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
      });
    }

    return paidEffect.value;
  }

  private async syncManualPaymentEvent(
    normalizedEvent: Extract<
      BillingWebhookNormalizedEvent,
      { kind: "manual_payment" }
    >,
  ): Promise<BillingWebhookProcessOutcome> {
    let invoice = await this.resolveInvoiceTarget(normalizedEvent.manualPayment);

    if (!invoice) {
      return {
        status: 202,
        logLevel: "warn",
        event: "billing_webhook.invoice_not_resolved",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          externalReference: normalizedEvent.manualPayment.externalReference,
          providerPaymentId: normalizedEvent.manualPayment.providerPaymentId,
        },
        body: {
          handled: false,
          reason: "invoice_not_resolved",
        },
      };
    }

    const subscription = await this.dependencies.getSubscriptionById(
      invoice.subscriptionId,
    );

    if (!subscription) {
      return {
        status: 202,
        logLevel: "warn",
        event: "billing_webhook.invoice_subscription_missing",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          invoiceId: invoice.id,
          subscriptionId: invoice.subscriptionId,
        },
        body: {
          handled: false,
          reason: "invoice_subscription_missing",
        },
      };
    }

    const paymentState = normalizeBillingManualPaymentState(
      normalizedEvent.manualPayment.status,
    );
    const nextInvoiceStatus =
      resolveInvoiceStatusFromManualPaymentState(paymentState);

    if (!nextInvoiceStatus) {
      return {
        status: 202,
        logLevel: "info",
        event: "billing_webhook.payment_status_ignored",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          invoiceId: invoice.id,
          providerPaymentId: normalizedEvent.manualPayment.providerPaymentId,
          paymentStatus: normalizedEvent.manualPayment.status,
        },
        body: {
          handled: false,
          reason: "payment_status_ignored",
        },
      };
    }

    const nowIso = this.now().toISOString();
    const transitionedInvoice = await this.transitionPendingInvoice(invoice.id, {
      status: nextInvoiceStatus,
      provider: normalizedEvent.provider,
      providerPaymentId: normalizedEvent.manualPayment.providerPaymentId,
      paymentMethod:
        normalizedEvent.manualPayment.paymentMethod ?? invoice.paymentMethod,
      paymentExpiresAt:
        normalizedEvent.manualPayment.expiresAt ?? invoice.paymentExpiresAt,
      paidAt:
        nextInvoiceStatus === "paid"
          ? normalizedEvent.manualPayment.approvedAt ?? invoice.paidAt ?? nowIso
          : invoice.paidAt,
      failedAt:
        nextInvoiceStatus === "failed" || nextInvoiceStatus === "expired"
          ? invoice.failedAt ?? nowIso
          : invoice.failedAt,
    });

    if (!transitionedInvoice.applied) {
      return this.createInvoiceAlreadyTransitionedOutcome({
        normalizedEvent,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
      });
    }

    invoice = transitionedInvoice.invoice ?? invoice;

    if (nextInvoiceStatus !== "paid") {
      if (invoice.type === "upgrade") {
        const change = await this.dependencies.getSubscriptionChangeByInvoiceId(
          invoice.id,
        );

        if (change?.status === "pending_payment") {
          await this.dependencies.updateSubscriptionChange(change.id, {
            status: nextInvoiceStatus === "canceled" ? "canceled" : "failed",
            canceledAt:
              nextInvoiceStatus === "canceled" ? nowIso : change.canceledAt,
          });
        }
      }

      return {
        status: 200,
        logLevel: "info",
        event: "billing_webhook.invoice_synced",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          invoiceStatus: nextInvoiceStatus,
        },
        body: {
          handled: true,
          invoiceId: invoice.id,
          invoiceStatus: nextInvoiceStatus,
          effectApplied: false,
        },
      };
    }

    const paidEffect = await this.runPaidInvoiceEffect(
      invoice.id,
      subscription.id,
      async (): Promise<BillingWebhookProcessOutcome> => {
    if (invoice.type === "upgrade") {
      const change = await this.dependencies.getSubscriptionChangeByInvoiceId(
        invoice.id,
      );

      if (!change) {
        return {
          status: 200,
          logLevel: "warn",
          event: "billing_webhook.upgrade_change_not_resolved",
          details: {
            provider: normalizedEvent.provider,
            providerEventId: normalizedEvent.providerEventId,
            eventType: normalizedEvent.eventType,
            resourceId: normalizedEvent.resourceId,
            invoiceId: invoice.id,
            subscriptionId: subscription.id,
          },
          body: {
            handled: true,
            invoiceId: invoice.id,
            effectApplied: false,
            reason: "upgrade_change_not_resolved",
          },
        };
      }

      if (change.status !== "pending_payment") {
        return {
          status: 200,
          logLevel: "info",
          event: "billing_webhook.upgrade_invoice_ignored",
          details: {
            provider: normalizedEvent.provider,
            providerEventId: normalizedEvent.providerEventId,
            eventType: normalizedEvent.eventType,
            resourceId: normalizedEvent.resourceId,
            invoiceId: invoice.id,
            subscriptionId: subscription.id,
            changeId: change.id,
            changeStatus: change.status,
          },
          body: {
            handled: true,
            invoiceId: invoice.id,
            effectApplied: false,
            reason: "upgrade_change_not_pending_payment",
          },
        };
      }

      if (subscription.status !== "active") {
        return {
          status: 200,
          logLevel: "warn",
          event: "billing_webhook.upgrade_paid_without_active_subscription",
          details: {
            provider: normalizedEvent.provider,
            providerEventId: normalizedEvent.providerEventId,
            eventType: normalizedEvent.eventType,
            resourceId: normalizedEvent.resourceId,
            invoiceId: invoice.id,
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
          },
          body: {
            handled: true,
            invoiceId: invoice.id,
            effectApplied: false,
            reason: "subscription_status_not_upgradable",
          },
        };
      }

      const isCycleChange = change.type === "cycle_change";
      const syncResult = isCycleChange
        ? await applyBillingSubscriptionCycleChange({
            subscription,
            change,
            invoice,
            actorType: "webhook",
            nowIso,
            source: "billing-webhook-cycle-change",
            description: `Mudança de ciclo aplicada via ${normalizedEvent.sourceTopic}.`,
            dependencies: {
              findActivePrice: this.dependencies.findActivePrice,
              getProvider: this.dependencies.getProvider,
              billingService: this.dependencies.billingService,
              updateSubscriptionChange: this.dependencies.updateSubscriptionChange,
              applyWorkspaceSubscriptionUpdate:
                this.dependencies.applyWorkspaceSubscriptionUpdate,
            },
          })
        : await applyBillingSubscriptionUpgrade({
            subscription,
            change,
            invoice,
            actorType: "webhook",
            nowIso,
            source: "billing-webhook-upgrade",
            description: `Upgrade aplicado via ${normalizedEvent.sourceTopic}.`,
            dependencies: {
              findActivePrice: this.dependencies.findActivePrice,
              getProvider: this.dependencies.getProvider,
              billingService: this.dependencies.billingService,
              updateSubscriptionChange: this.dependencies.updateSubscriptionChange,
              applyWorkspaceSubscriptionUpdate:
                this.dependencies.applyWorkspaceSubscriptionUpdate,
            },
          });

      return {
        status: 200,
        logLevel: "info",
        event: isCycleChange
          ? "billing_webhook.cycle_change_applied"
          : "billing_webhook.upgrade_applied",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          changeId: change.id,
          changed: syncResult.changed,
        },
        body: {
          handled: true,
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          upgraded: !isCycleChange,
          cycleChanged: isCycleChange,
        },
      };
    }

    if (invoice.type !== "subscription") {
      return {
        status: 200,
        logLevel: "info",
        event: "billing_webhook.invoice_paid_without_effect",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          invoiceType: invoice.type,
        },
        body: {
          handled: true,
          invoiceId: invoice.id,
          invoiceType: invoice.type,
          effectApplied: false,
        },
      };
    }

    if (subscription.status === "pending") {
      const currentPeriodStart =
        normalizedEvent.manualPayment.approvedAt ?? nowIso;
      const currentPeriodEnd = addBillingCycle(
        currentPeriodStart,
        subscription.billingCycle,
      );

      await this.dependencies.billingService.activateSubscription(subscription.id, {
        actorType: "webhook",
        currentPeriodStart,
        currentPeriodEnd,
        accessUntil: currentPeriodEnd,
      });
    } else if (subscription.status !== "active") {
      return {
        status: 200,
        logLevel: "warn",
        event: "billing_webhook.invoice_paid_without_activation",
        details: {
          provider: normalizedEvent.provider,
          providerEventId: normalizedEvent.providerEventId,
          eventType: normalizedEvent.eventType,
          resourceId: normalizedEvent.resourceId,
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
        },
        body: {
          handled: true,
          invoiceId: invoice.id,
          subscriptionId: subscription.id,
          effectApplied: false,
          reason: "subscription_status_not_activatable",
        },
      };
    }

    const syncResult = await this.dependencies.applyWorkspaceSubscriptionUpdate({
      workspaceId: subscription.workspaceId,
      planId: subscription.planId,
      billingCycle: subscription.billingCycle,
      status: "active",
      source: "billing-webhook-payment",
      mercadoPagoSubscriptionId: null,
      description: `Pagamento aprovado via ${normalizedEvent.sourceTopic}.`,
    });

    return {
      status: 200,
      logLevel: "info",
      event: "billing_webhook.manual_payment_activated",
      details: {
        provider: normalizedEvent.provider,
        providerEventId: normalizedEvent.providerEventId,
        eventType: normalizedEvent.eventType,
        resourceId: normalizedEvent.resourceId,
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
      },
    );

    if (!paidEffect.claimed || !paidEffect.value) {
      return this.createInvoiceEffectClaimedOutcome({
        normalizedEvent,
        invoiceId: invoice.id,
        subscriptionId: subscription.id,
      });
    }

    return paidEffect.value;
  }

  private createInvoiceAlreadyTransitionedOutcome(input: {
    normalizedEvent: Extract<
      BillingWebhookNormalizedEvent,
      { kind: "authorized_payment" | "manual_payment" }
    >;
    invoiceId: string;
    subscriptionId: string;
  }): BillingWebhookProcessOutcome {
    return {
      status: 200,
      logLevel: "info",
      event: "billing_webhook.invoice_already_transitioned",
      details: {
        provider: input.normalizedEvent.provider,
        providerEventId: input.normalizedEvent.providerEventId,
        eventType: input.normalizedEvent.eventType,
        resourceId: input.normalizedEvent.resourceId,
        invoiceId: input.invoiceId,
        subscriptionId: input.subscriptionId,
      },
      body: {
        handled: true,
        duplicate: true,
        invoiceId: input.invoiceId,
        subscriptionId: input.subscriptionId,
        effectApplied: false,
      },
    };
  }

  private createInvoiceEffectClaimedOutcome(input: {
    normalizedEvent: Extract<
      BillingWebhookNormalizedEvent,
      { kind: "authorized_payment" | "manual_payment" }
    >;
    invoiceId: string;
    subscriptionId: string;
  }): BillingWebhookProcessOutcome {
    return {
      status: 200,
      logLevel: "info",
      event: "billing_webhook.invoice_effect_in_progress",
      details: {
        provider: input.normalizedEvent.provider,
        providerEventId: input.normalizedEvent.providerEventId,
        eventType: input.normalizedEvent.eventType,
        resourceId: input.normalizedEvent.resourceId,
        invoiceId: input.invoiceId,
        subscriptionId: input.subscriptionId,
      },
      body: {
        handled: true,
        duplicate: true,
        invoiceId: input.invoiceId,
        subscriptionId: input.subscriptionId,
        effectApplied: false,
        reason: "invoice_effect_in_progress",
      },
    };
  }
  private async resolveWorkspaceTarget(
    workspaceHints: BillingWebhookWorkspaceHints,
    payerEmail: string | null,
  ) {
    if (workspaceHints.workspaceId) {
      return {
        workspaceId: workspaceHints.workspaceId,
      };
    }

    const hintEmail = normalizeEmail(workspaceHints.email);

    if (hintEmail) {
      const userByHintEmail = await this.dependencies.findUserByEmail(hintEmail);

      if (userByHintEmail) {
        const primaryWorkspace = await this.dependencies.findPrimaryWorkspaceForUser(
          userByHintEmail.id,
        );

        if (primaryWorkspace) {
          return {
            workspaceId: primaryWorkspace.workspace_id,
          };
        }
      }
    }

    const normalizedPayerEmail = normalizeEmail(payerEmail);

    if (!normalizedPayerEmail) {
      return null;
    }

    const user = await this.dependencies.findUserByEmail(normalizedPayerEmail);

    if (!user) {
      return null;
    }

    const primaryWorkspace = await this.dependencies.findPrimaryWorkspaceForUser(
      user.id,
    );

    if (!primaryWorkspace) {
      return null;
    }

    return {
      workspaceId: primaryWorkspace.workspace_id,
    };
  }

  private async resolveInvoiceTarget(
    manualPayment: BillingWebhookManualPaymentPayload,
  ) {
    const externalReference = manualPayment.externalReference?.trim() ?? "";

    if (externalReference.startsWith("billing_invoice:")) {
      const invoiceId = externalReference.slice("billing_invoice:".length).trim();

      if (invoiceId) {
        const invoice = await this.dependencies.getInvoiceById(invoiceId);

        if (invoice) {
          return invoice;
        }
      }
    }

    return this.dependencies.findInvoiceByProviderPaymentId({
      provider: "mercado_pago",
      providerPaymentId: manualPayment.providerPaymentId,
    });
  }

  private now() {
    return this.dependencies.clock?.now() ?? new Date();
  }
}

function resolveWorkspaceSubscriptionStatus(input: {
  subscriptionStatus: string | null;
  recurringChargeApproved: boolean;
}) {
  if (input.recurringChargeApproved || input.subscriptionStatus === "active") {
    return "active" as const;
  }

  if (
    input.subscriptionStatus === "pending" ||
    input.subscriptionStatus === "paused" ||
    input.subscriptionStatus === "canceled"
  ) {
    return input.subscriptionStatus;
  }

  return null;
}

function extractBillingSubscriptionIdFromExternalReference(
  externalReference: string | null,
) {
  const normalized = externalReference?.trim() ?? "";

  if (!normalized.startsWith("billing_subscription:")) {
    return null;
  }

  const subscriptionId = normalized
    .slice("billing_subscription:".length)
    .trim();

  return subscriptionId.length > 0 ? subscriptionId : null;
}

function resolveAuthorizedPaymentInvoiceType(
  subscriptionStatus: BillingSubscription["status"],
) {
  switch (subscriptionStatus) {
    case "pending":
      return "subscription" as const;
    case "active":
    case "past_due":
      return "renewal" as const;
    default:
      return null;
  }
}

function resolveAuthorizedPaymentPeriodStart(input: {
  invoiceType: BillingInvoice["type"];
  subscription: BillingSubscription;
  approvedAt: string;
}) {
  if (input.invoiceType === "subscription") {
    return input.approvedAt;
  }

  return input.subscription.currentPeriodEnd ?? input.approvedAt;
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

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function serializeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
