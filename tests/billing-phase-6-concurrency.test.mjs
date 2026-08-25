import assert from "node:assert/strict";
import test from "node:test";

import { runBillingCycleChangePixOperation } from "../src/lib/billing/cycle-change-pix-operation.ts";
import { BillingReconciliationService } from "../src/lib/billing/reconciliation-service.ts";
import {
  BillingSubscriptionOperationInProgressError,
} from "../src/lib/billing/subscription-operation-claim.ts";
import { manageCurrentMercadoPagoBillingSubscription } from "../src/lib/billing/subscription-management.ts";
import { BillingWebhookService } from "../src/lib/billing/webhook-service.ts";

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createSubscription(overrides = {}) {
  return {
    id: "sub-phase-6",
    workspaceId: "workspace-phase-6",
    planId: "growth",
    billingCycle: "monthly",
    priceId: "price-growth-monthly",
    status: "pending",
    autoRenew: true,
    currentPeriodStart: "2026-08-01T00:00:00.000Z",
    currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    cancelRequestedAt: null,
    endedAt: null,
    accessUntil: "2026-09-01T00:00:00.000Z",
    provider: "mercado_pago",
    providerSubscriptionId: "mp-sub-phase-6",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
    ...overrides,
  };
}

function createInvoice(overrides = {}) {
  return {
    id: "inv-phase-6",
    subscriptionId: "sub-phase-6",
    workspaceId: "workspace-phase-6",
    priceId: "price-growth-monthly",
    type: "subscription",
    status: "pending",
    amountCents: 14900,
    currency: "BRL",
    periodStart: null,
    periodEnd: null,
    paymentMethod: "pix_manual",
    provider: "mercado_pago",
    providerPaymentId: "pay-phase-6",
    providerAuthorizedPaymentId: null,
    paymentExpiresAt: "2026-08-14T14:00:00.000Z",
    paidAt: null,
    failedAt: null,
    refundedAt: null,
    createdAt: "2026-08-14T12:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
    ...overrides,
  };
}

function createState(input = {}) {
  const state = {
    subscription: createSubscription(input.subscription),
    invoice: createInvoice(input.invoice),
    invoiceEffectClaim: null,
    invoiceEffectCompleted: false,
    subscriptionOperationActive: false,
    activations: 0,
    renewals: 0,
    cycleChanges: 0,
    workspaceEffects: 0,
    providerCycleUpdates: 0,
    providerCancels: 0,
    checkoutCreates: 0,
    change: input.change ?? null,
    onSubscriptionClaim: null,
  };

  state.transitionPendingInvoice = async (_invoiceId, mutation) => {
    if (state.invoice.status !== "pending") {
      return null;
    }

    Object.assign(state.invoice, mutation);
    return { ...state.invoice };
  };
  state.claimInvoiceEffect = async () => {
    if (state.invoiceEffectCompleted || state.invoiceEffectClaim) {
      return null;
    }

    state.invoiceEffectClaim = "invoice-claim";
    return state.invoiceEffectClaim;
  };
  state.completeInvoiceEffect = async ({ claimToken }) => {
    if (claimToken !== state.invoiceEffectClaim) {
      return false;
    }

    state.invoiceEffectCompleted = true;
    state.invoiceEffectClaim = null;
    return true;
  };
  state.releaseInvoiceEffectClaim = async ({ claimToken }) => {
    if (claimToken !== state.invoiceEffectClaim) {
      return false;
    }

    state.invoiceEffectClaim = null;
    return true;
  };
  state.withSubscriptionOperation = async (subscriptionId, operation) => {
    assert.equal(subscriptionId, state.subscription.id);

    if (state.subscriptionOperationActive) {
      throw new BillingSubscriptionOperationInProgressError(subscriptionId);
    }

    state.subscriptionOperationActive = true;

    try {
      await state.onSubscriptionClaim?.();
      return await operation();
    } finally {
      state.subscriptionOperationActive = false;
    }
  };

  return state;
}

