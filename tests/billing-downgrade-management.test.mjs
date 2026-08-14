import assert from "node:assert/strict";
import test from "node:test";

import {
  scheduleBillingSubscriptionDowngrade,
  ScheduleBillingDowngradeError,
} from "../src/lib/billing/downgrade-management.ts";

test("agenda downgrade e prepara o próximo valor no provider", async () => {
  const calls = [];

  const change = await scheduleBillingSubscriptionDowngrade({
    subscription: {
      id: "sub-1",
      workspaceId: "workspace-1",
      planId: "growth",
      billingCycle: "monthly",
      status: "active",
      autoRenew: true,
      cancelAtPeriodEnd: false,
      provider: "mercado_pago",
      providerSubscriptionId: "mp-sub-1",
      currentPeriodEnd: "2026-09-14T00:00:00.000Z",
    },
    targetPlanId: "starter",
    targetPrice: {
      amountCents: 4900,
      currency: "BRL",
    },
    actorId: "user-1",
    dependencies: {
      provider: {
        async updateSubscriptionAmount(input) {
          calls.push(["provider.updateSubscriptionAmount", input]);
          return {
            provider: "mercado_pago",
            providerSubscriptionId: "mp-sub-1",
            status: "active",
            checkoutUrl: null,
            externalReference: "billing_subscription:sub-1",
            payerEmail: "owner@dabi.app",
          };
        },
      },
      billingService: {
        async scheduleDowngrade(subscriptionId, input) {
          calls.push(["billing.scheduleDowngrade", subscriptionId, input]);
          return {
            id: "chg-1",
            subscriptionId,
            workspaceId: "workspace-1",
            type: "downgrade",
            status: "scheduled",
            fromPlanId: "growth",
            toPlanId: "starter",
            fromBillingCycle: "monthly",
            toBillingCycle: "monthly",
            effectiveAt: "2026-09-14T00:00:00.000Z",
            creditAmountCents: 0,
            chargeAmountCents: 0,
            invoiceId: null,
            requestedByType: "user",
            requestedById: "user-1",
            createdAt: "2026-08-14T12:00:00.000Z",
            appliedAt: null,
            canceledAt: null,
          };
        },
      },
    },
  });

  assert.equal(change.status, "scheduled");
  assert.deepEqual(calls, [
    [
      "provider.updateSubscriptionAmount",
      {
        providerSubscriptionId: "mp-sub-1",
        amountCents: 4900,
        currency: "BRL",
        billingCycle: "monthly",
      },
    ],
    [
      "billing.scheduleDowngrade",
      "sub-1",
      {
        toPlanId: "starter",
        actorType: "user",
        actorId: "user-1",
      },
    ],
  ]);
});

test("bloqueia downgrade quando a assinatura não está apta para renovar", async () => {
  await assert.rejects(
    () =>
      scheduleBillingSubscriptionDowngrade({
        subscription: {
          id: "sub-1",
          workspaceId: "workspace-1",
          planId: "growth",
          billingCycle: "monthly",
          status: "scheduled_cancel",
          autoRenew: false,
          cancelAtPeriodEnd: true,
          provider: "mercado_pago",
          providerSubscriptionId: "mp-sub-1",
          currentPeriodEnd: "2026-09-14T00:00:00.000Z",
        },
        targetPlanId: "starter",
        targetPrice: {
          amountCents: 4900,
          currency: "BRL",
        },
        actorId: "user-1",
        dependencies: {
          provider: null,
          billingService: {
            async scheduleDowngrade() {
              throw new Error("not used");
            },
          },
        },
      }),
    (error) =>
      error instanceof ScheduleBillingDowngradeError &&
      error.code === "DOWNGRADE_INVALID_STATE" &&
      error.status === 409,
  );
});
