import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBillingSubscriptionUpgrade,
  requestBillingSubscriptionUpgrade,
} from "../src/lib/billing/upgrade-management.ts";

test("requestBillingSubscriptionUpgrade calcula proporcional e delega ao billing service", async () => {
  const calls = [];

  await requestBillingSubscriptionUpgrade({
    subscription: {
      id: "sub-1",
      workspaceId: "workspace-1",
      planId: "starter",
      billingCycle: "monthly",
      status: "active",
      autoRenew: true,
      cancelAtPeriodEnd: false,
      provider: "mercado_pago",
      providerSubscriptionId: "mp-sub-1",
      currentPeriodStart: "2026-08-01T00:00:00.000Z",
      currentPeriodEnd: "2026-08-11T00:00:00.000Z",
      priceId: "price-starter-monthly",
    },
    currentPrice: {
      amountCents: 5000,
    },
    targetPrice: {
      id: "price-growth-monthly",
      planId: "growth",
      amountCents: 15000,
      currency: "BRL",
    },
    actorId: "user-1",
    asOf: "2026-08-06T00:00:00.000Z",
    billingService: {
      async requestUpgrade(subscriptionId, input) {
        calls.push({ subscriptionId, input });
        return {
          change: { id: "chg-1" },
          invoice: { id: "inv-1" },
        };
      },
    },
  });

  assert.equal(calls[0]?.subscriptionId, "sub-1");
  assert.equal(calls[0]?.input.toPlanId, "growth");
  assert.equal(calls[0]?.input.amountCents, 5000);
  assert.equal(calls[0]?.input.creditAmountCents, 2500);
  assert.equal(calls[0]?.input.chargeAmountCents, 7500);
  assert.equal(calls[0]?.input.paymentMethod, "pix_manual");
});

test("applyBillingSubscriptionUpgrade atualiza provider, billing e espelho do workspace", async () => {
  const calls = [];

  await applyBillingSubscriptionUpgrade({
    subscription: {
      id: "sub-2",
      workspaceId: "workspace-2",
      billingCycle: "monthly",
      provider: "mercado_pago",
      providerSubscriptionId: "mp-sub-2",
    },
    change: {
      id: "chg-2",
      toPlanId: "growth",
      toBillingCycle: "monthly",
      status: "pending_payment",
    },
    invoice: {
      id: "inv-2",
    },
    actorType: "system",
    source: "billing-reconciliation-upgrade",
    description: "Reconciliação aplicou upgrade.",
    nowIso: "2026-08-14T12:00:00.000Z",
    dependencies: {
      async findActivePrice(input) {
        assert.equal(input.planId, "growth");
        return {
          id: "price-growth-monthly",
          planId: "growth",
          billingCycle: "monthly",
          amountCents: 14900,
          currency: "BRL",
          activeFrom: "2026-01-01T00:00:00.000Z",
          activeUntil: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        };
      },
      getProvider() {
        return {
          async updateSubscriptionAmount(input) {
            calls.push(["provider.updateSubscriptionAmount", input]);
            return {
              provider: "mercado_pago",
              providerSubscriptionId: "mp-sub-2",
              status: "active",
              checkoutUrl: null,
              externalReference: "billing_subscription:sub-2",
              payerEmail: "owner@dabi.app",
            };
          },
        };
      },
      billingService: {
        async applyUpgrade(subscriptionId, input) {
          calls.push(["billing.applyUpgrade", subscriptionId, input]);
        },
      },
      async updateSubscriptionChange(changeId, mutation) {
        calls.push(["repo.updateSubscriptionChange", changeId, mutation]);
        return null;
      },
      async applyWorkspaceSubscriptionUpdate(input) {
        calls.push(["workspace.update", input]);
        return { changed: true };
      },
    },
  });

  assert.deepEqual(calls, [
    [
      "provider.updateSubscriptionAmount",
      {
        providerSubscriptionId: "mp-sub-2",
        amountCents: 14900,
        currency: "BRL",
        billingCycle: "monthly",
      },
    ],
    [
      "billing.applyUpgrade",
      "sub-2",
      {
        actorType: "system",
        toPlanId: "growth",
        priceId: "price-growth-monthly",
        changeId: "chg-2",
      },
    ],
    [
      "repo.updateSubscriptionChange",
      "chg-2",
      {
        status: "applied",
        appliedAt: "2026-08-14T12:00:00.000Z",
      },
    ],
    [
      "workspace.update",
      {
        workspaceId: "workspace-2",
        planId: "growth",
        billingCycle: "monthly",
        status: "active",
        source: "billing-reconciliation-upgrade",
        mercadoPagoSubscriptionId: "mp-sub-2",
        description: "Reconciliação aplicou upgrade.",
      },
    ],
  ]);
});
