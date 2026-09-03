import assert from "node:assert/strict";
import test from "node:test";

import {
  getEntitlementAccessBlockedMessage,
  resolveWorkspaceEntitlements,
} from "../src/lib/billing/entitlement-service.ts";

const NOW = new Date("2026-08-14T12:00:00.000Z");

test("super admin sem assinatura recebe acesso integral sem limites comerciais", () => {
  const entitlements = resolveWorkspaceEntitlements({
    subscription: null,
    platformRole: "super_admin",
    now: NOW,
  });

  assert.equal(entitlements.canUseApp, true);
  assert.equal(entitlements.canUsePricing, true);
  assert.equal(entitlements.canExportPdf, true);
  assert.equal(entitlements.canViewHistory, true);
  assert.equal(entitlements.canManageIntegrations, true);
  assert.equal(entitlements.canManageBilling, true);
  assert.equal(entitlements.historyLimit, null);
  assert.equal(entitlements.seatsLimit, null);
  assert.equal(entitlements.accessReason, "super_admin");
  assert.equal(getEntitlementAccessBlockedMessage(entitlements.accessReason), null);
});

test("active libera o produto com limites do plano contratado", () => {
  const entitlements = resolveWorkspaceEntitlements({
    subscription: {
      planId: "growth",
      status: "active",
    },
    now: NOW,
  });

  assert.equal(entitlements.canUseApp, true);
  assert.equal(entitlements.canUsePricing, true);
  assert.equal(entitlements.canViewHistory, true);
  assert.equal(entitlements.historyLimit, 200);
  assert.equal(entitlements.seatsLimit, 3);
  assert.equal(entitlements.accessReason, "active");
});

test("past_due mantém acesso durante a tolerância", () => {
  const entitlements = resolveWorkspaceEntitlements({
    subscription: {
      planId: "growth",
      status: "past_due",
      gracePeriodEndsAt: "2026-08-18T00:00:00.000Z",
    },
    now: NOW,
  });

  assert.equal(entitlements.canUseApp, true);
  assert.equal(entitlements.accessReason, "grace_period");
});

test("scheduled_cancel mantém acesso até o fim do período", () => {
  const entitlements = resolveWorkspaceEntitlements({
    subscription: {
      planId: "growth",
      status: "scheduled_cancel",
      currentPeriodEnd: "2026-09-14T00:00:00.000Z",
    },
    now: NOW,
  });

  assert.equal(entitlements.canUseApp, true);
  assert.equal(entitlements.accessReason, "scheduled_cancel");
});

test("pending bloqueia o app e cai para limites de starter", () => {
  const entitlements = resolveWorkspaceEntitlements({
    subscription: {
      planId: "growth",
      status: "pending",
    },
    now: NOW,
  });

  assert.equal(entitlements.canUseApp, false);
  assert.equal(entitlements.historyLimit, 50);
  assert.equal(entitlements.seatsLimit, 1);
  assert.equal(entitlements.accessReason, "pending");
});

test("unpaid vira no_subscription para o paywall", () => {
  const entitlements = resolveWorkspaceEntitlements({
    subscription: {
      planId: "starter",
      status: "unpaid",
    },
    now: NOW,
  });

  assert.equal(entitlements.canUseApp, false);
  assert.equal(entitlements.accessReason, "no_subscription");
  assert.equal(
    getEntitlementAccessBlockedMessage(entitlements.accessReason),
    "Este workspace ainda não possui uma assinatura ativa. Contrate um plano para liberar esta funcionalidade.",
  );
});

test("paused preserva histórico do plano contratado, mas bloqueia uso", () => {
  const entitlements = resolveWorkspaceEntitlements({
    subscription: {
      planId: "growth",
      status: "paused",
    },
    now: NOW,
  });

  assert.equal(entitlements.canUseApp, false);
  assert.equal(entitlements.historyLimit, 200);
  assert.equal(entitlements.seatsLimit, 3);
  assert.equal(entitlements.accessReason, "paused");
});

test("accessUntil futuro concede exceção administrativa sem mudar o status comercial", () => {
  const entitlements = resolveWorkspaceEntitlements({
    subscription: {
      planId: "growth",
      status: "canceled",
      accessUntil: "2026-08-20T00:00:00.000Z",
    },
    now: NOW,
  });

  assert.equal(entitlements.canUseApp, true);
  assert.equal(entitlements.accessReason, "active");
});