function createWebhookService(state) {
  let sequence = 0;

  return new BillingWebhookService({
    async createWebhookEvent() {
      sequence += 1;
      return {
        id: `evt-phase-6-${sequence}`,
        provider: "mercado_pago",
        providerEventId: `req-phase-6-${sequence}`,
        eventType: "payment",
        resourceId: state.invoice.providerPaymentId,
        payloadHash: `hash-phase-6-${sequence}`,
        status: "received",
        attempts: 0,
        receivedAt: "2026-08-14T12:00:00.000Z",
        processedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-08-14T12:00:00.000Z",
        updatedAt: "2026-08-14T12:00:00.000Z",
      };
    },
    async updateWebhookEventStatus() { return null; },
    async getInvoiceById() { return { ...state.invoice }; },
    async findInvoiceByProviderPaymentId() { return null; },
    async updateInvoice(_invoiceId, mutation) {
      Object.assign(state.invoice, mutation);
      return { ...state.invoice };
    },
    transitionPendingInvoice: state.transitionPendingInvoice,
    claimInvoiceEffect: state.claimInvoiceEffect,
    completeInvoiceEffect: state.completeInvoiceEffect,
    releaseInvoiceEffectClaim: state.releaseInvoiceEffectClaim,
    withSubscriptionOperation: state.withSubscriptionOperation,
    async getSubscriptionById() { return { ...state.subscription }; },
    async findSubscriptionByProviderSubscriptionId() { return { ...state.subscription }; },
    async findUserByEmail() { return null; },
    async findPrimaryWorkspaceForUser() { return null; },
    async applyWorkspaceSubscriptionUpdate() {
      state.workspaceEffects += 1;
      return { changed: true };
    },
    async getSubscriptionChangeByInvoiceId() { return state.change; },
    async updateSubscriptionChange(_changeId, mutation) {
      Object.assign(state.change, mutation);
      return state.change;
    },
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
        async updateSubscriptionAmount() {
          state.providerCycleUpdates += 1;
        },
      };
    },
    billingService: {
      async activateSubscription() {
        state.activations += 1;
        state.subscription.status = "active";
      },
      async renewSubscription() {
        state.renewals += 1;
      },
      async markPastDue() {},
      async applyUpgrade() {},
      async applyCycleChange() {
        state.cycleChanges += 1;
        state.subscription.billingCycle = "annual";
      },
    },
    clock: { now: () => new Date("2026-08-14T12:15:00.000Z") },
  });
}

function createReconciliationService(state) {
  return new BillingReconciliationService({
    billingService: {
      async activateSubscription() {
        state.activations += 1;
        state.subscription.status = "active";
      },
      async renewSubscription() { state.renewals += 1; },
      async markPastDue() {},
      async pauseSubscription() {},
      async finalizeCancellation() {},
      async expireSubscription() {},
      async applyUpgrade() {},
      async applyCycleChange() {
        state.cycleChanges += 1;
        state.subscription.billingCycle = "annual";
      },
      async applyScheduledChange() {},
    },
    async getSubscriptionById() { return { ...state.subscription }; },
    async listSubscriptionsForProviderReconciliation() { return []; },
    async listSubscriptionsForExpiration() { return []; },
    async listSubscriptionsForGracePeriodEnd() { return []; },
    async listSubscriptionsForScheduledCancellation() { return []; },
    async listAbandonedPendingSubscriptions() { return []; },
    async getInvoiceById() { return { ...state.invoice }; },
    async listInvoicesForProviderReconciliation() { return []; },
    async listInvoicesForExpiration() { return []; },
    async updateInvoice(_invoiceId, mutation) {
      Object.assign(state.invoice, mutation);
      return { ...state.invoice };
    },
    transitionPendingInvoice: state.transitionPendingInvoice,
    claimInvoiceEffect: state.claimInvoiceEffect,
    completeInvoiceEffect: state.completeInvoiceEffect,
    releaseInvoiceEffectClaim: state.releaseInvoiceEffectClaim,
    withSubscriptionOperation: state.withSubscriptionOperation,
    async getSubscriptionChangeByInvoiceId() { return state.change; },
    async getDueSubscriptionChanges() { return []; },
    async updateSubscriptionChange(_changeId, mutation) {
      Object.assign(state.change, mutation);
      return state.change;
    },
    async findActivePrice() {
      return {
        id: "price-growth-annual",
        planId: "growth",
        billingCycle: "annual",
        amountCents: 149000,
        currency: "BRL",
      };
    },
    async listFailedWebhookEvents() { return []; },
    async appendAuditEvent() {},
    async applyWorkspaceSubscriptionUpdate() {
      state.workspaceEffects += 1;
      return { changed: true };
    },
    getProvider() {
      return {
        async updateSubscriptionAmount() {
          state.providerCycleUpdates += 1;
        },
      };
    },
    clock: { now: () => new Date("2026-08-14T12:15:00.000Z") },
  });
}

function manualPaymentEvent(invoiceId) {
  return {
    provider: "mercado_pago",
    providerEventId: `req-${invoiceId}`,
    eventType: "payment",
    resourceId: "pay-phase-6",
    payloadHash: `hash-${invoiceId}`,
    kind: "manual_payment",
    sourceTopic: "payment",
    manualPayment: {
      providerPaymentId: "pay-phase-6",
      status: "approved",
      externalReference: `billing_invoice:${invoiceId}`,
      paymentMethod: "pix_manual",
      expiresAt: null,
      approvedAt: "2026-08-14T12:15:00.000Z",
    },
  };
}

test("webhook e reconciliação concorrentes aplicam um único efeito comercial", async () => {
  const state = createState();
  const webhookEntered = deferred();
  const releaseWebhook = deferred();
  let holdWebhook = true;
  state.onSubscriptionClaim = async () => {
    if (holdWebhook) {
      webhookEntered.resolve();
      await releaseWebhook.promise;
    }
  };

  const webhook = createWebhookService(state);
  const reconciliation = createReconciliationService(state);
  const webhookPromise = webhook.processEvent(manualPaymentEvent(state.invoice.id));

  await webhookEntered.promise;
  const reconciliationResult = await reconciliation.reconcileInvoice(state.invoice.id);
  assert.equal(reconciliationResult.changed, 0);
  assert.equal(state.activations, 0);

  holdWebhook = false;
  releaseWebhook.resolve();
  await webhookPromise;

  assert.equal(state.activations, 1);
  assert.equal(state.workspaceEffects, 1);
});

