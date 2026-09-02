import type {
  BillingReconciliationRunResult,
  BillingReconciliationService,
} from "./reconciliation-service.ts";

export type BillingReconciliationJobResult = {
  processed: number;
  changed: number;
  findings: number;
  steps: Record<string, BillingReconciliationRunResult>;
};

type ReconciliationRunnerDependencies = Pick<
  BillingReconciliationService,
  | "processExpiredSubscriptions"
  | "processGracePeriods"
  | "processScheduledCancellations"
  | "processScheduledChanges"
  | "processExpiredInvoices"
  | "processAbandonedCheckouts"
  | "reconcileSubscription"
  | "reconcileProviderState"
>;

export class BillingReconciliationRunner {
  private readonly service: ReconciliationRunnerDependencies;

  constructor(service: ReconciliationRunnerDependencies) {
    this.service = service;
  }

  async runMaintenance() {
    return this.run({
      expiredSubscriptions: () => this.service.processExpiredSubscriptions(),
      gracePeriods: () => this.service.processGracePeriods(),
      scheduledCancellations: () =>
        this.service.processScheduledCancellations(),
      scheduledChanges: () => this.service.processScheduledChanges(),
      expiredInvoices: () => this.service.processExpiredInvoices(),
    });
  }

  async runAbandonedCheckoutCleanup() {
    return this.run({
      abandonedCheckouts: () => this.service.processAbandonedCheckouts(),
    });
  }

  async runProviderReconciliation(limit = 100, subscriptionId?: string) {
    return this.run({
      providerReconciliation: () =>
        subscriptionId
          ? this.service.reconcileSubscription(subscriptionId)
          : this.service.reconcileProviderState(limit),
    });
  }

  private async run(
    steps: Record<string, () => Promise<BillingReconciliationRunResult>>,
  ): Promise<BillingReconciliationJobResult> {
    const results: Record<string, BillingReconciliationRunResult> = {};

    for (const [name, execute] of Object.entries(steps)) {
      results[name] = await execute();
    }

    return Object.values(results).reduce(
      (summary, result) => ({
        processed: summary.processed + result.processed,
        changed: summary.changed + result.changed,
        findings: summary.findings + result.findings.length,
        steps: results,
      }),
      {
        processed: 0,
        changed: 0,
        findings: 0,
        steps: results,
      } satisfies BillingReconciliationJobResult,
    );
  }
}
