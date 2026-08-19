import assert from "node:assert/strict";
import test from "node:test";

import { BillingReconciliationRunner } from "../src/lib/billing/reconciliation-runner.ts";

function result(processed, changed = 0, findings = []) {
  return { processed, changed, findings };
}

test("executa a manutenção na ordem definida e soma os resultados", async () => {
  const calls = [];
  const runner = new BillingReconciliationRunner({
    async processExpiredSubscriptions() {
      calls.push("expiredSubscriptions");
      return result(1, 1);
    },
    async processGracePeriods() {
      calls.push("gracePeriods");
      return result(2, 1, [{ code: "finding" }]);
    },
    async processScheduledCancellations() {
      calls.push("scheduledCancellations");
      return result(3, 2);
    },
    async processScheduledChanges() {
      calls.push("scheduledChanges");
      return result(4);
    },
    async processExpiredInvoices() {
      calls.push("expiredInvoices");
      return result(5, 1);
    },
    async processAbandonedCheckouts() {
      throw new Error("not used");
    },
    async reconcileProviderState() {
      throw new Error("not used");
    },
  });

  const run = await runner.runMaintenance();

  assert.deepEqual(calls, [
    "expiredSubscriptions",
    "gracePeriods",
    "scheduledCancellations",
    "scheduledChanges",
    "expiredInvoices",
  ]);
  assert.equal(run.processed, 15);
  assert.equal(run.changed, 5);
  assert.equal(run.findings, 1);
});

test("separa limpeza diária e reconciliação remota", async () => {
  const calls = [];
  const runner = new BillingReconciliationRunner({
    async processExpiredSubscriptions() { throw new Error("not used"); },
    async processGracePeriods() { throw new Error("not used"); },
    async processScheduledCancellations() { throw new Error("not used"); },
    async processScheduledChanges() { throw new Error("not used"); },
    async processExpiredInvoices() { throw new Error("not used"); },
    async processAbandonedCheckouts() {
      calls.push("abandoned");
      return result(2, 2);
    },
    async reconcileProviderState(limit) {
      calls.push(["provider", limit]);
      return result(3, 1, [{ code: "provider_subscription_missing" }]);
    },
  });

  const cleanup = await runner.runAbandonedCheckoutCleanup();
  const provider = await runner.runProviderReconciliation(25);

  assert.equal(cleanup.changed, 2);
  assert.equal(provider.processed, 3);
  assert.deepEqual(calls, ["abandoned", ["provider", 25]]);
});