test("cancelamento concorrente é bloqueado durante pagamento por webhook e reconciliação", async () => {
  const runCancellation = (state) =>
    manageCurrentMercadoPagoBillingSubscription({
      action: "cancel",
      actorId: "user-phase-6",
      subscription: state.subscription,
      getCurrentSubscription: async () => ({ ...state.subscription }),
      runWithSubscriptionOperation: state.withSubscriptionOperation,
      dependencies: {
        provider: {
          async cancelSubscription() {
            state.providerCancels += 1;
            return {};
          },
          async resumeSubscription() { return {}; },
        },
        billingService: {
          async scheduleCancellation() { return { ...state.subscription, status: "scheduled_cancel" }; },
          async revertCancellation() { return state.subscription; },
        },
        async applyWorkspaceSubscriptionUpdate() {},
      },
    });

  const webhookState = createState({ subscription: { status: "active" } });
  const webhookEntered = deferred();
  const releaseWebhook = deferred();
  webhookState.onSubscriptionClaim = async () => {
    webhookEntered.resolve();
    await releaseWebhook.promise;
  };

  const webhookPromise = createWebhookService(webhookState).processEvent(
    manualPaymentEvent(webhookState.invoice.id),
  );
  await webhookEntered.promise;
  await assert.rejects(
    () => runCancellation(webhookState),
    BillingSubscriptionOperationInProgressError,
  );
  assert.equal(webhookState.providerCancels, 0);
  releaseWebhook.resolve();
  await webhookPromise;

  const reconciliationState = createState({
    subscription: { status: "active" },
    invoice: { status: "paid", type: "renewal", paidAt: "2026-08-14T12:15:00.000Z" },
  });
  const reconciliationEntered = deferred();
  const releaseReconciliation = deferred();
  reconciliationState.onSubscriptionClaim = async () => {
    reconciliationEntered.resolve();
    await releaseReconciliation.promise;
  };

  const reconciliationPromise = createReconciliationService(
    reconciliationState,
  ).reconcileInvoice(reconciliationState.invoice.id);
  await reconciliationEntered.promise;
  await assert.rejects(
    () => runCancellation(reconciliationState),
    BillingSubscriptionOperationInProgressError,
  );
  assert.equal(reconciliationState.providerCancels, 0);
  releaseReconciliation.resolve();
  await reconciliationPromise;
  assert.equal(reconciliationState.renewals, 1);
});

test("retomada do Pix de ciclo e webhook pago não aplicam mudança duas vezes", async () => {
  const state = createState({
    subscription: { status: "active" },
    invoice: { type: "upgrade" },
    change: {
      id: "chg-phase-6",
      subscriptionId: "sub-phase-6",
      workspaceId: "workspace-phase-6",
      type: "cycle_change",
      status: "pending_payment",
      fromPlanId: "growth",
      toPlanId: "growth",
      fromBillingCycle: "monthly",
      toBillingCycle: "annual",
      effectiveAt: "2026-08-14T12:00:00.000Z",
      creditAmountCents: 0,
      chargeAmountCents: 149000,
      invoiceId: "inv-phase-6",
      requestedByType: "user",
      requestedById: "user-phase-6",
      createdAt: "2026-08-14T12:00:00.000Z",
      appliedAt: null,
      canceledAt: null,
    },
  });
  const checkoutEntered = deferred();
  const releaseCheckout = deferred();
  let holdCheckout = true;
  state.onSubscriptionClaim = async () => {
    if (holdCheckout) {
      checkoutEntered.resolve();
      await releaseCheckout.promise;
    }
  };

  const checkoutPromise = runBillingCycleChangePixOperation({
    subscription: state.subscription,
    getCurrentSubscription: async () => ({ ...state.subscription }),
    runWithSubscriptionOperation: state.withSubscriptionOperation,
    operation: async () => {
      state.checkoutCreates += 1;
      return { resumed: true, invoiceId: state.invoice.id };
    },
  });

  await checkoutEntered.promise;
  const webhookResult = await createWebhookService(state)
    .processEvent(manualPaymentEvent(state.invoice.id))
    .catch((error) => error);
  assert.ok(webhookResult instanceof BillingSubscriptionOperationInProgressError);
  assert.equal(state.cycleChanges, 0);
  assert.equal(state.providerCycleUpdates, 0);

  holdCheckout = false;
  releaseCheckout.resolve();
  await checkoutPromise;
  await createReconciliationService(state).reconcileInvoice(state.invoice.id);

  assert.equal(state.checkoutCreates, 1);
  assert.equal(state.cycleChanges, 1);
  assert.equal(state.providerCycleUpdates, 1);
  assert.equal(state.workspaceEffects, 1);
});
