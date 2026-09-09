import type { BillingProvider } from "./providers/billing-provider.ts";
import type { BillingService } from "./service.ts";
import { applyBillingSubscriptionCycleChange } from "./cycle-change-management.ts";
import { applyBillingSubscriptionUpgrade } from "./upgrade-management.ts";
import type {
  BillingInvoice,
  BillingPrice,
  BillingSubscription,
  BillingSubscriptionChange,
} from "./types.ts";

// Reused by both the reconciliation cron (`reconciliation-service.ts`) and the
// webhook duplicate path (`webhook-service.ts`): a paid invoice whose effect
// claim never completed (subscription operation claim lost, process crashed
// mid-effect, etc.) is recovered the same way regardless of who notices it.

export type InvoiceEffectRecoveryFindingCode = "invoice_paid_subscription_not_active";

export type InvoiceEffectRecoveryFinding = {
  code: InvoiceEffectRecoveryFindingCode;
  workspaceId?: string | null;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  details?: Record<string, unknown>;
};

export type InvoiceEffectRecoveryResult = {
  processed: number;
  changed: number;
  findings: InvoiceEffectRecoveryFinding[];
};

export type InvoiceEffectRecoveryDependencies = {
  getSubscriptionById(subscriptionId: string): Promise<BillingSubscription | null>;
  getSubscriptionChangeByInvoiceId(
    invoiceId: string,
  ): Promise<BillingSubscriptionChange | null>;
  findActivePrice(input: {
    planId: BillingSubscription["planId"];
    billingCycle: BillingSubscription["billingCycle"];
    asOf?: string;
  }): Promise<BillingPrice | null>;
  getProvider(
    provider: BillingSubscription["provider"],
  ): Pick<BillingProvider, "updateSubscriptionAmount"> | null;
  billingService: Pick<
    BillingService,
    "activateSubscription" | "renewSubscription" | "applyUpgrade" | "applyCycleChange"
  >;
  updateSubscriptionChange(
    changeId: string,
    mutation: Partial<
      Pick<
        BillingSubscriptionChange,
        "status" | "appliedAt" | "canceledAt" | "invoiceId"
      >
    >,
  ): Promise<BillingSubscriptionChange | null>;
  applyWorkspaceSubscriptionUpdate(input: {
    workspaceId: string;
    planId: BillingSubscription["planId"];
    billingCycle?: BillingSubscription["billingCycle"];
    status: "active";
    source: string;
    mercadoPagoSubscriptionId?: string | null;
    description?: string | null;
  }): Promise<{ changed: boolean }>;
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
  clock?: {
    now(): Date;
  };
};

function runWithSubscriptionOperation<T>(
  dependencies: InvoiceEffectRecoveryDependencies,
  subscriptionId: string,
  operation: () => Promise<T>,
) {
  return dependencies.withSubscriptionOperation
    ? dependencies.withSubscriptionOperation(subscriptionId, operation)
    : operation();
}

function now(dependencies: InvoiceEffectRecoveryDependencies) {
  return dependencies.clock?.now() ?? new Date();
}

function emptyRun(processed: number): InvoiceEffectRecoveryResult {
  return { processed, changed: 0, findings: [] };
}

function singleFinding(
  code: InvoiceEffectRecoveryFindingCode,
  input: Omit<InvoiceEffectRecoveryFinding, "code">,
): InvoiceEffectRecoveryResult {
  return {
    processed: 1,
    changed: 0,
    findings: [{ code, ...input }],
  };
}

