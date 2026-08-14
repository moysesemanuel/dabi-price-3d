import assert from "node:assert/strict";
import test from "node:test";

import {
  didProjectedWorkspaceSubscriptionChange,
  projectWorkspacePreferencesSubscription,
  sanitizePersistedWorkspaceSubscription,
} from "../src/lib/billing/workspace-subscription-projection.ts";

function buildSubscription(overrides = {}) {
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

test("projeta starter unpaid quando nao existe assinatura corrente no billing", () => {
  const projected = projectWorkspacePreferencesSubscription({
    currentSubscription: buildSubscription({
      planId: "growth",
      status: "canceled",
      billingCycle: "annual",
      seatsUsed: 3,
      mercadoPagoSubscriptionId: "sub-old",
      checkoutStartedAt: "2026-08-14T10:00:00.000Z",
    }),
    billingSubscription: null,
  });

  assert.deepEqual(projected, {
    ...buildSubscription(),
    seatsUsed: 3,
    checkoutStartedAt: "2026-08-14T10:00:00.000Z",
  });
});

test("sanitiza a assinatura persistida removendo o espelho comercial", () => {
  const sanitized = sanitizePersistedWorkspaceSubscription({
    currentSubscription: buildSubscription({
      planId: "growth",
      status: "active",
      billingCycle: "annual",
      seatsUsed: 3,
      mercadoPagoSubscriptionId: "sub-123",
      checkoutStartedAt: "2026-08-14T11:00:00.000Z",
    }),
  });

  assert.deepEqual(sanitized, {
    ...buildSubscription(),
    seatsUsed: 3,
    checkoutStartedAt: "2026-08-14T11:00:00.000Z",
  });
});

test("projeta a assinatura corrente do billing preservando seats e checkoutStartedAt", () => {
  const projected = projectWorkspacePreferencesSubscription({
    currentSubscription: buildSubscription({
      seatsUsed: 4,
      checkoutStartedAt: "2026-08-14T11:00:00.000Z",
    }),
    billingSubscription: {
      planId: "growth",
      billingCycle: "annual",
      status: "active",
      providerSubscriptionId: "sub-123",
    },
  });

  assert.deepEqual(projected, {
    ...buildSubscription(),
    planId: "growth",
    billingCycle: "annual",
    status: "active",
    seatsUsed: 4,
    mercadoPagoSubscriptionId: "sub-123",
    checkoutStartedAt: "2026-08-14T11:00:00.000Z",
  });
});

test("considera checkoutStartedAt na deteccao de mudanca da projecao", () => {
  assert.equal(
    didProjectedWorkspaceSubscriptionChange(
      buildSubscription({
        checkoutStartedAt: "2026-08-14T11:00:00.000Z",
      }),
      buildSubscription({
        checkoutStartedAt: null,
      }),
    ),
    true,
  );
});

test("nao sinaliza mudanca quando a projecao monitorada permanece igual", () => {
  assert.equal(
    didProjectedWorkspaceSubscriptionChange(
      buildSubscription({
        planId: "growth",
        status: "pending",
        billingCycle: "annual",
        mercadoPagoSubscriptionId: "sub-123",
        checkoutStartedAt: "2026-08-14T11:00:00.000Z",
      }),
      buildSubscription({
        planId: "growth",
        status: "pending",
        billingCycle: "annual",
        mercadoPagoSubscriptionId: "sub-123",
        checkoutStartedAt: "2026-08-14T11:00:00.000Z",
      }),
    ),
    false,
  );
});
