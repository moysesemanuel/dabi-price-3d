import assert from "node:assert/strict";
import test from "node:test";

import { BillingWebhookService } from "../src/lib/billing/webhook-service.ts";

test("entrega concorrente nao executa os efeitos do webhook duas vezes", async () => {
  const statusUpdates = [];
  let claimAvailable = true;
  let sideEffects = 0;
  const event = {
    id: "evt-concurrent-1",
    provider: "mercado_pago",
    providerEventId: "req-concurrent-1",
    eventType: "subscription_preapproval",
    resourceId: "sub-concurrent-1",
    payloadHash: "hash-concurrent-1",
    status: "received",
    attempts: 0,
    receivedAt: "2026-08-22T00:00:00.000Z",
    processedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    updatedAt: "2026-08-22T00:00:00.000Z",
  };
  const service = new BillingWebhookService({
    async createWebhookEvent() { return event; },
    async claimWebhookEventProcessing() {
      if (!claimAvailable) return null;
      claimAvailable = false;
      return { ...event, status: "processing", attempts: 1 };
    },
    async updateWebhookEventStatus(input) { statusUpdates.push(input); return null; },
    async getInvoiceById() { throw new Error("not used"); },
    async findInvoiceByProviderPaymentId() { throw new Error("not used"); },
    async findInvoiceByProviderAuthorizedPaymentId() { throw new Error("not used"); },
    async createInvoice() { throw new Error("not used"); },
    async updateInvoice() { throw new Error("not used"); },
    async getSubscriptionById() { throw new Error("not used"); },
    async findSubscriptionByProviderSubscriptionId() {
      return {
        id: "sub-concurrent-1", workspaceId: "workspace-concurrent-1", planId: "growth",
        billingCycle: "monthly", priceId: "price-1", status: "pending", autoRenew: true,
        currentPeriodStart: null, currentPeriodEnd: null, gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false, cancelRequestedAt: null, endedAt: null, accessUntil: null,
        provider: "mercado_pago", providerSubscriptionId: "mp-sub-concurrent-1",
        createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z",
      };
    },
    async findUserByEmail() { throw new Error("not used"); },
    async findPrimaryWorkspaceForUser() { throw new Error("not used"); },
    async applyWorkspaceSubscriptionUpdate() { sideEffects += 1; return { changed: true }; },
    async getSubscriptionChangeByInvoiceId() { throw new Error("not used"); },
    async updateSubscriptionChange() { throw new Error("not used"); },
    async findActivePrice() { throw new Error("not used"); },
    getProvider() { return null; },
    billingService: {
      async activateSubscription() { throw new Error("not used"); },
      async renewSubscription() { throw new Error("not used"); },
      async markPastDue() { throw new Error("not used"); },
      async applyUpgrade() { throw new Error("not used"); },
      async applyCycleChange() { throw new Error("not used"); },
    },
  });
  const input = {
    provider: "mercado_pago", providerEventId: "req-concurrent-1", eventType: "subscription_preapproval",
    resourceId: "sub-concurrent-1", payloadHash: "hash-concurrent-1", kind: "subscription",
    sourceTopic: "subscription_preapproval", recurringChargeApproved: false,
    subscription: {
      providerSubscriptionId: "mp-sub-concurrent-1", status: "active", externalReference: null,
      payerEmail: null, workspaceHints: { workspaceId: "workspace-concurrent-1", email: null },
    },
  };
  const outcomes = await Promise.all(
    Array.from({ length: 10 }, () => service.processEvent(input)),
  );
  assert.equal(outcomes.filter((outcome) => outcome.body.handled).length, 1);
  assert.equal(
    outcomes.filter((outcome) => outcome.body.finalStatus === "processing").length,
    9,
  );
  assert.equal(sideEffects, 1);
  assert.deepEqual(statusUpdates.map((entry) => entry.status), ["processed"]);
});

