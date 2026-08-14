import assert from "node:assert/strict";
import test from "node:test";

import { resolveBillingNotification } from "../src/lib/billing/notification-service.ts";

const NOW = new Date("2026-08-14T12:00:00.000Z");

test("paused tem a maior prioridade e oferece reativação", () => {
  const notification = resolveBillingNotification({
    subscription: {
      planId: "growth",
      status: "paused",
      autoRenew: false,
      currentPeriodEnd: "2026-08-18T00:00:00.000Z",
    },
    now: NOW,
  });

  assert.equal(notification?.kind, "paused");
  assert.equal(notification?.priority, 4);
  assert.equal(notification?.primaryAction.type, "manage_subscription");
  assert.equal(notification?.primaryAction.action, "resume");
});

test("past_due gera banner com data limite da tolerância", () => {
  const notification = resolveBillingNotification({
    subscription: {
      planId: "growth",
      status: "past_due",
      gracePeriodEndsAt: "2026-08-18T00:00:00.000Z",
    },
    now: NOW,
  });

  assert.equal(notification?.kind, "past_due");
  assert.match(notification?.description ?? "", /18 de agosto de 2026/);
});

test("scheduled_cancel mostra o plano e o fim do período atual", () => {
  const notification = resolveBillingNotification({
    subscription: {
      planId: "growth",
      status: "scheduled_cancel",
      currentPeriodEnd: "2026-09-13T00:00:00.000Z",
      autoRenew: false,
    },
    now: NOW,
  });

  assert.equal(notification?.kind, "scheduled_cancel");
  assert.match(notification?.description ?? "", /DaBi Pro/);
  assert.match(notification?.description ?? "", /13 de setembro de 2026/);
});

test("expiring_soon aparece quando a renovação está desligada e faltam até 7 dias", () => {
  const notification = resolveBillingNotification({
    subscription: {
      planId: "starter",
      status: "active",
      autoRenew: false,
      currentPeriodEnd: "2026-08-20T00:00:00.000Z",
    },
    now: NOW,
  });

  assert.equal(notification?.kind, "expiring_soon");
  assert.equal(notification?.priority, 1);
});

test("assinatura ativa com renovação normal não gera banner", () => {
  const notification = resolveBillingNotification({
    subscription: {
      planId: "growth",
      status: "active",
      autoRenew: true,
      currentPeriodEnd: "2026-09-14T00:00:00.000Z",
    },
    now: NOW,
  });

  assert.equal(notification, null);
});
