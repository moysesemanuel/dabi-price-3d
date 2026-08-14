import assert from "node:assert/strict";
import test from "node:test";

import {
  assertValidBillingSubscriptionTransition,
  canTransitionBillingSubscriptionStatus,
  isCurrentBillingSubscriptionStatus,
  isTerminalBillingSubscriptionStatus,
} from "../src/lib/billing/state-machine.ts";

test("permite repetição idempotente do mesmo status", () => {
  assert.equal(canTransitionBillingSubscriptionStatus("pending", "pending"), true);
  assert.equal(canTransitionBillingSubscriptionStatus("active", "active"), true);
});

test("pending permite active e canceled, mas não paused", () => {
  assert.equal(canTransitionBillingSubscriptionStatus("pending", "active"), true);
  assert.equal(canTransitionBillingSubscriptionStatus("pending", "canceled"), true);
  assert.equal(canTransitionBillingSubscriptionStatus("pending", "paused"), false);
});

test("active permite past_due, scheduled_cancel, paused e expired", () => {
  assert.equal(canTransitionBillingSubscriptionStatus("active", "past_due"), true);
  assert.equal(
    canTransitionBillingSubscriptionStatus("active", "scheduled_cancel"),
    true,
  );
  assert.equal(canTransitionBillingSubscriptionStatus("active", "paused"), true);
  assert.equal(canTransitionBillingSubscriptionStatus("active", "expired"), true);
  assert.equal(canTransitionBillingSubscriptionStatus("active", "pending"), false);
});

test("past_due pode recuperar, pausar ou agendar cancelamento", () => {
  assert.equal(canTransitionBillingSubscriptionStatus("past_due", "active"), true);
  assert.equal(canTransitionBillingSubscriptionStatus("past_due", "paused"), true);
  assert.equal(
    canTransitionBillingSubscriptionStatus("past_due", "scheduled_cancel"),
    true,
  );
  assert.equal(canTransitionBillingSubscriptionStatus("past_due", "expired"), false);
});

test("scheduled_cancel e paused seguem as transições definidas", () => {
  assert.equal(
    canTransitionBillingSubscriptionStatus("scheduled_cancel", "active"),
    true,
  );
  assert.equal(
    canTransitionBillingSubscriptionStatus("scheduled_cancel", "canceled"),
    true,
  );
  assert.equal(
    canTransitionBillingSubscriptionStatus("scheduled_cancel", "paused"),
    false,
  );

  assert.equal(canTransitionBillingSubscriptionStatus("paused", "active"), true);
  assert.equal(canTransitionBillingSubscriptionStatus("paused", "canceled"), true);
  assert.equal(canTransitionBillingSubscriptionStatus("paused", "expired"), false);
});

test("canceled e expired são terminais", () => {
  assert.equal(canTransitionBillingSubscriptionStatus("canceled", "active"), false);
  assert.equal(canTransitionBillingSubscriptionStatus("expired", "active"), false);
  assert.equal(isTerminalBillingSubscriptionStatus("canceled"), true);
  assert.equal(isTerminalBillingSubscriptionStatus("expired"), true);
  assert.equal(isTerminalBillingSubscriptionStatus("active"), false);
});

test("status correntes seguem a definição da arquitetura", () => {
  assert.equal(isCurrentBillingSubscriptionStatus("pending"), true);
  assert.equal(isCurrentBillingSubscriptionStatus("active"), true);
  assert.equal(isCurrentBillingSubscriptionStatus("past_due"), true);
  assert.equal(isCurrentBillingSubscriptionStatus("scheduled_cancel"), true);
  assert.equal(isCurrentBillingSubscriptionStatus("paused"), true);
  assert.equal(isCurrentBillingSubscriptionStatus("canceled"), false);
  assert.equal(isCurrentBillingSubscriptionStatus("expired"), false);
});

test("assertValidBillingSubscriptionTransition falha em transição inválida", () => {
  assert.throws(
    () =>
      assertValidBillingSubscriptionTransition({
        from: "pending",
        to: "paused",
      }),
    /Invalid billing subscription transition: pending -> paused/,
  );
});