test("sincroniza evento de assinatura e persiste webhook como processed", async () => {
  const statusUpdates = [];
  const service = new BillingWebhookService({
    async createWebhookEvent() {
      return {
        id: "evt-1",
        provider: "mercado_pago",
        providerEventId: "req-1",
        eventType: "subscription_preapproval",
        resourceId: "sub-1",
        payloadHash: "hash",
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
    async updateWebhookEventStatus(input) {
      statusUpdates.push(input);
      return null;
    },
    async getInvoiceById() {
      throw new Error("not used");
    },
    async findInvoiceByProviderPaymentId() {
      throw new Error("not used");
    },
    async updateInvoice() {
      throw new Error("not used");
    },
    async getSubscriptionById() {
      throw new Error("not used");
    },
    async findSubscriptionByProviderSubscriptionId(input) {
      assert.deepEqual(input, {
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-1",
      });
      return {
        id: "sub-local-1",
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-growth-monthly",
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
        createdAt: "2026-08-14T12:00:00.000Z",
        updatedAt: "2026-08-14T12:00:00.000Z",
      };
    },
    async findUserByEmail() {
      throw new Error("not used");
    },
    async findPrimaryWorkspaceForUser() {
      throw new Error("not used");
    },
    async getWorkspacePreferences(workspaceId) {
      throw new Error(`not used: ${workspaceId}`);
    },
    async applyWorkspaceSubscriptionUpdate(input) {
      assert.deepEqual(input, {
        workspaceId: "workspace-1",
        planId: "growth",
        status: "active",
        source: "billing-webhook",
        mercadoPagoSubscriptionId: "mp-sub-1",
        description: "Assinatura sincronizada via subscription_preapproval.",
      });

      return {
        changed: true,
      };
    },
    async getSubscriptionChangeByInvoiceId() {
      throw new Error("not used");
    },
    async updateSubscriptionChange() {
      throw new Error("not used");
    },
    async findActivePrice() {
      throw new Error("not used");
    },
    getProvider() {
      throw new Error("not used");
    },
    billingService: {
      async activateSubscription() {
        throw new Error("not used");
      },
      async applyUpgrade() {
        throw new Error("not used");
      },
    },
    clock: {
      now() {
        return new Date("2026-08-14T12:30:00.000Z");
      },
    },
  });

  const outcome = await service.processEvent({
    provider: "mercado_pago",
    providerEventId: "req-1",
    eventType: "subscription_preapproval",
    resourceId: "sub-1",
    payloadHash: "hash",
    kind: "subscription",
    sourceTopic: "subscription_preapproval",
    recurringChargeApproved: false,
    subscription: {
      providerSubscriptionId: "mp-sub-1",
      status: "active",
      externalReference: null,
      payerEmail: null,
      workspaceHints: {
        workspaceId: "workspace-1",
        email: null,
      },
    },
  });

  assert.equal(outcome.status, 200);
  assert.equal(outcome.body.handled, true);
  assert.deepEqual(statusUpdates.map((item) => item.status), [
    "processing",
    "processed",
  ]);
});

test("pagamento manual pago ativa assinatura pendente e sincroniza workspace", async () => {
  const invoiceUpdates = [];
  const completedEffects = [];
  let transitionAvailable = true;
  let activations = 0;
  const service = new BillingWebhookService({
    async createWebhookEvent() {
      return {
        id: "evt-2",
        provider: "mercado_pago",
        providerEventId: "req-2",
        eventType: "payment",
        resourceId: "pay-1",
        payloadHash: "hash-2",
        status: "received",
        attempts: 0,
        receivedAt: "2026-08-14T13:00:00.000Z",
        processedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:00:00.000Z",
      };
    },
    async updateWebhookEventStatus() {
      return null;
    },
    async getInvoiceById(invoiceId) {
      assert.equal(invoiceId, "inv-1");
      return {
        id: "inv-1",
        subscriptionId: "sub-1",
        workspaceId: "workspace-1",
        priceId: "price-1",
        type: "subscription",
        status: "pending",
        amountCents: 14900,
        currency: "BRL",
        periodStart: null,
        periodEnd: null,
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
        providerPaymentId: null,
        providerAuthorizedPaymentId: null,
        paymentExpiresAt: null,
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:00:00.000Z",
      };
    },
    async findInvoiceByProviderPaymentId() {
      throw new Error("not used");
    },
    async updateInvoice(invoiceId, mutation) {
      invoiceUpdates.push({ invoiceId, mutation });
      return null;
    },
    async transitionPendingInvoice(invoiceId, mutation) {
      invoiceUpdates.push({ invoiceId, mutation });

      if (!transitionAvailable) {
        return null;
      }

      transitionAvailable = false;
      return {
        id: invoiceId,
        type: "subscription",
      };
    },
    async claimInvoiceEffect(invoiceId) {
      assert.equal(invoiceId, "inv-1");
      return "claim-webhook-1";
    },
    async completeInvoiceEffect(input) {
      completedEffects.push(input);
      return true;
    },
    async getSubscriptionById(subscriptionId) {
      assert.equal(subscriptionId, "sub-1");
      return {
        id: "sub-1",
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-1",
        status: "pending",
        autoRenew: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: null,
        provider: "mercado_pago",
        providerSubscriptionId: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:00:00.000Z",
      };
    },
    async findUserByEmail() {
      throw new Error("not used");
    },
    async findPrimaryWorkspaceForUser() {
      throw new Error("not used");
    },
    async getWorkspacePreferences() {
      throw new Error("not used");
    },
    async applyWorkspaceSubscriptionUpdate(input) {
      assert.deepEqual(input, {
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "monthly",
        status: "active",
        source: "billing-webhook-payment",
        mercadoPagoSubscriptionId: null,
        description: "Pagamento aprovado via payment.",
      });
      return {
        changed: true,
      };
    },
    async getSubscriptionChangeByInvoiceId() {
      throw new Error("not used");
    },
    async updateSubscriptionChange() {
      throw new Error("not used");
    },
    async findActivePrice() {
      throw new Error("not used");
    },
    getProvider() {
      throw new Error("not used");
    },
    billingService: {
      async activateSubscription(subscriptionId, input) {
        assert.equal(subscriptionId, "sub-1");
        assert.equal(input.actorType, "webhook");
        assert.equal(input.currentPeriodStart, "2026-08-14T13:15:00.000Z");
        assert.equal(input.currentPeriodEnd, "2026-09-14T13:15:00.000Z");
        assert.equal(input.accessUntil, "2026-09-14T13:15:00.000Z");
      },
      async applyUpgrade() {
        throw new Error("not used");
      },
    },
    clock: {
      now() {
        return new Date("2026-08-14T13:16:00.000Z");
      },
    },
  });

  const outcome = await service.processEvent({
    provider: "mercado_pago",
    providerEventId: "req-2",
    eventType: "payment",
    resourceId: "pay-1",
    payloadHash: "hash-2",
    kind: "manual_payment",
    sourceTopic: "payment",
    manualPayment: {
      providerPaymentId: "pay-1",
      status: "approved",
      externalReference: "billing_invoice:inv-1",
      paymentMethod: "pix_manual",
      expiresAt: "2026-08-14T14:00:00.000Z",
      approvedAt: "2026-08-14T13:15:00.000Z",
    },
  });

  assert.equal(outcome.status, 200);
  assert.equal(outcome.body.activated, true);
  assert.equal(invoiceUpdates.length, 1);
  assert.equal(invoiceUpdates[0].invoiceId, "inv-1");
  assert.equal(invoiceUpdates[0].mutation.status, "paid");
  assert.deepEqual(completedEffects, [
    {
      invoiceId: "inv-1",
      claimToken: "claim-webhook-1",
    },
  ]);
});

test("pagamento manual anual ativa 12 meses de acesso", async () => {
  const service = new BillingWebhookService({
    async createWebhookEvent() {
      return {
        id: "evt-annual",
        provider: "mercado_pago",
        providerEventId: "req-annual",
        eventType: "payment",
        resourceId: "pay-annual-1",
        payloadHash: "hash-annual",
        status: "received",
        attempts: 0,
        receivedAt: "2026-08-14T13:00:00.000Z",
        processedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:00:00.000Z",
      };
    },
    async updateWebhookEventStatus() {
      return null;
    },
    async getInvoiceById(invoiceId) {
      assert.equal(invoiceId, "inv-annual-1");
      return {
        id: "inv-annual-1",
        subscriptionId: "sub-annual-1",
        workspaceId: "workspace-1",
        priceId: "price-annual-1",
        type: "subscription",
        status: "pending",
        amountCents: 178800,
        currency: "BRL",
        periodStart: null,
        periodEnd: null,
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
        providerPaymentId: null,
        providerAuthorizedPaymentId: null,
        paymentExpiresAt: null,
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:00:00.000Z",
      };
    },
    async findInvoiceByProviderPaymentId() {
      throw new Error("not used");
    },
    async updateInvoice() {
      return null;
    },
    async getSubscriptionById(subscriptionId) {
      assert.equal(subscriptionId, "sub-annual-1");
      return {
        id: "sub-annual-1",
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "annual",
        priceId: "price-annual-1",
        status: "pending",
        autoRenew: false,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: null,
        provider: "mercado_pago",
        providerSubscriptionId: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:00:00.000Z",
      };
    },
    async findUserByEmail() {
      throw new Error("not used");
    },
    async findPrimaryWorkspaceForUser() {
      throw new Error("not used");
    },
    async getWorkspacePreferences() {
      throw new Error("not used");
    },
    async applyWorkspaceSubscriptionUpdate(input) {
      assert.deepEqual(input, {
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "annual",
        status: "active",
        source: "billing-webhook-payment",
        mercadoPagoSubscriptionId: null,
        description: "Pagamento aprovado via payment.",
      });
      return {
        changed: true,
      };
    },
    async getSubscriptionChangeByInvoiceId() {
      throw new Error("not used");
    },
    async updateSubscriptionChange() {
      throw new Error("not used");
    },
    async findActivePrice() {
      throw new Error("not used");
    },
    getProvider() {
      throw new Error("not used");
    },
    billingService: {
      async activateSubscription(subscriptionId, input) {
        assert.equal(subscriptionId, "sub-annual-1");
        assert.equal(input.actorType, "webhook");
        assert.equal(input.currentPeriodStart, "2026-08-14T13:15:00.000Z");
        assert.equal(input.currentPeriodEnd, "2027-08-14T13:15:00.000Z");
        assert.equal(input.accessUntil, "2027-08-14T13:15:00.000Z");
      },
      async applyUpgrade() {
        throw new Error("not used");
      },
    },
    clock: {
      now() {
        return new Date("2026-08-14T13:16:00.000Z");
      },
    },
  });

  const outcome = await service.processEvent({
    provider: "mercado_pago",
    providerEventId: "req-annual",
    eventType: "payment",
    resourceId: "pay-annual-1",
    payloadHash: "hash-annual",
    kind: "manual_payment",
    sourceTopic: "payment",
    manualPayment: {
      providerPaymentId: "pay-annual-1",
      status: "approved",
      externalReference: "billing_invoice:inv-annual-1",
      paymentMethod: "pix_manual",
      expiresAt: "2026-08-14T14:00:00.000Z",
      approvedAt: "2026-08-14T13:15:00.000Z",
    },
  });

  assert.equal(outcome.status, 200);
  assert.equal(outcome.body.activated, true);
});

test("authorized payment pago cria renewal e renova assinatura ativa", async () => {
  let createdInvoice = null;
  const service = new BillingWebhookService({
    async createWebhookEvent() {
      return {
        id: "evt-auth-1",
        provider: "mercado_pago",
        providerEventId: "req-auth-1",
        eventType: "subscription_authorized_payment",
        resourceId: "auth-pay-1",
        payloadHash: "hash-auth-1",
        status: "received",
        attempts: 0,
        receivedAt: "2026-08-14T13:00:00.000Z",
        processedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:00:00.000Z",
      };
    },
    async updateWebhookEventStatus() {
      return null;
    },
    async getInvoiceById() {
      throw new Error("not used");
    },
    async findInvoiceByProviderPaymentId() {
      return null;
    },
    async findInvoiceByProviderAuthorizedPaymentId() {
      return null;
    },
    async createInvoice(input) {
      createdInvoice = input;
      return {
        id: "inv-renew-1",
        subscriptionId: input.subscriptionId,
        workspaceId: input.workspaceId,
        priceId: input.priceId,
        type: input.type,
        status: input.status,
        amountCents: input.amountCents,
        currency: input.currency,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        paymentMethod: input.paymentMethod,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        providerAuthorizedPaymentId: input.providerAuthorizedPaymentId,
        paymentExpiresAt: null,
        paidAt: input.paidAt,
        failedAt: input.failedAt,
        refundedAt: null,
        createdAt: "2026-08-14T13:16:00.000Z",
        updatedAt: "2026-08-14T13:16:00.000Z",
      };
    },
    async updateInvoice() {
      throw new Error("not used");
    },
    async getSubscriptionById() {
      throw new Error("not used");
    },
    async findSubscriptionByProviderSubscriptionId(input) {
      assert.deepEqual(input, {
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-10",
      });
      return {
        id: "sub-10",
        workspaceId: "workspace-10",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-growth-monthly",
        status: "active",
        autoRenew: true,
        currentPeriodStart: "2026-07-14T13:15:00.000Z",
        currentPeriodEnd: "2026-08-14T13:15:00.000Z",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: "2026-08-14T13:15:00.000Z",
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-10",
        createdAt: "2026-07-14T13:15:00.000Z",
        updatedAt: "2026-08-14T13:15:00.000Z",
      };
    },
    async findUserByEmail() {
      throw new Error("not used");
    },
    async findPrimaryWorkspaceForUser() {
      throw new Error("not used");
    },
    async getWorkspacePreferences() {
      throw new Error("not used");
    },
    async applyWorkspaceSubscriptionUpdate(input) {
      assert.deepEqual(input, {
        workspaceId: "workspace-10",
        planId: "growth",
        billingCycle: "monthly",
        status: "active",
        source: "billing-webhook-authorized-payment",
        mercadoPagoSubscriptionId: "mp-sub-10",
        description:
          "Cobrança recorrente confirmada via subscription_authorized_payment.",
      });
      return { changed: true };
    },
    async getSubscriptionChangeByInvoiceId() {
      throw new Error("not used");
    },
    async updateSubscriptionChange() {
      throw new Error("not used");
    },
    async findActivePrice(input) {
      assert.equal(input.planId, "growth");
      assert.equal(input.billingCycle, "monthly");
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
      throw new Error("not used");
    },
    billingService: {
      async activateSubscription() {
        throw new Error("not used");
      },
      async renewSubscription(subscriptionId, input) {
        assert.equal(subscriptionId, "sub-10");
        assert.equal(input.actorType, "webhook");
        assert.equal(input.currentPeriodStart, "2026-08-14T13:15:00.000Z");
        assert.equal(input.currentPeriodEnd, "2026-09-14T13:15:00.000Z");
        assert.equal(input.accessUntil, "2026-09-14T13:15:00.000Z");
      },
      async markPastDue() {
        throw new Error("not used");
      },
      async applyUpgrade() {
        throw new Error("not used");
      },
    },
    clock: {
      now() {
        return new Date("2026-08-14T13:16:00.000Z");
      },
    },
  });

  const outcome = await service.processEvent({
    provider: "mercado_pago",
    providerEventId: "req-auth-1",
    eventType: "subscription_authorized_payment",
    resourceId: "auth-pay-1",
    payloadHash: "hash-auth-1",
    kind: "authorized_payment",
    sourceTopic: "subscription_authorized_payment",
    authorizedPayment: {
      providerAuthorizedPaymentId: "auth-pay-1",
      providerPaymentId: "pay-10",
      providerSubscriptionId: "mp-sub-10",
      status: "approved",
      externalReference: "billing_subscription:sub-10",
      payerEmail: "owner@dabi.app",
      workspaceHints: {
        workspaceId: "workspace-10",
        email: "owner@dabi.app",
      },
      paymentMethod: "pix_automatic",
      approvedAt: "2026-08-14T13:15:00.000Z",
    },
  });

  assert.equal(outcome.status, 200);
  assert.equal(outcome.body.renewed, true);
  assert.equal(createdInvoice?.type, "renewal");
  assert.equal(createdInvoice?.paymentMethod, "pix_automatic");
  assert.equal(createdInvoice?.periodStart, "2026-08-14T13:15:00.000Z");
  assert.equal(createdInvoice?.periodEnd, "2026-09-14T13:15:00.000Z");
});

test("authorized payment rejeitado inicia tolerância para renewal ativa", async () => {
  let markedPastDue = null;
  const service = new BillingWebhookService({
    async createWebhookEvent() {
      return {
        id: "evt-auth-2",
        provider: "mercado_pago",
        providerEventId: "req-auth-2",
        eventType: "subscription_authorized_payment",
        resourceId: "auth-pay-2",
        payloadHash: "hash-auth-2",
        status: "received",
        attempts: 0,
        receivedAt: "2026-08-14T13:00:00.000Z",
        processedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:00:00.000Z",
      };
    },
    async updateWebhookEventStatus() {
      return null;
    },
    async getInvoiceById() {
      throw new Error("not used");
    },
    async findInvoiceByProviderPaymentId() {
      return null;
    },
    async findInvoiceByProviderAuthorizedPaymentId() {
      return null;
    },
    async createInvoice(input) {
      return {
        id: "inv-renew-2",
        subscriptionId: input.subscriptionId,
        workspaceId: input.workspaceId,
        priceId: input.priceId,
        type: input.type,
        status: input.status,
        amountCents: input.amountCents,
        currency: input.currency,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        paymentMethod: input.paymentMethod,
        provider: input.provider,
        providerPaymentId: input.providerPaymentId,
        providerAuthorizedPaymentId: input.providerAuthorizedPaymentId,
        paymentExpiresAt: null,
        paidAt: input.paidAt,
        failedAt: input.failedAt,
        refundedAt: null,
        createdAt: "2026-08-14T13:16:00.000Z",
        updatedAt: "2026-08-14T13:16:00.000Z",
      };
    },
    async updateInvoice() {
      throw new Error("not used");
    },
    async getSubscriptionById() {
      throw new Error("not used");
    },
    async findSubscriptionByProviderSubscriptionId() {
      return {
        id: "sub-11",
        workspaceId: "workspace-11",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-growth-monthly",
        status: "active",
        autoRenew: true,
        currentPeriodStart: "2026-07-14T13:15:00.000Z",
        currentPeriodEnd: "2026-08-14T13:15:00.000Z",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: "2026-08-14T13:15:00.000Z",
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-11",
        createdAt: "2026-07-14T13:15:00.000Z",
        updatedAt: "2026-08-14T13:15:00.000Z",
      };
    },
    async findUserByEmail() {
      throw new Error("not used");
    },
    async findPrimaryWorkspaceForUser() {
      throw new Error("not used");
    },
    async getWorkspacePreferences() {
      throw new Error("not used");
    },
    async applyWorkspaceSubscriptionUpdate(input) {
      assert.equal(input.status, "active");
      assert.equal(input.workspaceId, "workspace-11");
      return { changed: true };
    },
    async getSubscriptionChangeByInvoiceId() {
      throw new Error("not used");
    },
    async updateSubscriptionChange() {
      throw new Error("not used");
    },
    async findActivePrice() {
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
      throw new Error("not used");
    },
    billingService: {
      async activateSubscription() {
        throw new Error("not used");
      },
      async renewSubscription() {
        throw new Error("not used");
      },
      async markPastDue(subscriptionId, input) {
        markedPastDue = { subscriptionId, input };
      },
      async applyUpgrade() {
        throw new Error("not used");
      },
    },
    clock: {
      now() {
        return new Date("2026-08-14T13:16:00.000Z");
      },
    },
  });

  const outcome = await service.processEvent({
    provider: "mercado_pago",
    providerEventId: "req-auth-2",
    eventType: "subscription_authorized_payment",
    resourceId: "auth-pay-2",
    payloadHash: "hash-auth-2",
    kind: "authorized_payment",
    sourceTopic: "subscription_authorized_payment",
    authorizedPayment: {
      providerAuthorizedPaymentId: "auth-pay-2",
      providerPaymentId: "pay-11",
      providerSubscriptionId: "mp-sub-11",
      status: "rejected",
      externalReference: "billing_subscription:sub-11",
      payerEmail: "owner@dabi.app",
      workspaceHints: {
        workspaceId: "workspace-11",
        email: "owner@dabi.app",
      },
      paymentMethod: "pix_automatic",
      approvedAt: null,
    },
  });

  assert.equal(outcome.status, 200);
  assert.equal(outcome.body.effectApplied, true);
  assert.deepEqual(markedPastDue, {
    subscriptionId: "sub-11",
    input: {
      actorType: "webhook",
      gracePeriodEndsAt: "2026-08-19T13:16:00.000Z",
    },
  });
});

test("evento já processado retorna curto-circuito idempotente", async () => {
  let updateCount = 0;
  const service = new BillingWebhookService({
    async createWebhookEvent() {
      return {
        id: "evt-3",
        provider: "mercado_pago",
        providerEventId: "req-3",
        eventType: "payment",
        resourceId: "pay-9",
        payloadHash: "hash-3",
        status: "processed",
        attempts: 1,
        receivedAt: "2026-08-14T13:00:00.000Z",
        processedAt: "2026-08-14T13:01:00.000Z",
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-08-14T13:00:00.000Z",
        updatedAt: "2026-08-14T13:01:00.000Z",
      };
    },
    async updateWebhookEventStatus() {
      updateCount += 1;
      return null;
    },
    async getInvoiceById() {
      throw new Error("not used");
    },
    async findInvoiceByProviderPaymentId() {
      throw new Error("not used");
    },
    async updateInvoice() {
      throw new Error("not used");
    },
    async getSubscriptionById() {
      throw new Error("not used");
    },
    async findUserByEmail() {
      throw new Error("not used");
    },
    async findPrimaryWorkspaceForUser() {
      throw new Error("not used");
    },
    async getWorkspacePreferences() {
      throw new Error("not used");
    },
    async applyWorkspaceSubscriptionUpdate() {
      throw new Error("not used");
    },
    async getSubscriptionChangeByInvoiceId() {
      throw new Error("not used");
    },
    async updateSubscriptionChange() {
      throw new Error("not used");
    },
    async findActivePrice() {
      throw new Error("not used");
    },
    getProvider() {
      throw new Error("not used");
    },
    billingService: {
      async activateSubscription() {
        throw new Error("not used");
      },
      async applyUpgrade() {
        throw new Error("not used");
      },
    },
  });

  const outcome = await service.processEvent({
    provider: "mercado_pago",
    providerEventId: "req-3",
    eventType: "payment",
    resourceId: "pay-9",
    payloadHash: "hash-3",
    kind: "ignored",
    sourceTopic: "payment",
    reason: "topic_not_implemented",
  });

  assert.equal(outcome.body.duplicate, true);
  assert.equal(updateCount, 1);
});

test("pagamento manual pago aplica upgrade quando invoice e change estão pendentes", async () => {
  const invoiceUpdates = [];
  const changeUpdates = [];
  const service = new BillingWebhookService({
    async createWebhookEvent() {
      return {
        id: "evt-4",
        provider: "mercado_pago",
        providerEventId: "req-4",
        eventType: "payment",
        resourceId: "pay-up-1",
        payloadHash: "hash-4",
        status: "received",
        attempts: 0,
        receivedAt: "2026-08-14T14:00:00.000Z",
        processedAt: null,
        errorCode: null,
        errorMessage: null,
        createdAt: "2026-08-14T14:00:00.000Z",
        updatedAt: "2026-08-14T14:00:00.000Z",
      };
    },
    async updateWebhookEventStatus() {
      return null;
    },
    async getInvoiceById(invoiceId) {
      assert.equal(invoiceId, "inv-up-1");
      return {
        id: "inv-up-1",
        subscriptionId: "sub-up-1",
        workspaceId: "workspace-up-1",
        priceId: "price-growth-monthly",
        type: "upgrade",
        status: "pending",
        amountCents: 9900,
        currency: "BRL",
        periodStart: "2026-08-14T14:10:00.000Z",
        periodEnd: "2026-09-14T00:00:00.000Z",
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
        providerPaymentId: null,
        providerAuthorizedPaymentId: null,
        paymentExpiresAt: null,
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T14:00:00.000Z",
        updatedAt: "2026-08-14T14:00:00.000Z",
      };
    },
    async findInvoiceByProviderPaymentId() {
      throw new Error("not used");
    },
    async updateInvoice(invoiceId, mutation) {
      invoiceUpdates.push({ invoiceId, mutation });
      return null;
    },
    async getSubscriptionById(subscriptionId) {
      assert.equal(subscriptionId, "sub-up-1");
      return {
        id: "sub-up-1",
        workspaceId: "workspace-up-1",
        planId: "starter",
        billingCycle: "monthly",
        priceId: "price-starter-monthly",
        status: "active",
        autoRenew: true,
        currentPeriodStart: "2026-08-14T00:00:00.000Z",
        currentPeriodEnd: "2026-09-14T00:00:00.000Z",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: "2026-09-14T00:00:00.000Z",
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-up-1",
        createdAt: "2026-08-14T14:00:00.000Z",
        updatedAt: "2026-08-14T14:00:00.000Z",
      };
    },
    async findUserByEmail() {
      throw new Error("not used");
    },
    async findPrimaryWorkspaceForUser() {
      throw new Error("not used");
    },
    async getWorkspacePreferences() {
      throw new Error("not used");
    },
    async applyWorkspaceSubscriptionUpdate(input) {
      assert.deepEqual(input, {
        workspaceId: "workspace-up-1",
        planId: "growth",
        billingCycle: "monthly",
        status: "active",
        source: "billing-webhook-upgrade",
        mercadoPagoSubscriptionId: "mp-sub-up-1",
        description: "Upgrade aplicado via payment.",
      });
      return { changed: true };
    },
    async getSubscriptionChangeByInvoiceId(invoiceId) {
      assert.equal(invoiceId, "inv-up-1");
      return {
        id: "chg-up-1",
        subscriptionId: "sub-up-1",
        workspaceId: "workspace-up-1",
        type: "upgrade",
        status: "pending_payment",
        fromPlanId: "starter",
        toPlanId: "growth",
        fromBillingCycle: "monthly",
        toBillingCycle: "monthly",
        effectiveAt: "2026-08-14T14:00:00.000Z",
        creditAmountCents: 1500,
        chargeAmountCents: 11400,
        invoiceId: "inv-up-1",
        requestedByType: "user",
        requestedById: "user-1",
        createdAt: "2026-08-14T14:00:00.000Z",
        appliedAt: null,
        canceledAt: null,
      };
    },
    async updateSubscriptionChange(changeId, mutation) {
      changeUpdates.push({ changeId, mutation });
      return null;
    },
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
          assert.deepEqual(input, {
            providerSubscriptionId: "mp-sub-up-1",
            amountCents: 14900,
            currency: "BRL",
            billingCycle: "monthly",
          });
          return {
            provider: "mercado_pago",
            providerSubscriptionId: "mp-sub-up-1",
            status: "active",
            checkoutUrl: null,
            externalReference: "billing_subscription:sub-up-1",
            payerEmail: "owner@dabi.app",
          };
        },
      };
    },
    billingService: {
      async activateSubscription() {
        throw new Error("not used");
      },
      async applyUpgrade(subscriptionId, input) {
        assert.equal(subscriptionId, "sub-up-1");
        assert.equal(input.actorType, "webhook");
        assert.equal(input.toPlanId, "growth");
        assert.equal(input.priceId, "price-growth-monthly");
        assert.equal(input.changeId, "chg-up-1");
      },
    },
    clock: {
      now() {
        return new Date("2026-08-14T14:12:00.000Z");
      },
    },
  });

  const outcome = await service.processEvent({
    provider: "mercado_pago",
    providerEventId: "req-4",
    eventType: "payment",
    resourceId: "pay-up-1",
    payloadHash: "hash-4",
    kind: "manual_payment",
    sourceTopic: "payment",
    manualPayment: {
      providerPaymentId: "pay-up-1",
      status: "approved",
      externalReference: "billing_invoice:inv-up-1",
      paymentMethod: "pix_manual",
      expiresAt: "2026-08-14T15:00:00.000Z",
      approvedAt: "2026-08-14T14:11:00.000Z",
    },
  });

  assert.equal(outcome.status, 200);
  assert.equal(outcome.body.upgraded, true);
  assert.equal(invoiceUpdates[0]?.mutation.status, "paid");
  assert.equal(changeUpdates[0]?.mutation.status, "applied");
});

