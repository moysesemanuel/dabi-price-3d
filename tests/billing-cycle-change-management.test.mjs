import assert from "node:assert/strict";
import test from "node:test";

import {
  applyBillingSubscriptionCycleChange,
  calculateMonthlyToAnnualCycleChangeAmounts,
  requestMonthlyToAnnualCycleChange,
  scheduleAnnualToMonthlyCycleChange,
} from "../src/lib/billing/cycle-change-management.ts";

const monthlySubscription = {
  id: "sub-1",
  workspaceId: "workspace-1",
  planId: "growth",
  billingCycle: "monthly",
  status: "active",
  autoRenew: true,
  cancelAtPeriodEnd: false,
  provider: "mercado_pago",
  providerSubscriptionId: "mp-sub-1",
  currentPeriodStart: "2026-08-01T00:00:00.000Z",
  currentPeriodEnd: "2026-09-01T00:00:00.000Z",
};

test("calcula o crédito proporcional do mensal sobre a cobrança anual integral", () => {
  const amounts = calculateMonthlyToAnnualCycleChangeAmounts({
    currentPrice: { amountCents: 14900 },
    targetAnnualPrice: { amountCents: 149000 },
    subscription: monthlySubscription,
    asOf: "2026-08-16T12:00:00.000Z",
  });

  assert.equal(amounts.chargeAmountCents, 149000);
  assert.equal(amounts.creditAmountCents, 7450);
  assert.equal(amounts.netAmountCents, 141550);
});

test("mensal para anual cria uma mudança pendente com crédito e ciclo anual", async () => {
  const calls = [];

  await requestMonthlyToAnnualCycleChange({
    subscription: monthlySubscription,
    currentPrice: { amountCents: 14900 },
    targetAnnualPrice: {
      id: "price-growth-annual",
      billingCycle: "annual",
      amountCents: 149000,
      currency: "BRL",
    },
    actorId: "user-1",
    asOf: "2026-08-16T12:00:00.000Z",
    billingService: {
      async requestCycleChange(subscriptionId, input) {
        calls.push({ subscriptionId, input });
        return { change: { id: "chg-1" }, invoice: { id: "inv-1" } };
      },
    },
  });

  assert.deepEqual(calls, [
    {
      subscriptionId: "sub-1",
      input: {
        actorType: "user",
        actorId: "user-1",
        priceId: "price-growth-annual",
        amountCents: 141550,
        currency: "BRL",
        creditAmountCents: 7450,
        chargeAmountCents: 149000,
        periodStart: "2026-08-16T12:00:00.000Z",
        periodEnd: "2027-08-16T12:00:00.000Z",
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
      },
    },
  ]);
});

test("anual para mensal prepara a próxima cobrança e agenda para o fim do período", async () => {
  const calls = [];

  const change = await scheduleAnnualToMonthlyCycleChange({
    subscription: {
      ...monthlySubscription,
      billingCycle: "annual",
      currentPeriodEnd: "2027-08-01T00:00:00.000Z",
    },
    targetMonthlyPrice: {
      billingCycle: "monthly",
      amountCents: 14900,
      currency: "BRL",
    },
    actorId: "user-1",
    dependencies: {
      provider: {
        async updateSubscriptionAmount(input) {
          calls.push(["provider.updateSubscriptionAmount", input]);
          return {};
        },
      },
      billingService: {
        async scheduleCycleChange(subscriptionId, input) {
          calls.push(["billing.scheduleCycleChange", subscriptionId, input]);
          return { id: "chg-2", status: "scheduled" };
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
        amountCents: 14900,
        currency: "BRL",
        billingCycle: "monthly",
      },
    ],
    [
      "billing.scheduleCycleChange",
      "sub-1",
      { actorType: "user", actorId: "user-1" },
    ],
  ]);
});

test("pagamento confirmado muda a vigência para doze meses e atualiza a recorrência", async () => {
  const calls = [];

  await applyBillingSubscriptionCycleChange({
    subscription: monthlySubscription,
    change: {
      id: "chg-3",
      toPlanId: "growth",
      toBillingCycle: "annual",
      status: "pending_payment",
    },
    invoice: { id: "inv-3" },
    actorType: "webhook",
    source: "billing-webhook-cycle-change",
    description: "Mudança de ciclo aplicada.",
    nowIso: "2026-08-16T12:00:00.000Z",
    dependencies: {
      async findActivePrice() {
        return {
          id: "price-growth-annual",
          planId: "growth",
          billingCycle: "annual",
          amountCents: 149000,
          currency: "BRL",
        };
      },
      getProvider() {
        return {
          async updateSubscriptionAmount(input) {
            calls.push(["provider.updateSubscriptionAmount", input]);
            return {};
          },
        };
      },
      billingService: {
        async applyCycleChange(subscriptionId, input) {
          calls.push(["billing.applyCycleChange", subscriptionId, input]);
        },
      },
      async updateSubscriptionChange(changeId, mutation) {
        calls.push(["repository.updateSubscriptionChange", changeId, mutation]);
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
        providerSubscriptionId: "mp-sub-1",
        amountCents: 149000,
        currency: "BRL",
        billingCycle: "annual",
      },
    ],
    [
      "billing.applyCycleChange",
      "sub-1",
      {
        actorType: "webhook",
        billingCycle: "annual",
        priceId: "price-growth-annual",
        currentPeriodStart: "2026-08-16T12:00:00.000Z",
        currentPeriodEnd: "2027-08-16T12:00:00.000Z",
        changeId: "chg-3",
      },
    ],
    [
      "repository.updateSubscriptionChange",
      "chg-3",
      { status: "applied", appliedAt: "2026-08-16T12:00:00.000Z" },
    ],
    [
      "workspace.update",
      {
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "annual",
        status: "active",
        source: "billing-webhook-cycle-change",
        mercadoPagoSubscriptionId: "mp-sub-1",
        description: "Mudança de ciclo aplicada.",
      },
    ],
  ]);
});