function hasReachedPeriodEnd(currentValue: string | null, expectedValue: string) {
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

/**
 * Applies the commercial effect of a paid invoice (activation, renewal or a
 * pending upgrade/cycle-change) exactly once, guarded by the invoice's effect
 * claim and the subscription operation claim. Safe to call on an invoice
 * whose effect is already complete: the claim attempt is a single indexed
 * write against `billing_invoice_effect_claims` and nothing else runs.
 */
export async function recoverPaidInvoiceEffect(
  dependencies: InvoiceEffectRecoveryDependencies,
  invoice: BillingInvoice,
): Promise<InvoiceEffectRecoveryResult> {
  const claimToken = dependencies.claimInvoiceEffect
    ? await dependencies.claimInvoiceEffect(invoice.id)
    : null;

  if (dependencies.claimInvoiceEffect && !claimToken) {
    return emptyRun(1);
  }

  let shouldComplete = false;

  try {
    return await runWithSubscriptionOperation(
      dependencies,
      invoice.subscriptionId,
      async () => {
        const subscription = await dependencies.getSubscriptionById(
          invoice.subscriptionId,
        );

        if (!subscription) {
          if (claimToken) {
            await dependencies.releaseInvoiceEffectClaim?.({
              invoiceId: invoice.id,
              claimToken,
            });
          }

          return singleFinding("invoice_paid_subscription_not_active", {
            invoiceId: invoice.id,
            details: { reason: "subscription_missing", autoCorrected: false },
          });
        }

        const nowIso = now(dependencies).toISOString();
        const findings: InvoiceEffectRecoveryFinding[] = [];
        let changed = 0;

        if (invoice.type === "upgrade") {
          const change = await dependencies.getSubscriptionChangeByInvoiceId(
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
                source: "billing-invoice-effect-recovery",
                description: `Recuperação retomou mudança de ciclo da invoice ${invoice.id} paga.`,
                dependencies: {
                  findActivePrice: dependencies.findActivePrice,
                  getProvider: dependencies.getProvider,
                  billingService: dependencies.billingService,
                  updateSubscriptionChange: dependencies.updateSubscriptionChange,
                  applyWorkspaceSubscriptionUpdate:
                    dependencies.applyWorkspaceSubscriptionUpdate,
                },
              });
            } else {
              await applyBillingSubscriptionUpgrade({
                subscription,
                change,
                invoice,
                actorType: "system",
                nowIso,
                source: "billing-invoice-effect-recovery",
                description: `Recuperação retomou upgrade da invoice ${invoice.id} paga.`,
                dependencies: {
                  findActivePrice: dependencies.findActivePrice,
                  getProvider: dependencies.getProvider,
                  billingService: dependencies.billingService,
                  updateSubscriptionChange: dependencies.updateSubscriptionChange,
                  applyWorkspaceSubscriptionUpdate:
                    dependencies.applyWorkspaceSubscriptionUpdate,
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
            invoice.periodEnd ??
            addBillingCycle(currentPeriodStart, subscription.billingCycle);

          if (
            hasReachedPeriodEnd(subscription.currentPeriodEnd, currentPeriodEnd) &&
            hasReachedPeriodEnd(subscription.accessUntil, currentPeriodEnd)
          ) {
            shouldComplete = true;
          } else if (
            subscription.status === "active" ||
            subscription.status === "past_due"
          ) {
            await dependencies.billingService.renewSubscription(subscription.id, {
              actorType: "system",
              currentPeriodStart,
              currentPeriodEnd,
              accessUntil: currentPeriodEnd,
            });
            await dependencies.applyWorkspaceSubscriptionUpdate({
              workspaceId: subscription.workspaceId,
              planId: subscription.planId,
              billingCycle: subscription.billingCycle,
              status: "active",
              mercadoPagoSubscriptionId: subscription.providerSubscriptionId,
              source: "billing-invoice-effect-recovery",
              description: `Recuperação retomou renovação da invoice ${invoice.id} paga.`,
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
          const currentPeriodStart = invoice.periodStart ?? invoice.paidAt ?? nowIso;
          const currentPeriodEnd =
            invoice.periodEnd ??
            addBillingCycle(currentPeriodStart, subscription.billingCycle);

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
            await dependencies.billingService.activateSubscription(subscription.id, {
              actorType: "system",
              currentPeriodStart,
              currentPeriodEnd,
              accessUntil: currentPeriodEnd,
            });
            await dependencies.applyWorkspaceSubscriptionUpdate({
              workspaceId: subscription.workspaceId,
              planId: subscription.planId,
              billingCycle: subscription.billingCycle,
              status: "active",
              mercadoPagoSubscriptionId: subscription.providerSubscriptionId,
              source: "billing-invoice-effect-recovery",
              description: `Recuperação retomou ativação da invoice ${invoice.id} paga.`,
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
            const completed = await dependencies.completeInvoiceEffect?.({
              invoiceId: invoice.id,
              claimToken,
            });

            if (completed === false) {
              throw new Error(
                "Billing invoice effect claim was lost before completion.",
              );
            }
          } else {
            await dependencies.releaseInvoiceEffectClaim?.({
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
      await dependencies
        .releaseInvoiceEffectClaim?.({ invoiceId: invoice.id, claimToken })
        .catch(() => undefined);
    }
    throw error;
  }
}
