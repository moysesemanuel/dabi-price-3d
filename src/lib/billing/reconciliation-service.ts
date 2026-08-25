import type { BillingProvider } from "./providers/billing-provider.ts";
import type { BillingService } from "./service.ts";
import { applyBillingSubscriptionCycleChange } from "./cycle-change-management.ts";
import { applyBillingSubscriptionUpgrade } from "./upgrade-management.ts";
import type {
  BillingInvoice,
  BillingPrice,
  BillingSubscription,
  BillingSubscriptionChange,
  BillingWebhookEvent,
} from "./types.ts";
import {
  normalizeBillingManualPaymentState,
  resolveInvoiceStatusFromManualPaymentState,
} from "./manual-payment-status.ts";

const DEFAULT_PAST_DUE_GRACE_PERIOD_DAYS = 5;

export type BillingReconciliationFindingCode =
  | "provider_subscription_missing"
  | "provider_active_local_pending"
  | "provider_authorized_payment_not_approved"
  | "provider_authorized_payment_correlation_mismatch"
  | "provider_authorized_payment_price_not_resolved"
  | "provider_canceled_local_active"
  | "local_active_without_provider"
  | "invoice_paid_subscription_not_active"
  | "invoice_failed_subscription_active"
  | "scheduled_change_overdue"
  | "webhook_processing_failed";

export type BillingReconciliationFinding = {
  code: BillingReconciliationFindingCode;
  workspaceId?: string | null;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  webhookEventId?: string | null;
  details?: Record<string, unknown>;
};

export type BillingReconciliationRunResult = {
  processed: number;
  changed: number;
  findings: BillingReconciliationFinding[];
};

type ReconciliationClock = {
  now(): Date;
};

type WorkspaceProjectionStatus = "unpaid" | "active" | "paused" | "canceled";

