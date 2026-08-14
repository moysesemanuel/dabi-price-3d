import assert from "node:assert/strict";
import test from "node:test";

import { resolveLegacyBillingMigration } from "../src/lib/billing/legacy-migration.ts";

function createLegacySubscription(overrides = {}) {
  return {
    planId: "starter",
    status: "unpaid",
    billingCycle: "monthly",
    seatsUsed: 1,
    mercadoPagoSubscriptionId: null,
    checkoutStartedAt: null,
    ...overrides,
  };
}

test("não migra quando o workspace já possui billing novo", () => {
  const decision = resolveLegacyBillingMigration({
    legacySubscription: createLegacySubscription({
      status: "active",
      planId: "growth",
    }),
    hasAnyBillingSubscription: true,
  });

  assert.deepEqual(decision, {
    type: "skip",
    reason: "billing_already_exists",
  });
});

test("migra active legado para assinatura ativa no billing novo", () => {
  const decision = resolveLegacyBillingMigration({
    legacySubscription: createLegacySubscription({
      status: "active",
      planId: "growth",
      billingCycle: "annual",
      mercadoPagoSubscriptionId: "mp-active-1",
    }),
    hasAnyBillingSubscription: false,
  });

  assert.equal(decision.type, "import_subscription");
  assert.equal(decision.status, "active");
  assert.equal(decision.planId, "growth");
  assert.equal(decision.billingCycle, "annual");
  assert.equal(decision.provider, "mercado_pago");
  assert.equal(decision.providerSubscriptionId, "mp-active-1");
});

test("migra pending legado para assinatura pending no billing novo", () => {
  const decision = resolveLegacyBillingMigration({
    legacySubscription: createLegacySubscription({
      status: "pending",
      planId: "growth",
      mercadoPagoSubscriptionId: "mp-pending-1",
    }),
    hasAnyBillingSubscription: false,
  });

  assert.equal(decision.type, "import_subscription");
  assert.equal(decision.status, "pending");
  assert.equal(decision.autoRenew, true);
});

test("não migra unpaid legado", () => {
  const decision = resolveLegacyBillingMigration({
    legacySubscription: createLegacySubscription({
      status: "unpaid",
    }),
    hasAnyBillingSubscription: false,
  });

  assert.deepEqual(decision, {
    type: "skip",
    reason: "legacy_unpaid",
  });
});

test("não migra internal legado para a tabela de subscriptions", () => {
  const decision = resolveLegacyBillingMigration({
    legacySubscription: createLegacySubscription({
      status: "internal",
      planId: "growth",
    }),
    hasAnyBillingSubscription: false,
  });

  assert.deepEqual(decision, {
    type: "skip",
    reason: "legacy_internal",
  });
});

test("migra canceled legado como histórico terminal", () => {
  const decision = resolveLegacyBillingMigration({
    legacySubscription: createLegacySubscription({
      status: "canceled",
      planId: "growth",
      mercadoPagoSubscriptionId: "mp-canceled-1",
    }),
    hasAnyBillingSubscription: false,
    now: new Date("2026-08-14T12:00:00.000Z"),
  });

  assert.equal(decision.type, "import_subscription");
  assert.equal(decision.status, "canceled");
  assert.equal(decision.autoRenew, false);
  assert.equal(decision.endedAt, "2026-08-14T12:00:00.000Z");
});
