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
