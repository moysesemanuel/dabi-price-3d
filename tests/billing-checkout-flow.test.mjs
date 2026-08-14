import assert from "node:assert/strict";
import test from "node:test";

import { resolveSubscriptionCheckoutFlow } from "../src/lib/billing/checkout-flow.ts";

test("reaproveita checkout pendente do billing quando o plano continua o mesmo", () => {
  assert.deepEqual(
    resolveSubscriptionCheckoutFlow({
      selectedPlanId: "growth",
      selectedBillingCycle: "monthly",
      billingSubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        providerSubscriptionId: "sub-123",
      },
      legacySubscription: {
        planId: "starter",
        billingCycle: "monthly",
        status: "unpaid",
        mercadoPagoSubscriptionId: null,
      },
    }),
    {
      type: "resume_pending_checkout",
      source: "billing",
    },
  );
});

test("substitui checkout pendente do billing quando o plano muda", () => {
  assert.deepEqual(
    resolveSubscriptionCheckoutFlow({
      selectedPlanId: "starter",
      selectedBillingCycle: "monthly",
      billingSubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        providerSubscriptionId: "sub-123",
      },
      legacySubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        mercadoPagoSubscriptionId: "sub-123",
      },
    }),
    {
      type: "replace_pending_checkout",
      source: "billing",
    },
  );
});

test("substitui checkout pendente do billing quando a assinatura local nao tem provider id", () => {
  assert.deepEqual(
    resolveSubscriptionCheckoutFlow({
      selectedPlanId: "growth",
      selectedBillingCycle: "monthly",
      billingSubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        providerSubscriptionId: null,
      },
      legacySubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        mercadoPagoSubscriptionId: "sub-123",
      },
    }),
    {
      type: "replace_pending_checkout",
      source: "billing",
    },
  );
});

test("bloqueia nova contratacao quando o billing atual ja concede acesso", () => {
  assert.deepEqual(
    resolveSubscriptionCheckoutFlow({
      selectedPlanId: "growth",
      selectedBillingCycle: "monthly",
      billingSubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "scheduled_cancel",
        providerSubscriptionId: "sub-123",
      },
      legacySubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "active",
        mercadoPagoSubscriptionId: "sub-123",
      },
    }),
    {
      type: "block_active_subscription",
      source: "billing",
    },
  );
});

test("reaproveita checkout pendente legado quando ainda nao existe billing atual", () => {
  assert.deepEqual(
    resolveSubscriptionCheckoutFlow({
      selectedPlanId: "starter",
      selectedBillingCycle: "monthly",
      billingSubscription: null,
      legacySubscription: {
        planId: "starter",
        billingCycle: "monthly",
        status: "pending",
        mercadoPagoSubscriptionId: "sub-123",
      },
    }),
    {
      type: "resume_pending_checkout",
      source: "legacy",
    },
  );
});

test("nao reutiliza checkout legado de outro plano", () => {
  assert.deepEqual(
    resolveSubscriptionCheckoutFlow({
      selectedPlanId: "starter",
      selectedBillingCycle: "monthly",
      billingSubscription: null,
      legacySubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        mercadoPagoSubscriptionId: "sub-123",
      },
    }),
    {
      type: "replace_pending_checkout",
      source: "legacy",
    },
  );
});

test("workspace unpaid sem pendencia abre um novo checkout", () => {
  assert.deepEqual(
    resolveSubscriptionCheckoutFlow({
      selectedPlanId: "starter",
      selectedBillingCycle: "monthly",
      billingSubscription: null,
      legacySubscription: {
        planId: "starter",
        billingCycle: "monthly",
        status: "unpaid",
        mercadoPagoSubscriptionId: null,
      },
    }),
    {
      type: "create_new_checkout",
      source: "none",
    },
  );
});

test("substitui checkout pendente quando o ciclo muda no mesmo plano", () => {
  assert.deepEqual(
    resolveSubscriptionCheckoutFlow({
      selectedPlanId: "growth",
      selectedBillingCycle: "annual",
      billingSubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        providerSubscriptionId: "sub-123",
      },
      legacySubscription: {
        planId: "growth",
        billingCycle: "monthly",
        status: "pending",
        mercadoPagoSubscriptionId: "sub-123",
      },
    }),
    {
      type: "replace_pending_checkout",
      source: "billing",
    },
  );
});
