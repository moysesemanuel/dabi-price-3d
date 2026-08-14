import assert from "node:assert/strict";
import test from "node:test";

import { BillingService } from "../src/lib/billing/service.ts";

function createInMemoryBillingRepository() {
  const subscriptions = new Map();
  const auditEvents = [];
  let nextId = 1;

  return {
    auditEvents,
    async createSubscription(input) {
      const subscription = {
        id: `sub-${nextId++}`,
        workspaceId: input.workspaceId,
        planId: input.planId,
        billingCycle: input.billingCycle,
        priceId: input.priceId ?? null,
        status: input.status,
        autoRenew: input.autoRenew ?? false,
        currentPeriodStart: input.currentPeriodStart ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
        gracePeriodEndsAt: input.gracePeriodEndsAt ?? null,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        cancelRequestedAt: input.cancelRequestedAt ?? null,
        endedAt: input.endedAt ?? null,
        accessUntil: input.accessUntil ?? null,
        provider: input.provider ?? null,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };

      subscriptions.set(subscription.id, subscription);
      return subscription;
    },
    async getSubscriptionById(subscriptionId) {
      return subscriptions.get(subscriptionId) ?? null;
    },
    async updateSubscription(subscriptionId, mutation) {
      const current = subscriptions.get(subscriptionId);

      if (!current) {
        return null;
      }

      const next = {
        ...current,
        ...mutation,
        updatedAt: "2026-08-14T10:05:00.000Z",
      };

      subscriptions.set(subscriptionId, next);
      return next;
    },
    async appendAuditEvent(input) {
      auditEvents.push(input);
    },
  };
}

test("createSubscription cria assinatura pending e registra auditoria", async () => {
  const repository = createInMemoryBillingRepository();
  const service = new BillingService(repository);

  const subscription = await service.createSubscription({
    workspaceId: "workspace-1",
    planId: "starter",
    billingCycle: "monthly",
    autoRenew: false,
    provider: "mercado_pago",
    providerSubscriptionId: "mp-sub-1",
  });

  assert.equal(subscription.status, "pending");
  assert.equal(subscription.workspaceId, "workspace-1");
  assert.equal(subscription.planId, "starter");
  assert.equal(subscription.billingCycle, "monthly");
  assert.equal(subscription.providerSubscriptionId, "mp-sub-1");
  assert.equal(repository.auditEvents[0]?.action, "subscription.created");
});

test("activateSubscription ativa assinatura pendente e define período", async () => {
  const repository = createInMemoryBillingRepository();
  const service = new BillingService(repository);
  const subscription = await service.createSubscription({
    workspaceId: "workspace-1",
    planId: "growth",
    billingCycle: "monthly",
    autoRenew: true,
  });

  const activated = await service.activateSubscription(subscription.id, {
    currentPeriodStart: "2026-08-14T00:00:00.000Z",
    currentPeriodEnd: "2026-09-14T00:00:00.000Z",
  });

  assert.equal(activated.status, "active");
  assert.equal(activated.currentPeriodStart, "2026-08-14T00:00:00.000Z");
  assert.equal(activated.currentPeriodEnd, "2026-09-14T00:00:00.000Z");
  assert.equal(activated.accessUntil, "2026-09-14T00:00:00.000Z");
  assert.equal(repository.auditEvents.at(-1)?.action, "subscription.activated");
});

test("scheduleCancellation e revertCancellation centralizam a regra", async () => {
  const repository = createInMemoryBillingRepository();
  const service = new BillingService(repository, {
    now: () => new Date("2026-08-14T12:00:00.000Z"),
  });
  const subscription = await service.createSubscription({
    workspaceId: "workspace-1",
    planId: "growth",
    billingCycle: "monthly",
    autoRenew: true,
  });

  await service.activateSubscription(subscription.id, {
    currentPeriodStart: "2026-08-14T00:00:00.000Z",
    currentPeriodEnd: "2026-09-14T00:00:00.000Z",
  });

  const scheduled = await service.scheduleCancellation(subscription.id, {
    actorType: "user",
    actorId: "user-1",
  });

  assert.equal(scheduled.status, "scheduled_cancel");
  assert.equal(scheduled.autoRenew, false);
  assert.equal(scheduled.cancelAtPeriodEnd, true);
  assert.equal(scheduled.cancelRequestedAt, "2026-08-14T12:00:00.000Z");

  const reverted = await service.revertCancellation(subscription.id, {
    actorType: "user",
    actorId: "user-1",
  });

  assert.equal(reverted.status, "active");
  assert.equal(reverted.autoRenew, true);
  assert.equal(reverted.cancelAtPeriodEnd, false);
  assert.equal(reverted.cancelRequestedAt, null);
});

test("markPastDue em pending falha por transição inválida", async () => {
  const repository = createInMemoryBillingRepository();
  const service = new BillingService(repository);
  const subscription = await service.createSubscription({
    workspaceId: "workspace-1",
    planId: "starter",
    billingCycle: "monthly",
  });

  await assert.rejects(
    () =>
      service.markPastDue(subscription.id, {
        gracePeriodEndsAt: "2026-08-19T00:00:00.000Z",
      }),
    /Invalid billing subscription transition: pending -> past_due/,
  );
});

test("finalizeCancellation encerra assinatura agendada", async () => {
  const repository = createInMemoryBillingRepository();
  const service = new BillingService(repository);
  const subscription = await service.createSubscription({
    workspaceId: "workspace-1",
    planId: "growth",
    billingCycle: "monthly",
    autoRenew: true,
  });

  await service.activateSubscription(subscription.id, {
    currentPeriodStart: "2026-08-14T00:00:00.000Z",
    currentPeriodEnd: "2026-09-14T00:00:00.000Z",
  });
  await service.scheduleCancellation(subscription.id);

  const canceled = await service.finalizeCancellation(subscription.id, {
    endedAt: "2026-09-14T00:00:00.000Z",
  });

  assert.equal(canceled.status, "canceled");
  assert.equal(canceled.endedAt, "2026-09-14T00:00:00.000Z");
  assert.equal(canceled.accessUntil, "2026-09-14T00:00:00.000Z");
  assert.equal(repository.auditEvents.at(-1)?.action, "subscription.canceled");
});
