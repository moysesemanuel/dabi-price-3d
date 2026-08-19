import "server-only";

import { BillingReconciliationRunner } from "./reconciliation-runner.ts";
import { createBillingReconciliationService } from "./server-reconciliation-service.ts";

export function createBillingReconciliationRunner() {
  return new BillingReconciliationRunner(
    createBillingReconciliationService(),
  );
}
