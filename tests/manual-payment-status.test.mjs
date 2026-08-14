import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeBillingManualPaymentState,
  resolveInvoiceStatusFromManualPaymentState,
} from "../src/lib/billing/manual-payment-status.ts";

test("normaliza estados do provider para o fluxo manual", () => {
  assert.equal(normalizeBillingManualPaymentState("approved"), "paid");
  assert.equal(normalizeBillingManualPaymentState("pending"), "pending");
  assert.equal(normalizeBillingManualPaymentState("in_process"), "pending");
  assert.equal(normalizeBillingManualPaymentState("rejected"), "failed");
  assert.equal(normalizeBillingManualPaymentState("expired"), "expired");
  assert.equal(normalizeBillingManualPaymentState("cancelled"), "canceled");
  assert.equal(normalizeBillingManualPaymentState("other"), "unknown");
});

test("converte o estado manual para o status da invoice", () => {
  assert.equal(resolveInvoiceStatusFromManualPaymentState("paid"), "paid");
  assert.equal(resolveInvoiceStatusFromManualPaymentState("pending"), "pending");
  assert.equal(resolveInvoiceStatusFromManualPaymentState("failed"), "failed");
  assert.equal(resolveInvoiceStatusFromManualPaymentState("expired"), "expired");
  assert.equal(resolveInvoiceStatusFromManualPaymentState("canceled"), "canceled");
  assert.equal(resolveInvoiceStatusFromManualPaymentState("unknown"), null);
});
