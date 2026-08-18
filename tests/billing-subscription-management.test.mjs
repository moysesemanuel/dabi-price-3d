import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageBillingSubscriptionAction,
  manageMercadoPagoBillingSubscription,
  ManageBillingSubscriptionError,
} from "../src/lib/billing/subscription-management.ts";

test("cancel agendado usa provider + billing service e espelha status legado", async () => {
  const calls = [];

  const result = await manageMercadoPagoBillingSubscription({
    action: "cancel",
    actorId: "user-1",
    subscription: {
      id: "sub-1",
      workspaceId: "workspace-1",
      planId: "growth",
      billingCycle: "monthly",
      status: "active",
      provider: "mercado_pago",
      providerSubscriptionId: "mp-sub-1",
    },
    dependencies: {
      provider: {
        async cancelSubscription(providerSubscriptionId) {
          calls.push(["provider.cancel", providerSubscriptionId]);
          return {
            provider: "mercado_pago",
            providerSubscriptionId,
            status: "canceled",
            checkoutUrl: null,
            externalReference: "billing_subscription:sub-1",
            payerEmail: "owner@dabi.app",
          };
        },
        async resumeSubscription() {
          throw new Error("not used");
        },
      },
      billingService: {
        async scheduleCancellation(subscriptionId, input) {
          calls.push(["billing.schedule", subscriptionId, input]);
          return {
            id: subscriptionId,
            workspaceId: "workspace-1",
            planId: "growth",
            billingCycle: "monthly",
            status: "scheduled_cancel",
          };
        },
        async revertCancellation() {
          throw new Error("not used");
        },
      },
      async applyWorkspaceSubscriptionUpdate(input) {
        calls.push(["workspace.sync", input]);
      },
    },
  });

  assert.equal(result.localSubscription.status, "scheduled_cancel");
  assert.deepEqual(calls, [
    ["provider.cancel", "mp-sub-1"],
    [
      "billing.schedule",
      "sub-1",
      {
        actorType: "user",
        actorId: "user-1",
      },
    ],
    [
      "workspace.sync",
      {
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "monthly",
        status: "canceled",
        source: "billing-subscription-manage",
        mercadoPagoSubscriptionId: "mp-sub-1",
        description: "Renovação da assinatura cancelada pelo workspace.",
      },
    ],
  ]);
});

test("reversão de cancelamento reativa a renovação antes do fim do período", async () => {
  const calls = [];

  const result = await manageMercadoPagoBillingSubscription({
    action: "resume",
    actorId: "user-7",
    subscription: {
      id: "sub-9",
      workspaceId: "workspace-9",
      planId: "growth",
      billingCycle: "monthly",
      status: "scheduled_cancel",
      provider: "mercado_pago",
      providerSubscriptionId: "mp-sub-9",
    },
    dependencies: {
      provider: {
        async cancelSubscription() {
          throw new Error("not used");
        },
        async resumeSubscription(providerSubscriptionId) {
          calls.push(["provider.resume", providerSubscriptionId]);
          return {
            provider: "mercado_pago",
            providerSubscriptionId,
            status: "active",
            checkoutUrl: null,
            externalReference: "billing_subscription:sub-9",
            payerEmail: "owner@dabi.app",
          };
        },
      },
      billingService: {
        async scheduleCancellation() {
          throw new Error("not used");
        },
        async revertCancellation(subscriptionId, input) {
          calls.push(["billing.revert", subscriptionId, input]);
          return {
            id: subscriptionId,
            workspaceId: "workspace-9",
            planId: "growth",
            billingCycle: "monthly",
            status: "active",
          };
        },
      },
      async applyWorkspaceSubscriptionUpdate(input) {
        calls.push(["workspace.sync", input]);
      },
    },
  });

  assert.equal(result.localSubscription.status, "active");
  assert.deepEqual(calls, [
    ["provider.resume", "mp-sub-9"],
    [
      "billing.revert",
      "sub-9",
      {
        actorType: "user",
        actorId: "user-7",
      },
    ],
    [
      "workspace.sync",
      {
        workspaceId: "workspace-9",
        planId: "growth",
        billingCycle: "monthly",
        status: "active",
        source: "billing-subscription-manage",
        mercadoPagoSubscriptionId: "mp-sub-9",
        description: "Renovação da assinatura reativada pelo workspace.",
      },
    ],
  ]);
});

test("somente active pode agendar cancelamento e somente scheduled_cancel pode reverter", async () => {
  assert.equal(canManageBillingSubscriptionAction("cancel", "active"), true);
  assert.equal(canManageBillingSubscriptionAction("cancel", "scheduled_cancel"), false);
  assert.equal(canManageBillingSubscriptionAction("resume", "scheduled_cancel"), true);
  assert.equal(canManageBillingSubscriptionAction("resume", "paused"), false);
});

test("falha quando a assinatura não pertence ao Mercado Pago", async () => {
  await assert.rejects(
    () =>
      manageMercadoPagoBillingSubscription({
        action: "cancel",
        actorId: "user-1",
        subscription: {
          id: "sub-1",
          workspaceId: "workspace-1",
          planId: "growth",
          status: "active",
          provider: null,
          providerSubscriptionId: null,
        },
        dependencies: {
          provider: {
            async cancelSubscription() {
              throw new Error("not used");
            },
            async resumeSubscription() {
              throw new Error("not used");
            },
          },
          billingService: {
            async scheduleCancellation() {
              throw new Error("not used");
            },
            async revertCancellation() {
              throw new Error("not used");
            },
          },
          async applyWorkspaceSubscriptionUpdate() {
            throw new Error("not used");
          },
        },
      }),
    (error) =>
      error instanceof ManageBillingSubscriptionError &&
      error.code === "SUBSCRIPTION_NOT_FOUND" &&
      error.status === 404,
  );
});
