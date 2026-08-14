import assert from "node:assert/strict";
import test from "node:test";

import { BillingWebhookService } from "../src/lib/billing/webhook-service.ts";

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
    async findUserByEmail() {
      throw new Error("not used");
    },
    async findPrimaryWorkspaceForUser() {
      throw new Error("not used");
    },
    async getWorkspacePreferences(workspaceId) {
      assert.equal(workspaceId, "workspace-1");
      return {
        subscription: {
          planId: "growth",
          mercadoPagoSubscriptionId: "mp-sub-1",
        },
      };
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
    billingService: {
      async activateSubscription() {
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
        status: "active",
        source: "billing-webhook-payment",
        mercadoPagoSubscriptionId: null,
        description: "Pagamento aprovado via payment.",
      });
      return {
        changed: true,
      };
    },
    billingService: {
      async activateSubscription(subscriptionId, input) {
        assert.equal(subscriptionId, "sub-1");
        assert.equal(input.actorType, "webhook");
        assert.equal(input.currentPeriodStart, "2026-08-14T13:15:00.000Z");
        assert.equal(input.currentPeriodEnd, "2026-09-14T13:15:00.000Z");
        assert.equal(input.accessUntil, "2026-09-14T13:15:00.000Z");
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
    billingService: {
      async activateSubscription() {
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
