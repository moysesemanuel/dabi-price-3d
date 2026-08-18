import assert from "node:assert/strict";
import test from "node:test";

import { createBillingServiceRepository } from "../src/lib/billing/service-repository.ts";

function buildSubscription(overrides = {}) {
  return {
    id: "sub-1",
    workspaceId: "workspace-1",
    planId: "growth",
    billingCycle: "monthly",
    priceId: "price-1",
    status: "pending",
    autoRenew: true,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    cancelRequestedAt: null,
    endedAt: null,
    accessUntil: null,
    provider: "mercado_pago",
    providerSubscriptionId: "mp-sub-1",
    createdAt: "2026-08-14T10:00:00.000Z",
    updatedAt: "2026-08-14T10:00:00.000Z",
    ...overrides,
  };
}

test("createBillingServiceRepository delega create/get/update/audit", async () => {
  const calls = [];
  const createdSubscription = buildSubscription();
  const updatedSubscription = buildSubscription({
    status: "active",
    updatedAt: "2026-08-14T10:05:00.000Z",
  });

  const repository = createBillingServiceRepository({
    async createBillingSubscription(input) {
      calls.push(["createBillingSubscription", input]);
      return createdSubscription;
    },
    async getBillingSubscriptionById(subscriptionId) {
      calls.push(["getBillingSubscriptionById", subscriptionId]);
      return createdSubscription;
    },
    async updateBillingSubscription(subscriptionId, mutation) {
      calls.push(["updateBillingSubscription", subscriptionId, mutation]);
      return updatedSubscription;
    },
    async appendBillingAuditEvent(input) {
      calls.push(["appendBillingAuditEvent", input]);
    },
    async createBillingSubscriptionChange(input) {
      calls.push(["createBillingSubscriptionChange", input]);
      return { id: "chg-1", ...input };
    },
    async findLatestOpenBillingSubscriptionChange(input) {
      calls.push(["findLatestOpenBillingSubscriptionChange", input]);
      return null;
    },
    async updateBillingSubscriptionChange(changeId, mutation) {
      calls.push(["updateBillingSubscriptionChange", changeId, mutation]);
      return { id: changeId, ...mutation };
    },
    async createBillingInvoice(input) {
      calls.push(["createBillingInvoice", input]);
      return { id: "inv-1", ...input };
    },
  });

  assert.deepEqual(
    await repository.createSubscription({
      workspaceId: "workspace-1",
      planId: "growth",
      billingCycle: "monthly",
      status: "pending",
      autoRenew: true,
      provider: "mercado_pago",
      providerSubscriptionId: "mp-sub-1",
    }),
    createdSubscription,
  );

  assert.deepEqual(await repository.getSubscriptionById("sub-1"), createdSubscription);

  assert.deepEqual(
    await repository.updateSubscription("sub-1", {
      status: "active",
      currentPeriodEnd: "2026-09-14T00:00:00.000Z",
    }),
    updatedSubscription,
  );

  await repository.appendAuditEvent({
    workspaceId: "workspace-1",
    subscriptionId: "sub-1",
    actorType: "system",
    action: "subscription.activated",
    metadata: {
      toStatus: "active",
    },
  });

  await repository.createSubscriptionChange({
    subscriptionId: "sub-1",
    workspaceId: "workspace-1",
    type: "downgrade",
    status: "scheduled",
    fromPlanId: "growth",
    toPlanId: "starter",
    fromBillingCycle: "monthly",
    toBillingCycle: "monthly",
    effectiveAt: "2026-09-14T00:00:00.000Z",
    requestedByType: "user",
    requestedById: "user-1",
  });

  await repository.findLatestOpenSubscriptionChange({
    subscriptionId: "sub-1",
    type: "downgrade",
  });

  await repository.updateSubscriptionChange("chg-1", {
    status: "canceled",
    canceledAt: "2026-08-14T12:00:00.000Z",
  });

  await repository.createInvoice({
    subscriptionId: "sub-1",
    workspaceId: "workspace-1",
    priceId: "price-1",
    type: "upgrade",
    status: "pending",
    amountCents: 9900,
    currency: "BRL",
    paymentMethod: "pix_manual",
    provider: "mercado_pago",
  });

  assert.deepEqual(calls, [
    [
      "createBillingSubscription",
      {
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        autoRenew: true,
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-1",
      },
    ],
    ["getBillingSubscriptionById", "sub-1"],
    [
      "updateBillingSubscription",
      "sub-1",
      {
        status: "active",
        currentPeriodEnd: "2026-09-14T00:00:00.000Z",
      },
    ],
    [
      "appendBillingAuditEvent",
      {
        workspaceId: "workspace-1",
        subscriptionId: "sub-1",
        actorType: "system",
        action: "subscription.activated",
        metadata: {
          toStatus: "active",
        },
      },
    ],
    [
      "createBillingSubscriptionChange",
      {
        subscriptionId: "sub-1",
        workspaceId: "workspace-1",
        type: "downgrade",
        status: "scheduled",
        fromPlanId: "growth",
        toPlanId: "starter",
        fromBillingCycle: "monthly",
        toBillingCycle: "monthly",
        effectiveAt: "2026-09-14T00:00:00.000Z",
        requestedByType: "user",
        requestedById: "user-1",
      },
    ],
    [
      "findLatestOpenBillingSubscriptionChange",
      {
        subscriptionId: "sub-1",
        type: "downgrade",
      },
    ],
    [
      "updateBillingSubscriptionChange",
      "chg-1",
      {
        status: "canceled",
        canceledAt: "2026-08-14T12:00:00.000Z",
      },
    ],
    [
      "createBillingInvoice",
      {
        subscriptionId: "sub-1",
        workspaceId: "workspace-1",
        priceId: "price-1",
        type: "upgrade",
        status: "pending",
        amountCents: 9900,
        currency: "BRL",
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
      },
    ],
  ]);
});