export type BillingReconciliationServiceDependencies = {
  billingService: Pick<
    BillingService,
    | "activateSubscription"
    | "renewSubscription"
    | "markPastDue"
    | "pauseSubscription"
    | "finalizeCancellation"
    | "expireSubscription"
    | "applyUpgrade"
    | "applyCycleChange"
    | "applyScheduledChange"
  >;
  getSubscriptionById(subscriptionId: string): Promise<BillingSubscription | null>;
  listSubscriptionsForProviderReconciliation(
    limit: number,
  ): Promise<BillingSubscription[]>;
  listSubscriptionsForExpiration(asOf: string): Promise<BillingSubscription[]>;
  listSubscriptionsForGracePeriodEnd(asOf: string): Promise<BillingSubscription[]>;
  listSubscriptionsForScheduledCancellation(
    asOf: string,
  ): Promise<BillingSubscription[]>;
  listAbandonedPendingSubscriptions(input: {
    asOf: string;
    startedBefore: string;
  }): Promise<BillingSubscription[]>;
  getInvoiceById(invoiceId: string): Promise<BillingInvoice | null>;
  findInvoiceByProviderPaymentId(input: {
    provider: BillingInvoice["provider"];
    providerPaymentId: string;
  }): Promise<BillingInvoice | null>;
  findInvoiceByProviderAuthorizedPaymentId(input: {
    provider: BillingInvoice["provider"];
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
    paymentMethod?: BillingInvoice["paymentMethod"];
    provider?: BillingInvoice["provider"];
    providerPaymentId?: string | null;
    providerAuthorizedPaymentId?: string | null;
    paidAt?: string | null;
    failedAt?: string | null;
  }): Promise<BillingInvoice | null>;
  listInvoicesForProviderReconciliation(limit: number): Promise<BillingInvoice[]>;
  listInvoicesForExpiration(asOf: string): Promise<BillingInvoice[]>;
  updateInvoice(
    invoiceId: string,
    mutation: Partial<
      Pick<
        BillingInvoice,
        | "status"
        | "paymentExpiresAt"
        | "paidAt"
        | "failedAt"
        | "providerPaymentId"
        | "providerAuthorizedPaymentId"
      >
    >,
  ): Promise<BillingInvoice | null>;
  transitionPendingInvoice?(
    invoiceId: string,
    mutation: Partial<
      Pick<
        BillingInvoice,
        | "status"
        | "paymentExpiresAt"
        | "paidAt"
        | "failedAt"
        | "providerPaymentId"
        | "providerAuthorizedPaymentId"
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
  getSubscriptionChangeByInvoiceId(
    invoiceId: string,
  ): Promise<BillingSubscriptionChange | null>;
  getDueSubscriptionChanges(asOf: string): Promise<BillingSubscriptionChange[]>;
  updateSubscriptionChange(
    changeId: string,
    mutation: Partial<
      Pick<
        BillingSubscriptionChange,
        | "status"
        | "appliedAt"
        | "canceledAt"
      >
    >,
  ): Promise<BillingSubscriptionChange | null>;
  findActivePrice(input: {
    planId: BillingSubscription["planId"];
    billingCycle: BillingSubscription["billingCycle"];
    asOf?: string;
  }): Promise<BillingPrice | null>;
  listFailedWebhookEvents(limit?: number): Promise<BillingWebhookEvent[]>;
  appendAuditEvent(input: {
    workspaceId?: string | null;
    subscriptionId?: string | null;
    invoiceId?: string | null;
    actorType: "system";
    actorId?: string | null;
    action: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<void>;
  applyWorkspaceSubscriptionUpdate(input: {
    workspaceId: string;
    planId: BillingSubscription["planId"];
    billingCycle?: BillingSubscription["billingCycle"];
    status: WorkspaceProjectionStatus;
    source: string;
    mercadoPagoSubscriptionId?: string | null;
    description?: string | null;
  }): Promise<{ changed: boolean }>;
  getProvider(
    provider: BillingSubscription["provider"] | BillingInvoice["provider"],
  ): BillingProvider | null;
  clock?: ReconciliationClock;
  abandonedCheckoutWindowDays?: number;
};

export class BillingReconciliationService {
  private readonly dependencies: BillingReconciliationServiceDependencies;

  constructor(dependencies: BillingReconciliationServiceDependencies) {
    this.dependencies = dependencies;
  }

  private async transitionPendingInvoice(
    invoiceId: string,
    mutation: Parameters<BillingReconciliationServiceDependencies["updateInvoice"]>[1],
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

  private runWithSubscriptionOperation<T>(
    subscriptionId: string,
    operation: () => Promise<T>,
  ) {
    return this.dependencies.withSubscriptionOperation
      ? this.dependencies.withSubscriptionOperation(subscriptionId, operation)
      : operation();
  }

  async reconcileSubscription(
    subscriptionId: string,
  ): Promise<BillingReconciliationRunResult> {
    const subscription = await this.dependencies.getSubscriptionById(subscriptionId);

    if (!subscription) {
      throw new Error(`Billing subscription not found: ${subscriptionId}`);
    }

    if (!subscription.providerSubscriptionId) {
      if (
        subscription.status === "active" ||
        subscription.status === "past_due" ||
        subscription.status === "scheduled_cancel" ||
        subscription.status === "paused"
      ) {
        return singleFinding("local_active_without_provider", {
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          details: {
            subscriptionStatus: subscription.status,
          },
        });
      }

      return emptyRun(1);
    }

    const provider = this.dependencies.getProvider(subscription.provider);

    if (!provider) {
      return singleFinding("provider_subscription_missing", {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        details: {
          provider: subscription.provider,
          providerSubscriptionId: subscription.providerSubscriptionId,
        },
      });
    }

    let remoteSubscription;

    try {
      remoteSubscription = await provider.getSubscription(
        subscription.providerSubscriptionId,
      );
    } catch (error) {
      return singleFinding("provider_subscription_missing", {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        details: {
          provider: subscription.provider,
          providerSubscriptionId: subscription.providerSubscriptionId,
          error: serializeErrorMessage(error),
        },
      });
    }

    if (
      remoteSubscription.status === "active" &&
      subscription.status === "pending"
    ) {
      return this.recoverPendingAuthorizedPayment({ subscription, provider });
    }

    if (
      remoteSubscription.status === "canceled" &&
      subscription.status === "active"
    ) {
      return singleFinding("provider_canceled_local_active", {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        details: {
          providerSubscriptionId: subscription.providerSubscriptionId,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      });
    }

    return emptyRun(1);
  }

  private async recoverPendingAuthorizedPayment(input: {
    subscription: BillingSubscription;
    provider: BillingProvider;
  }): Promise<BillingReconciliationRunResult> {
    const { subscription, provider } = input;
    const providerSubscriptionId = subscription.providerSubscriptionId;

    if (!providerSubscriptionId || !provider.listAuthorizedPayments) {
      return singleFinding("provider_active_local_pending", {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        details: {
          providerSubscriptionId,
          recovery: "authorized_payment_listing_not_supported",
        },
      });
    }

    let authorizedPayments;

    try {
      authorizedPayments = await provider.listAuthorizedPayments(
        providerSubscriptionId,
      );
    } catch (error) {
      return singleFinding("provider_subscription_missing", {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        details: {
          providerSubscriptionId,
          recovery: "authorized_payment_listing_failed",
          error: serializeErrorMessage(error),
        },
      });
    }

    const expectedExternalReference = `billing_subscription:${subscription.id}`;
    const approvedPayments = authorizedPayments.filter(
      (payment) => payment.status === "approved",
    );

    if (approvedPayments.length === 0) {
      return singleFinding("provider_authorized_payment_not_approved", {
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        details: { providerSubscriptionId },
      });
    }

    for (const payment of approvedPayments) {
      if (
        payment.providerSubscriptionId !== providerSubscriptionId ||
        payment.externalReference !== expectedExternalReference
      ) {
        return singleFinding("provider_authorized_payment_correlation_mismatch", {
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          details: {
            providerSubscriptionId,
            paymentProviderSubscriptionId: payment.providerSubscriptionId,
            expectedExternalReference,
            paymentExternalReference: payment.externalReference,
            providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
            providerPaymentId: payment.providerPaymentId,
          },
        });
      }

      if (!payment.providerAuthorizedPaymentId) {
        continue;
      }

      let invoice =
        await this.dependencies.findInvoiceByProviderAuthorizedPaymentId({
          provider: subscription.provider,
          providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
        });

      if (!invoice && payment.providerPaymentId) {
        invoice = await this.dependencies.findInvoiceByProviderPaymentId({
          provider: subscription.provider,
          providerPaymentId: payment.providerPaymentId,
        });
      }

      if (invoice) {
        if (invoice.subscriptionId !== subscription.id) {
          return singleFinding("provider_authorized_payment_correlation_mismatch", {
            workspaceId: subscription.workspaceId,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            details: {
              reason: "invoice_subscription_mismatch",
              invoiceSubscriptionId: invoice.subscriptionId,
              providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
              providerPaymentId: payment.providerPaymentId,
            },
          });
        }

        if (
          invoice.providerAuthorizedPaymentId !== payment.providerAuthorizedPaymentId ||
          invoice.providerPaymentId !== payment.providerPaymentId
        ) {
          invoice =
            (await this.dependencies.updateInvoice(invoice.id, {
              providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
              providerPaymentId: payment.providerPaymentId,
            })) ?? invoice;
        }

        return this.reconcileInvoice(invoice.id);
      }

      const periodStart = payment.approvedAt ?? this.now().toISOString();
      const price = await this.dependencies.findActivePrice({
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        asOf: periodStart,
      });

      if (!price) {
        return singleFinding("provider_authorized_payment_price_not_resolved", {
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          details: {
            providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
            providerPaymentId: payment.providerPaymentId,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
          },
        });
      }

      invoice = await this.dependencies.createInvoice({
        subscriptionId: subscription.id,
        workspaceId: subscription.workspaceId,
        priceId: price.id,
        type: "subscription",
        status: "pending",
        amountCents: price.amountCents,
        currency: price.currency,
        periodStart,
        periodEnd: addBillingCycle(periodStart, subscription.billingCycle),
        paymentMethod: payment.paymentMethod ?? "unknown",
        provider: subscription.provider,
        providerPaymentId: payment.providerPaymentId,
        providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
      });

      if (!invoice) {
        invoice =
          await this.dependencies.findInvoiceByProviderAuthorizedPaymentId({
            provider: subscription.provider,
            providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
          });
      }

      if (!invoice) {
        throw new Error("Failed to materialize recovered authorized payment invoice.");
      }

      return this.reconcileInvoice(invoice.id);
    }

    return singleFinding("provider_authorized_payment_not_approved", {
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription.id,
      details: {
        providerSubscriptionId,
        recovery: "approved_payment_without_authorized_payment_id",
      },
    });
  }

  async reconcileInvoice(invoiceId: string): Promise<BillingReconciliationRunResult> {
    let invoice = await this.dependencies.getInvoiceById(invoiceId);

    if (!invoice) {
      throw new Error(`Billing invoice not found: ${invoiceId}`);
    }

    if (invoice.status === "paid") {
      return this.recoverPaidInvoiceEffect(invoice);
    }

    if (invoice.status !== "pending") {
      return emptyRun(1);
    }

    const provider = this.dependencies.getProvider(invoice.provider);

    if (!provider) {
      return emptyRun(1);
    }

    const payment = await resolveReconciliationPayment(provider, invoice);

    if (!payment) {
      return emptyRun(1);
    }

    const paymentState = normalizeBillingManualPaymentState(payment.status);
    const nextInvoiceStatus =
      resolveInvoiceStatusFromManualPaymentState(paymentState);

    if (!nextInvoiceStatus) {
      return emptyRun(1);
    }

    const nowIso = this.now().toISOString();
    const transitionedInvoice = await this.transitionPendingInvoice(invoice.id, {
      status: nextInvoiceStatus,
      paymentExpiresAt:
        payment.kind === "manual"
          ? payment.record.expiresAt ?? invoice.paymentExpiresAt
          : invoice.paymentExpiresAt,
      providerPaymentId: payment.record.providerPaymentId ?? invoice.providerPaymentId,
      providerAuthorizedPaymentId:
        payment.record.providerAuthorizedPaymentId ??
        invoice.providerAuthorizedPaymentId,
      paidAt:
        nextInvoiceStatus === "paid"
          ? invoice.paidAt ?? nowIso
          : invoice.paidAt,
      failedAt:
        nextInvoiceStatus === "failed" || nextInvoiceStatus === "expired"
          ? invoice.failedAt ?? nowIso
          : invoice.failedAt,
    });

    if (!transitionedInvoice.applied) {
      return emptyRun(1);
    }

    invoice = transitionedInvoice.invoice ?? invoice;

    // A paid invoice must use the durable effect claim before changing the
    // subscription. This also serializes reconciliation with cancellation and
    // webhook effects for the same subscription.
    if (nextInvoiceStatus === "paid") {
      const recovered = await this.recoverPaidInvoiceEffect(invoice);

      return {
        ...recovered,
        changed: recovered.changed + 1,
      };
    }

    const findings: BillingReconciliationFinding[] = [];
    let changed = 1;

    const subscription = await this.dependencies.getSubscriptionById(
      invoice.subscriptionId,
    );

    if (!subscription) {
      return {
        processed: 1,
        changed,
        findings,
      };
    }

    if (invoice.type === "upgrade") {
      const change = await this.dependencies.getSubscriptionChangeByInvoiceId(
        invoice.id,
      );

      if (
        (nextInvoiceStatus === "failed" ||
          nextInvoiceStatus === "expired" ||
          nextInvoiceStatus === "canceled") &&
        change?.status === "pending_payment"
      ) {
        await this.dependencies.updateSubscriptionChange(change.id, {
          status: nextInvoiceStatus === "canceled" ? "canceled" : "failed",
          canceledAt:
            nextInvoiceStatus === "canceled" ? nowIso : change.canceledAt,
        });
        changed += 1;
      }

      return {
        processed: 1,
        changed,
        findings,
      };
    }

    if (invoice.type === "renewal") {
      if (
        (nextInvoiceStatus === "failed" ||
          nextInvoiceStatus === "expired" ||
          nextInvoiceStatus === "canceled") &&
        subscription.status === "active"
      ) {
        findings.push({
          code: "invoice_failed_subscription_active",
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          invoiceId: invoice.id,
          details: {
            invoiceStatus: nextInvoiceStatus,
            autoCorrected: true,
          },
        });

        await this.dependencies.billingService.markPastDue(subscription.id, {
          actorType: "system",
          gracePeriodEndsAt: addDays(this.now(), DEFAULT_PAST_DUE_GRACE_PERIOD_DAYS),
        });
        await this.dependencies.applyWorkspaceSubscriptionUpdate({
          workspaceId: subscription.workspaceId,
          planId: subscription.planId,
          billingCycle: subscription.billingCycle,
          status: "active",
          mercadoPagoSubscriptionId: subscription.providerSubscriptionId,
          source: "billing-reconciliation-renewal-failed",
          description:
            "Reconciliação registrou falha de renovação e iniciou período de tolerância.",
        });
        changed += 1;
      }

      return {
        processed: 1,
        changed,
        findings,
      };
    }

    if (
      (nextInvoiceStatus === "failed" || nextInvoiceStatus === "expired") &&
      subscription.status === "active"
    ) {
      findings.push({
        code: "invoice_failed_subscription_active",
        workspaceId: subscription.workspaceId,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        details: {
          invoiceStatus: nextInvoiceStatus,
        },
      });
    }

    return {
      processed: 1,
      changed,
      findings,
    };
  }

  private async recoverPaidInvoiceEffect(
    invoice: BillingInvoice,
  ): Promise<BillingReconciliationRunResult> {
    const claimToken = this.dependencies.claimInvoiceEffect
      ? await this.dependencies.claimInvoiceEffect(invoice.id)
      : null;

    if (this.dependencies.claimInvoiceEffect && !claimToken) {
      return emptyRun(1);
    }

    let shouldComplete = false;

    try {
      return await this.runWithSubscriptionOperation(
        invoice.subscriptionId,
        async () => {
          const subscription = await this.dependencies.getSubscriptionById(
            invoice.subscriptionId,
          );

          if (!subscription) {
            if (claimToken) {
              await this.dependencies.releaseInvoiceEffectClaim?.({
                invoiceId: invoice.id,
                claimToken,
              });
            }

            return singleFinding("invoice_paid_subscription_not_active", {
              invoiceId: invoice.id,
              details: { reason: "subscription_missing", autoCorrected: false },
            });
          }

      const nowIso = this.now().toISOString();
      const findings: BillingReconciliationFinding[] = [];
      let changed = 0;

      if (invoice.type === "upgrade") {
        const change = await this.dependencies.getSubscriptionChangeByInvoiceId(
          invoice.id,
        );

        if (!change || change.status !== "pending_payment") {
          shouldComplete = true;
        } else if (subscription.status !== "active") {
          findings.push({
            code: "invoice_paid_subscription_not_active",
            workspaceId: subscription.workspaceId,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            details: {
              previousSubscriptionStatus: subscription.status,
              autoCorrected: false,
              invoiceType: invoice.type,
              changeId: change.id,
            },
          });
        } else {
          if (change.type === "cycle_change") {
            await applyBillingSubscriptionCycleChange({
              subscription,
              change,
              invoice,
              actorType: "system",
              nowIso,
              source: "billing-reconciliation-paid-effect-recovery",
              description: `Reconciliação retomou mudança de ciclo da invoice ${invoice.id} paga.`,
              dependencies: {
                findActivePrice: this.dependencies.findActivePrice,
                getProvider: this.dependencies.getProvider,
                billingService: this.dependencies.billingService,
                updateSubscriptionChange: this.dependencies.updateSubscriptionChange,
                applyWorkspaceSubscriptionUpdate:
                  this.dependencies.applyWorkspaceSubscriptionUpdate,
              },
            });
          } else {
            await applyBillingSubscriptionUpgrade({
              subscription,
              change,
              invoice,
              actorType: "system",
              nowIso,
              source: "billing-reconciliation-paid-effect-recovery",
              description: `Reconciliação retomou upgrade da invoice ${invoice.id} paga.`,
              dependencies: {
                findActivePrice: this.dependencies.findActivePrice,
                getProvider: this.dependencies.getProvider,
                billingService: this.dependencies.billingService,
                updateSubscriptionChange: this.dependencies.updateSubscriptionChange,
                applyWorkspaceSubscriptionUpdate:
                  this.dependencies.applyWorkspaceSubscriptionUpdate,
              },
            });
          }
          changed += 1;
          shouldComplete = true;
        }
      } else if (invoice.type === "renewal") {
        const currentPeriodStart =
          invoice.periodStart ?? subscription.currentPeriodEnd ?? nowIso;
        const currentPeriodEnd =
          invoice.periodEnd ?? addBillingCycle(currentPeriodStart, subscription.billingCycle);

        if (
          hasReachedPeriodEnd(subscription.currentPeriodEnd, currentPeriodEnd) &&
          hasReachedPeriodEnd(subscription.accessUntil, currentPeriodEnd)
        ) {
          shouldComplete = true;
        } else if (
          subscription.status === "active" ||
          subscription.status === "past_due"
        ) {
          await this.dependencies.billingService.renewSubscription(subscription.id, {
            actorType: "system",
            currentPeriodStart,
            currentPeriodEnd,
            accessUntil: currentPeriodEnd,
          });
          await this.dependencies.applyWorkspaceSubscriptionUpdate({
            workspaceId: subscription.workspaceId,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
            status: "active",
            mercadoPagoSubscriptionId: subscription.providerSubscriptionId,
            source: "billing-reconciliation-paid-effect-recovery",
            description: `Reconciliação retomou renovação da invoice ${invoice.id} paga.`,
          });
          changed += 1;
          shouldComplete = true;
        } else {
          findings.push({
            code: "invoice_paid_subscription_not_active",
            workspaceId: subscription.workspaceId,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            details: {
              previousSubscriptionStatus: subscription.status,
              autoCorrected: false,
              invoiceType: invoice.type,
            },
          });
        }
      } else if (invoice.type === "subscription") {
        const currentPeriodStart = invoice.paidAt ?? nowIso;
        const currentPeriodEnd = invoice.periodEnd ?? addBillingCycle(
          currentPeriodStart,
          subscription.billingCycle,
        );

        if (subscription.status === "pending") {
          findings.push({
            code: "invoice_paid_subscription_not_active",
            workspaceId: subscription.workspaceId,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            details: {
              previousSubscriptionStatus: subscription.status,
              autoCorrected: true,
            },
          });
          await this.dependencies.billingService.activateSubscription(subscription.id, {
            actorType: "system",
            currentPeriodStart,
            currentPeriodEnd,
            accessUntil: currentPeriodEnd,
          });
          await this.dependencies.applyWorkspaceSubscriptionUpdate({
            workspaceId: subscription.workspaceId,
            planId: subscription.planId,
            billingCycle: subscription.billingCycle,
            status: "active",
            mercadoPagoSubscriptionId: subscription.providerSubscriptionId,
            source: "billing-reconciliation-paid-effect-recovery",
            description: `Reconciliação retomou ativação da invoice ${invoice.id} paga.`,
          });
          changed += 1;
          shouldComplete = true;
        } else if (
          subscription.status === "active" &&
          hasReachedPeriodEnd(subscription.accessUntil, currentPeriodEnd)
        ) {
          shouldComplete = true;
        } else {
          findings.push({
            code: "invoice_paid_subscription_not_active",
            workspaceId: subscription.workspaceId,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            details: {
              previousSubscriptionStatus: subscription.status,
              autoCorrected: false,
              invoiceType: invoice.type,
            },
          });
        }
      } else {
        shouldComplete = true;
      }

      if (claimToken) {
        if (shouldComplete) {
          const completed = await this.dependencies.completeInvoiceEffect?.({
            invoiceId: invoice.id,
            claimToken,
          });

          if (completed === false) {
            throw new Error("Billing invoice effect claim was lost before completion.");
          }
        } else {
          await this.dependencies.releaseInvoiceEffectClaim?.({
            invoiceId: invoice.id,
            claimToken,
          });
        }
      }

          return { processed: 1, changed, findings };
        },
      );
    } catch (error) {
      if (claimToken) {
        await this.dependencies
          .releaseInvoiceEffectClaim?.({ invoiceId: invoice.id, claimToken })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  async reconcileProviderState(
    limit = 100,
  ): Promise<BillingReconciliationRunResult> {
    const [subscriptions, invoices] = await Promise.all([
      this.dependencies.listSubscriptionsForProviderReconciliation(limit),
      this.dependencies.listInvoicesForProviderReconciliation(limit),
    ]);
    const findings: BillingReconciliationFinding[] = [];
    let processed = 0;
    let changed = 0;

    for (const subscription of subscriptions) {
      const result = await this.reconcileSubscription(subscription.id);
      processed += result.processed;
      changed += result.changed;
      findings.push(...result.findings);
    }

    for (const invoice of invoices) {
      const result = await this.reconcileInvoice(invoice.id);
      processed += result.processed;
      changed += result.changed;
      findings.push(...result.findings);
    }

    return { processed, changed, findings };
  }

  async processExpiredSubscriptions(): Promise<BillingReconciliationRunResult> {
    const asOf = this.now().toISOString();
    const subscriptions = await this.dependencies.listSubscriptionsForExpiration(asOf);
    let changed = 0;

    for (const subscription of subscriptions) {
      await this.runWithSubscriptionOperation(subscription.id, async () => {
        const expiredSubscription = await this.dependencies.billingService.expireSubscription(
          subscription.id,
          {
            actorType: "system",
            endedAt: subscription.currentPeriodEnd ?? asOf,
          },
        );
        const projectionSubscription = expiredSubscription ?? subscription;
        await this.dependencies.applyWorkspaceSubscriptionUpdate({
          workspaceId: projectionSubscription.workspaceId,
          planId: projectionSubscription.planId,
          billingCycle: projectionSubscription.billingCycle,
          status: "canceled",
          mercadoPagoSubscriptionId: projectionSubscription.providerSubscriptionId,
          source: "billing-reconciliation-expiration",
          description: "Assinatura expirada por término do período sem renovação.",
        });
      });
      changed += 1;
    }

    return {
      processed: subscriptions.length,
      changed,
      findings: [],
    };
  }

  async processGracePeriods(): Promise<BillingReconciliationRunResult> {
    const asOf = this.now().toISOString();
    const subscriptions =
      await this.dependencies.listSubscriptionsForGracePeriodEnd(asOf);
    let changed = 0;

    for (const subscription of subscriptions) {
      await this.runWithSubscriptionOperation(subscription.id, async () => {
        const pausedSubscription = await this.dependencies.billingService.pauseSubscription(
          subscription.id,
          { actorType: "system" },
        );
        const projectionSubscription = pausedSubscription ?? subscription;
        await this.dependencies.applyWorkspaceSubscriptionUpdate({
          workspaceId: projectionSubscription.workspaceId,
          planId: projectionSubscription.planId,
          billingCycle: projectionSubscription.billingCycle,
          status: "paused",
          mercadoPagoSubscriptionId: projectionSubscription.providerSubscriptionId,
          source: "billing-reconciliation-grace-period",
          description: "Assinatura pausada após o fim da tolerância.",
        });
      });
      changed += 1;
    }

    return {
      processed: subscriptions.length,
      changed,
      findings: [],
    };
  }

  async processScheduledCancellations(): Promise<BillingReconciliationRunResult> {
    const asOf = this.now().toISOString();
    const subscriptions =
      await this.dependencies.listSubscriptionsForScheduledCancellation(asOf);
    let changed = 0;

    for (const subscription of subscriptions) {
      await this.runWithSubscriptionOperation(subscription.id, async () => {
        const canceledSubscription = await this.dependencies.billingService.finalizeCancellation(
          subscription.id,
          {
            actorType: "system",
            endedAt: subscription.currentPeriodEnd ?? asOf,
          },
        );
        const projectionSubscription = canceledSubscription ?? subscription;
        await this.dependencies.applyWorkspaceSubscriptionUpdate({
          workspaceId: projectionSubscription.workspaceId,
          planId: projectionSubscription.planId,
          billingCycle: projectionSubscription.billingCycle,
          status: "canceled",
          mercadoPagoSubscriptionId: projectionSubscription.providerSubscriptionId,
          source: "billing-reconciliation-scheduled-cancel",
          description: "Assinatura encerrada ao fim do período agendado.",
        });
      });
      changed += 1;
    }

    return {
      processed: subscriptions.length,
      changed,
      findings: [],
    };
  }

  async processScheduledChanges(): Promise<BillingReconciliationRunResult> {
    const asOf = this.now().toISOString();
    const changes = await this.dependencies.getDueSubscriptionChanges(asOf);
    const findings: BillingReconciliationFinding[] = [];
    let changed = 0;

    for (const change of changes) {
      const subscription = await this.dependencies.getSubscriptionById(
        change.subscriptionId,
      );

      if (!subscription) {
        findings.push({
          code: "scheduled_change_overdue",
          workspaceId: change.workspaceId,
          subscriptionId: change.subscriptionId,
          details: {
            changeId: change.id,
            reason: "subscription_missing",
          },
        });

        await this.dependencies.updateSubscriptionChange(change.id, {
          status: "failed",
        });
        continue;
      }

      const nextPlanId = change.toPlanId ?? subscription.planId;
      const nextBillingCycle = change.toBillingCycle ?? subscription.billingCycle;
      const nextPrice = await this.dependencies.findActivePrice({
        planId: nextPlanId,
        billingCycle: nextBillingCycle,
        asOf,
      });

      if (!nextPrice) {
        findings.push({
          code: "scheduled_change_overdue",
          workspaceId: subscription.workspaceId,
          subscriptionId: subscription.id,
          details: {
            changeId: change.id,
            reason: "price_not_found",
            nextPlanId,
            nextBillingCycle,
          },
        });

        await this.dependencies.updateSubscriptionChange(change.id, {
          status: "failed",
        });
        continue;
      }

      await this.runWithSubscriptionOperation(subscription.id, async () => {
        const updatedSubscription =
          await this.dependencies.billingService.applyScheduledChange(
            subscription.id,
            {
              actorType: "system",
              planId: nextPlanId,
              billingCycle: nextBillingCycle,
              priceId: nextPrice.id,
              metadata: {
                changeId: change.id,
                changeType: change.type,
              },
            },
          );
        const projectionSubscription = updatedSubscription ?? subscription;

        await this.dependencies.updateSubscriptionChange(change.id, {
          status: "applied",
          appliedAt: asOf,
        });
        await this.dependencies.applyWorkspaceSubscriptionUpdate({
          workspaceId: projectionSubscription.workspaceId,
          planId: projectionSubscription.planId,
          billingCycle: projectionSubscription.billingCycle,
          status: resolveWorkspaceProjectionStatusFromBillingStatus(
            projectionSubscription.status,
          ),
          mercadoPagoSubscriptionId: projectionSubscription.providerSubscriptionId,
          source: "billing-reconciliation-scheduled-change",
          description: `Mudança agendada ${change.type} aplicada pela reconciliação.`,
        });
      });
      changed += 1;
    }

    return {
      processed: changes.length,
      changed,
      findings,
    };
  }

  async processExpiredInvoices(): Promise<BillingReconciliationRunResult> {
    const asOf = this.now().toISOString();
    const invoices = await this.dependencies.listInvoicesForExpiration(asOf);
    let changed = 0;

    for (const invoice of invoices) {
      const transitionedInvoice = await this.transitionPendingInvoice(invoice.id, {
        status: "expired",
        failedAt: invoice.failedAt ?? asOf,
      });
      if (!transitionedInvoice.applied) {
        continue;
      }
      await this.dependencies.appendAuditEvent({
        workspaceId: invoice.workspaceId,
        subscriptionId: invoice.subscriptionId,
        invoiceId: invoice.id,
        actorType: "system",
        action: "invoice.expired",
        metadata: {
          paymentMethod: invoice.paymentMethod,
        },
      });
      changed += 1;
    }

    return {
      processed: invoices.length,
      changed,
      findings: [],
    };
  }

  async processAbandonedCheckouts(): Promise<BillingReconciliationRunResult> {
    const now = this.now();
    const asOf = now.toISOString();
    const startedBefore = subtractDays(
      now,
      this.dependencies.abandonedCheckoutWindowDays ?? 30,
    ).toISOString();
    const subscriptions =
      await this.dependencies.listAbandonedPendingSubscriptions({
        asOf,
        startedBefore,
      });
    let changed = 0;

    for (const subscription of subscriptions) {
      await this.dependencies.billingService.finalizeCancellation(subscription.id, {
        actorType: "system",
        endedAt: asOf,
      });
      await this.dependencies.applyWorkspaceSubscriptionUpdate({
        workspaceId: subscription.workspaceId,
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        status: "unpaid",
        mercadoPagoSubscriptionId: null,
        source: "billing-reconciliation-abandoned-checkout",
        description: "Checkout pendente encerrado como abandonado.",
      });
      changed += 1;
    }

    return {
      processed: subscriptions.length,
      changed,
      findings: [],
    };
  }

  async collectOperationalFindings(limit = 50): Promise<BillingReconciliationRunResult> {
    const failedWebhookEvents = await this.dependencies.listFailedWebhookEvents(limit);

    return {
      processed: failedWebhookEvents.length,
      changed: 0,
      findings: failedWebhookEvents.map((event) => ({
        code: "webhook_processing_failed",
        webhookEventId: event.id,
        details: {
          provider: event.provider,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          errorCode: event.errorCode,
          errorMessage: event.errorMessage,
        },
      })),
    };
  }

  private now() {
    return this.dependencies.clock?.now() ?? new Date();
  }
}

function subtractDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
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

function hasReachedPeriodEnd(
  currentValue: string | null,
  expectedValue: string,
) {
  if (!currentValue) {
    return false;
  }

  const currentTimestamp = Date.parse(currentValue);
  const expectedTimestamp = Date.parse(expectedValue);

  return (
    !Number.isNaN(currentTimestamp) &&
    !Number.isNaN(expectedTimestamp) &&
    currentTimestamp >= expectedTimestamp
  );
}

function resolveWorkspaceProjectionStatusFromBillingStatus(
  status: BillingSubscription["status"],
): WorkspaceProjectionStatus {
  switch (status) {
    case "active":
    case "past_due":
      return "active";
    case "paused":
      return "paused";
    case "pending":
      return "unpaid";
    case "scheduled_cancel":
    case "canceled":
    case "expired":
    default:
      return "canceled";
  }
}

function emptyRun(processed: number): BillingReconciliationRunResult {
  return {
    processed,
    changed: 0,
    findings: [],
  };
}

function singleFinding(
  code: BillingReconciliationFindingCode,
  input: Omit<BillingReconciliationFinding, "code">,
): BillingReconciliationRunResult {
  return {
    processed: 1,
    changed: 0,
    findings: [
      {
        code,
        ...input,
      },
    ],
  };
}

function serializeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

async function resolveReconciliationPayment(
  provider: BillingProvider,
  invoice: BillingInvoice,
) {
  if (invoice.paymentMethod === "pix_manual" && invoice.providerPaymentId) {
    const payment = await provider.getManualPayment(invoice.providerPaymentId);
    return {
      kind: "manual" as const,
      record: payment,
      status: payment.status,
    };
  }

  if (invoice.providerAuthorizedPaymentId) {
    const payment = await provider.getPayment(invoice.providerAuthorizedPaymentId);
    return {
      kind: "authorized" as const,
      record: payment,
      status: payment.status,
    };
  }

  return null;
}
