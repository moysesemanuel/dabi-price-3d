import {
  normalizeBillingManualPaymentState,
  resolveInvoiceStatusFromManualPaymentState,
} from "./manual-payment-status.ts";
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
import { resolveWorkspacePlanIdForSubscription } from "../payments/subscription-plan-resolution.ts";

type WorkspacePreferencesLike = {
  subscription: {
    planId: BillingSubscription["planId"];
    mercadoPagoSubscriptionId: string | null;
  };
};

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
  updateInvoice(
    invoiceId: string,
    mutation: Partial<
      Pick<
        BillingInvoice,
        | "status"
        | "provider"
        | "providerPaymentId"
        | "paymentMethod"
        | "paymentExpiresAt"
        | "paidAt"
        | "failedAt"
      >
    >,
  ): Promise<BillingInvoice | null>;
  getSubscriptionById(subscriptionId: string): Promise<BillingSubscription | null>;
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  findPrimaryWorkspaceForUser(
    userId: string,
  ): Promise<{ workspace_id: string } | null>;
  getWorkspacePreferences(workspaceId: string): Promise<WorkspacePreferencesLike>;
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
  billingService: Pick<BillingService, "activateSubscription" | "applyUpgrade">;
  clock?: {
    now(): Date;
  };
};

export class BillingWebhookService {
  private readonly dependencies: BillingWebhookServiceDependencies;

  constructor(dependencies: BillingWebhookServiceDependencies) {
    this.dependencies = dependencies;
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

    await this.dependencies.updateWebhookEventStatus({
      provider: normalizedEvent.provider,
      providerEventId: normalizedEvent.providerEventId,
      eventType: normalizedEvent.eventType,
      status: "processing",
    });

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
    const workspaceTarget = await this.resolveWorkspaceTarget(
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

    const workspacePreferences = await this.dependencies.getWorkspacePreferences(
      workspaceTarget.workspaceId,
    );
    const workspacePlanId = resolveWorkspacePlanIdForSubscription({
      mercadoPagoSubscriptionId:
        normalizedEvent.subscription.providerSubscriptionId,
      savedMercadoPagoSubscriptionId:
        workspacePreferences.subscription.mercadoPagoSubscriptionId,
      savedWorkspacePlanId: workspacePreferences.subscription.planId,
    });

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

  private async syncManualPaymentEvent(
    normalizedEvent: Extract<
      BillingWebhookNormalizedEvent,
      { kind: "manual_payment" }
    >,
  ): Promise<BillingWebhookProcessOutcome> {
    const invoice = await this.resolveInvoiceTarget(normalizedEvent.manualPayment);

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
    await this.dependencies.updateInvoice(invoice.id, {
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

      const syncResult = await applyBillingSubscriptionUpgrade({
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
        event: "billing_webhook.upgrade_applied",
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
          upgraded: true,
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