test("pagamento manual pago aplica cycle_change sem trocar o plano", async () => {
  const calls = [];
  const service = new BillingWebhookService({
    async createWebhookEvent() {
      return {
        id: "evt-cycle-1", provider: "mercado_pago", providerEventId: "req-cycle-1",
        eventType: "payment", resourceId: "pay-cycle-1", payloadHash: "hash-cycle-1",
        status: "received", attempts: 0, receivedAt: "2026-08-14T14:00:00.000Z",
        processedAt: null, errorCode: null, errorMessage: null,
        createdAt: "2026-08-14T14:00:00.000Z", updatedAt: "2026-08-14T14:00:00.000Z",
      };
    },
    async updateWebhookEventStatus() { return null; },
    async getInvoiceById() {
      return {
        id: "inv-cycle-1", subscriptionId: "sub-cycle-1", workspaceId: "workspace-cycle-1",
        priceId: "price-growth-annual", type: "upgrade", status: "pending", amountCents: 141550,
        currency: "BRL", periodStart: "2026-08-14T14:00:00.000Z", periodEnd: "2027-08-14T14:00:00.000Z",
        paymentMethod: "pix_manual", provider: "mercado_pago", providerPaymentId: null,
        providerAuthorizedPaymentId: null, paymentExpiresAt: null, paidAt: null, failedAt: null,
        refundedAt: null, createdAt: "2026-08-14T14:00:00.000Z", updatedAt: "2026-08-14T14:00:00.000Z",
      };
    },
    async findInvoiceByProviderPaymentId() { throw new Error("not used"); },
    async updateInvoice(invoiceId, mutation) { calls.push(["invoice", invoiceId, mutation]); return null; },
    async getSubscriptionById() {
      return {
        id: "sub-cycle-1", workspaceId: "workspace-cycle-1", planId: "growth", billingCycle: "monthly",
        priceId: "price-growth-monthly", status: "active", autoRenew: true,
        currentPeriodStart: "2026-08-01T00:00:00.000Z", currentPeriodEnd: "2026-09-01T00:00:00.000Z",
        gracePeriodEndsAt: null, cancelAtPeriodEnd: false, cancelRequestedAt: null, endedAt: null,
        accessUntil: "2026-09-01T00:00:00.000Z", provider: "mercado_pago", providerSubscriptionId: "mp-sub-cycle-1",
        createdAt: "2026-08-01T00:00:00.000Z", updatedAt: "2026-08-14T14:00:00.000Z",
      };
    },
    async findUserByEmail() { throw new Error("not used"); },
    async findPrimaryWorkspaceForUser() { throw new Error("not used"); },
    async applyWorkspaceSubscriptionUpdate(input) { calls.push(["workspace", input]); return { changed: true }; },
    async getSubscriptionChangeByInvoiceId() {
      return {
        id: "chg-cycle-1", subscriptionId: "sub-cycle-1", workspaceId: "workspace-cycle-1",
        type: "cycle_change", status: "pending_payment", fromPlanId: "growth", toPlanId: "growth",
        fromBillingCycle: "monthly", toBillingCycle: "annual", effectiveAt: "2026-08-14T14:00:00.000Z",
        creditAmountCents: 7450, chargeAmountCents: 149000, invoiceId: "inv-cycle-1",
        requestedByType: "user", requestedById: "user-1", createdAt: "2026-08-14T14:00:00.000Z",
        appliedAt: null, canceledAt: null,
      };
    },
    async updateSubscriptionChange(changeId, mutation) { calls.push(["change", changeId, mutation]); return null; },
    async findActivePrice(input) {
      assert.equal(input.billingCycle, "annual");
      return { id: "price-growth-annual", planId: "growth", billingCycle: "annual", amountCents: 149000, currency: "BRL" };
    },
    getProvider() {
      return { async updateSubscriptionAmount(input) { calls.push(["provider", input]); return {}; } };
    },
    billingService: {
      async applyCycleChange(subscriptionId, input) { calls.push(["billing", subscriptionId, input]); },
    },
    clock: { now() { return new Date("2026-08-14T14:12:00.000Z"); } },
  });

  const outcome = await service.processEvent({
    provider: "mercado_pago", providerEventId: "req-cycle-1", eventType: "payment",
    resourceId: "pay-cycle-1", payloadHash: "hash-cycle-1", kind: "manual_payment", sourceTopic: "payment",
    manualPayment: {
      providerPaymentId: "pay-cycle-1", status: "approved", externalReference: "billing_invoice:inv-cycle-1",
      paymentMethod: "pix_manual", expiresAt: null, approvedAt: "2026-08-14T14:12:00.000Z",
    },
  });

  assert.equal(outcome.body.cycleChanged, true);
  assert.equal(outcome.body.upgraded, false);
  assert.deepEqual(calls.at(-1), [
    "workspace",
    {
      workspaceId: "workspace-cycle-1", planId: "growth", billingCycle: "annual", status: "active",
      source: "billing-webhook-cycle-change", mercadoPagoSubscriptionId: "mp-sub-cycle-1",
      description: "Mudança de ciclo aplicada via payment.",
    },
  ]);
});
