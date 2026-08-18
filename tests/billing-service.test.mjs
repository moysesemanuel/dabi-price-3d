import assert from "node:assert/strict";
import test from "node:test";

import { BillingService } from "../src/lib/billing/service.ts";

function createInMemoryBillingRepository() {
  const subscriptions = new Map();
  const changes = new Map();
  const invoices = new Map();
  const auditEvents = [];
  let nextId = 1;
  let nextChangeId = 1;
  let nextInvoiceId = 1;

  return {
    auditEvents,
    invoices,
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
    async createSubscriptionChange(input) {
      const change = {
        id: `chg-${nextChangeId++}`,
        subscriptionId: input.subscriptionId,
        workspaceId: input.workspaceId,
        type: input.type,
        status: input.status,
        fromPlanId: input.fromPlanId ?? null,
        toPlanId: input.toPlanId ?? null,
        fromBillingCycle: input.fromBillingCycle ?? null,
        toBillingCycle: input.toBillingCycle ?? null,
        effectiveAt: input.effectiveAt,
        creditAmountCents: input.creditAmountCents ?? 0,
        chargeAmountCents: input.chargeAmountCents ?? 0,
        invoiceId: input.invoiceId ?? null,
        requestedByType: input.requestedByType ?? null,
        requestedById: input.requestedById ?? null,
        createdAt: "2026-08-14T10:00:00.000Z",
        appliedAt: null,
        canceledAt: null,
      };

      changes.set(change.id, change);
      return change;
    },
    async findLatestOpenSubscriptionChange(input) {
      return (
        Array.from(changes.values())
          .filter((change) => {
            if (change.subscriptionId !== input.subscriptionId) {
              return false;
            }

            if (
              change.status !== "scheduled" &&
              change.status !== "pending_payment"
            ) {
              return false;
            }

            return input.type ? change.type === input.type : true;
          })
          .sort((left, right) => right.id.localeCompare(left.id))[0] ?? null
      );
    },
    async updateSubscriptionChange(changeId, mutation) {
      const current = changes.get(changeId);

      if (!current) {
        return null;
      }

      const next = {
        ...current,
        ...mutation,
      };

      changes.set(changeId, next);
      return next;
    },
    async createInvoice(input) {
      const invoice = {
        id: `inv-${nextInvoiceId++}`,
        subscriptionId: input.subscriptionId,
        workspaceId: input.workspaceId,
        priceId: input.priceId ?? null,
        type: input.type,
        status: input.status,
        amountCents: input.amountCents,
        currency: input.currency ?? "BRL",
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodEnd ?? null,
        paymentMethod: input.paymentMethod ?? null,
        provider: input.provider ?? null,
        providerPaymentId: input.providerPaymentId ?? null,
        providerAuthorizedPaymentId: input.providerAuthorizedPaymentId ?? null,
        paymentExpiresAt: input.paymentExpiresAt ?? null,
        paidAt: input.paidAt ?? null,
        failedAt: input.failedAt ?? null,
        refundedAt: input.refundedAt ?? null,
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };

      invoices.set(invoice.id, invoice);
      return invoice;
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

test("renewSubscription atualiza o período e registra renovação", async () => {
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

  const renewed = await service.renewSubscription(subscription.id, {
    actorType: "system",
    currentPeriodStart: "2026-09-14T00:00:00.000Z",
    currentPeriodEnd: "2026-10-14T00:00:00.000Z",
    accessUntil: "2026-10-14T00:00:00.000Z",
  });

  assert.equal(renewed.status, "active");
  assert.equal(renewed.currentPeriodStart, "2026-09-14T00:00:00.000Z");
  assert.equal(renewed.currentPeriodEnd, "2026-10-14T00:00:00.000Z");
  assert.equal(repository.auditEvents.at(-1)?.action, "subscription.renewed");
});

test("renewSubscription recupera assinatura em past_due", async () => {
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
  await service.markPastDue(subscription.id, {
    gracePeriodEndsAt: "2026-09-19T00:00:00.000Z",
  });

  const renewed = await service.renewSubscription(subscription.id, {
    actorType: "system",
    currentPeriodStart: "2026-09-14T00:00:00.000Z",
    currentPeriodEnd: "2026-10-14T00:00:00.000Z",
    accessUntil: "2026-10-14T00:00:00.000Z",
  });

  assert.equal(renewed.status, "active");
  assert.equal(renewed.gracePeriodEndsAt, null);
  assert.equal(repository.auditEvents.at(-1)?.action, "subscription.recovered");
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

test("applyScheduledChange atualiza termos sem escrever direto no repositório", async () => {
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

  const changed = await service.applyScheduledChange(subscription.id, {
    actorType: "system",
    planId: "starter",
    billingCycle: "annual",
    priceId: "price-annual-starter",
    metadata: {
      changeId: "chg-1",
      type: "cycle_change",
    },
  });

  assert.equal(changed.planId, "starter");
  assert.equal(changed.billingCycle, "annual");
  assert.equal(changed.priceId, "price-annual-starter");
  assert.equal(repository.auditEvents.at(-1)?.action, "subscription.change_applied");
  assert.equal(repository.auditEvents.at(-1)?.metadata?.changeId, "chg-1");
});

test("scheduleDowngrade cria mudança agendada para o fim do período", async () => {
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

  const change = await service.scheduleDowngrade(subscription.id, {
    actorType: "user",
    actorId: "user-1",
    toPlanId: "starter",
  });

  assert.equal(change.type, "downgrade");
  assert.equal(change.status, "scheduled");
  assert.equal(change.fromPlanId, "growth");
  assert.equal(change.toPlanId, "starter");
  assert.equal(change.effectiveAt, "2026-09-14T00:00:00.000Z");
  assert.equal(
    repository.auditEvents.at(-1)?.action,
    "subscription.downgrade_scheduled",
  );
});

test("requestUpgrade cria mudança pending_payment e invoice proporcional", async () => {
  const repository = createInMemoryBillingRepository();
  const service = new BillingService(repository, {
    now: () => new Date("2026-08-20T12:00:00.000Z"),
  });
  const subscription = await service.createSubscription({
    workspaceId: "workspace-1",
    planId: "starter",
    billingCycle: "monthly",
    autoRenew: true,
    provider: "mercado_pago",
    providerSubscriptionId: "mp-sub-1",
  });

  await service.activateSubscription(subscription.id, {
    currentPeriodStart: "2026-08-14T00:00:00.000Z",
    currentPeriodEnd: "2026-09-14T00:00:00.000Z",
  });

  const result = await service.requestUpgrade(subscription.id, {
    actorType: "user",
    actorId: "user-1",
    toPlanId: "growth",
    priceId: "price-growth-monthly",
    amountCents: 9900,
    currency: "BRL",
    creditAmountCents: 1500,
    chargeAmountCents: 11400,
    periodStart: "2026-08-20T12:00:00.000Z",
    periodEnd: "2026-09-14T00:00:00.000Z",
    paymentMethod: "pix_manual",
    provider: "mercado_pago",
  });

  assert.equal(result.change.type, "upgrade");
  assert.equal(result.change.status, "pending_payment");
  assert.equal(result.change.fromPlanId, "starter");
  assert.equal(result.change.toPlanId, "growth");
  assert.equal(result.change.invoiceId, result.invoice.id);
  assert.equal(result.invoice.type, "upgrade");
  assert.equal(result.invoice.status, "pending");
  assert.equal(result.invoice.amountCents, 9900);
  assert.equal(result.invoice.paymentMethod, "pix_manual");
  assert.equal(
    repository.auditEvents.at(-1)?.action,
    "subscription.upgrade_requested",
  );
});

test("applyUpgrade reaproveita a infraestrutura de mudança imediata", async () => {
  const repository = createInMemoryBillingRepository();
  const service = new BillingService(repository);
  const subscription = await service.createSubscription({
    workspaceId: "workspace-1",
    planId: "starter",
    billingCycle: "monthly",
    autoRenew: true,
    provider: "mercado_pago",
    providerSubscriptionId: "mp-sub-1",
  });

  await service.activateSubscription(subscription.id, {
    currentPeriodStart: "2026-08-14T00:00:00.000Z",
    currentPeriodEnd: "2026-09-14T00:00:00.000Z",
  });

  const upgraded = await service.applyUpgrade(subscription.id, {
    actorType: "system",
    toPlanId: "growth",
    priceId: "price-growth-monthly",
    changeId: "chg-up-1",
  });

  assert.equal(upgraded.planId, "growth");
  assert.equal(upgraded.priceId, "price-growth-monthly");
  assert.equal(repository.auditEvents.at(-1)?.action, "subscription.upgraded");
  assert.equal(repository.auditEvents.at(-1)?.metadata?.changeId, "chg-up-1");
});
