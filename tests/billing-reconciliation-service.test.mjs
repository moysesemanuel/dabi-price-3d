import assert from "node:assert/strict";
import test from "node:test";

import { BillingReconciliationService } from "../src/lib/billing/reconciliation-service.ts";

function createDependencies(overrides = {}) {
  const activations = [];
  const appliedUpgrades = [];
  const pauses = [];
  const cancellations = [];
  const expirations = [];
  const scheduledChanges = [];
  const workspaceUpdates = [];
  const invoiceUpdates = [];
  const changeUpdates = [];
  const auditEvents = [];

  const base = {
    activations,
    appliedUpgrades,
    pauses,
    cancellations,
    expirations,
    scheduledChanges,
    workspaceUpdates,
    invoiceUpdates,
    changeUpdates,
    auditEvents,
    billingService: {
      async activateSubscription(subscriptionId, input) {
        activations.push({ subscriptionId, input });
      },
      async pauseSubscription(subscriptionId, input) {
        pauses.push({ subscriptionId, input });
      },
      async finalizeCancellation(subscriptionId, input) {
        cancellations.push({ subscriptionId, input });
      },
      async expireSubscription(subscriptionId, input) {
        expirations.push({ subscriptionId, input });
      },
      async applyUpgrade(subscriptionId, input) {
        appliedUpgrades.push({ subscriptionId, input });
      },
      async applyScheduledChange(subscriptionId, input) {
        scheduledChanges.push({ subscriptionId, input });
      },
    },
    async getSubscriptionById() {
      return null;
    },
    async listSubscriptionsForExpiration() {
      return [];
    },
    async listSubscriptionsForGracePeriodEnd() {
      return [];
    },
    async listSubscriptionsForScheduledCancellation() {
      return [];
    },
    async listAbandonedPendingSubscriptions() {
      return [];
    },
    async getInvoiceById() {
      return null;
    },
    async listInvoicesForExpiration() {
      return [];
    },
    async updateInvoice(invoiceId, mutation) {
      invoiceUpdates.push({ invoiceId, mutation });
      return null;
    },
    async getSubscriptionChangeByInvoiceId() {
      return null;
    },
    async getDueSubscriptionChanges() {
      return [];
    },
    async updateSubscriptionChange(changeId, mutation) {
      changeUpdates.push({ changeId, mutation });
      return null;
    },
    async findActivePrice() {
      return {
        id: "price-1",
        planId: "starter",
        billingCycle: "monthly",
        amountCents: 5000,
        currency: "BRL",
        activeFrom: "2026-01-01T00:00:00.000Z",
        activeUntil: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
    },
    async listFailedWebhookEvents() {
      return [];
    },
    async appendAuditEvent(input) {
      auditEvents.push(input);
    },
    async applyWorkspaceSubscriptionUpdate(input) {
      workspaceUpdates.push(input);
      return {
        changed: true,
      };
    },
    getProvider() {
      return null;
    },
    clock: {
      now() {
        return new Date("2026-08-14T12:00:00.000Z");
      },
    },
    abandonedCheckoutWindowDays: 30,
  };

  return {
    ...base,
    ...overrides,
  };
}

test("processExpiredSubscriptions expira assinaturas ativas sem renovação", async () => {
  const dependencies = createDependencies({
    async listSubscriptionsForExpiration(asOf) {
      assert.equal(asOf, "2026-08-14T12:00:00.000Z");
      return [
        {
          id: "sub-1",
          workspaceId: "workspace-1",
          planId: "growth",
          billingCycle: "monthly",
          priceId: "price-1",
          status: "active",
          autoRenew: false,
          currentPeriodStart: "2026-07-14T12:00:00.000Z",
          currentPeriodEnd: "2026-08-14T12:00:00.000Z",
          gracePeriodEndsAt: null,
          cancelAtPeriodEnd: false,
          cancelRequestedAt: null,
          endedAt: null,
          accessUntil: "2026-08-14T12:00:00.000Z",
          provider: "mercado_pago",
          providerSubscriptionId: "mp-sub-1",
          createdAt: "2026-07-14T12:00:00.000Z",
          updatedAt: "2026-08-14T12:00:00.000Z",
        },
      ];
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.processExpiredSubscriptions();

  assert.equal(result.processed, 1);
  assert.equal(result.changed, 1);
  assert.equal(dependencies.expirations.length, 1);
  assert.equal(dependencies.workspaceUpdates[0]?.status, "canceled");
});

test("processGracePeriods pausa assinaturas com tolerância vencida", async () => {
  const dependencies = createDependencies({
    async listSubscriptionsForGracePeriodEnd() {
      return [
        {
          id: "sub-2",
          workspaceId: "workspace-2",
          planId: "starter",
          billingCycle: "monthly",
          priceId: "price-2",
          status: "past_due",
          autoRenew: true,
          currentPeriodStart: "2026-07-14T12:00:00.000Z",
          currentPeriodEnd: "2026-08-14T12:00:00.000Z",
          gracePeriodEndsAt: "2026-08-14T11:00:00.000Z",
          cancelAtPeriodEnd: false,
          cancelRequestedAt: null,
          endedAt: null,
          accessUntil: "2026-08-14T12:00:00.000Z",
          provider: "mercado_pago",
          providerSubscriptionId: "mp-sub-2",
          createdAt: "2026-07-14T12:00:00.000Z",
          updatedAt: "2026-08-14T11:00:00.000Z",
        },
      ];
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.processGracePeriods();

  assert.equal(result.changed, 1);
  assert.equal(dependencies.pauses.length, 1);
  assert.equal(dependencies.workspaceUpdates[0]?.status, "paused");
});

test("processScheduledCancellations encerra assinatura no fim do período", async () => {
  const dependencies = createDependencies({
    async listSubscriptionsForScheduledCancellation() {
      return [
        {
          id: "sub-3",
          workspaceId: "workspace-3",
          planId: "growth",
          billingCycle: "monthly",
          priceId: "price-3",
          status: "scheduled_cancel",
          autoRenew: false,
          currentPeriodStart: "2026-07-14T12:00:00.000Z",
          currentPeriodEnd: "2026-08-14T12:00:00.000Z",
          gracePeriodEndsAt: null,
          cancelAtPeriodEnd: true,
          cancelRequestedAt: "2026-08-10T12:00:00.000Z",
          endedAt: null,
          accessUntil: "2026-08-14T12:00:00.000Z",
          provider: "mercado_pago",
          providerSubscriptionId: "mp-sub-3",
          createdAt: "2026-07-14T12:00:00.000Z",
          updatedAt: "2026-08-10T12:00:00.000Z",
        },
      ];
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.processScheduledCancellations();

  assert.equal(result.changed, 1);
  assert.equal(dependencies.cancellations.length, 1);
  assert.equal(dependencies.workspaceUpdates[0]?.status, "canceled");
});

test("processExpiredInvoices expira Pix manual pendente", async () => {
  const dependencies = createDependencies({
    async listInvoicesForExpiration() {
      return [
        {
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
          providerPaymentId: "pay-1",
          providerAuthorizedPaymentId: null,
          paymentExpiresAt: "2026-08-14T11:00:00.000Z",
          paidAt: null,
          failedAt: null,
          refundedAt: null,
          createdAt: "2026-08-14T09:00:00.000Z",
          updatedAt: "2026-08-14T09:00:00.000Z",
        },
      ];
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.processExpiredInvoices();

  assert.equal(result.changed, 1);
  assert.equal(dependencies.invoiceUpdates[0]?.mutation.status, "expired");
  assert.equal(dependencies.auditEvents[0]?.action, "invoice.expired");
});

test("processAbandonedCheckouts encerra pendências antigas e volta workspace para unpaid", async () => {
  const dependencies = createDependencies({
    async listAbandonedPendingSubscriptions(input) {
      assert.equal(input.startedBefore, "2026-07-15T12:00:00.000Z");
      return [
        {
          id: "sub-4",
          workspaceId: "workspace-4",
          planId: "starter",
          billingCycle: "monthly",
          priceId: "price-4",
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
          createdAt: "2026-07-01T10:00:00.000Z",
          updatedAt: "2026-07-01T10:00:00.000Z",
        },
      ];
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.processAbandonedCheckouts();

  assert.equal(result.changed, 1);
  assert.equal(dependencies.cancellations.length, 1);
  assert.equal(dependencies.workspaceUpdates[0]?.status, "unpaid");
});

test("processScheduledChanges aplica change vencido com preço ativo", async () => {
  const dependencies = createDependencies({
    async getDueSubscriptionChanges() {
      return [
        {
          id: "chg-1",
          subscriptionId: "sub-5",
          workspaceId: "workspace-5",
          type: "downgrade",
          status: "scheduled",
          fromPlanId: "growth",
          toPlanId: "starter",
          fromBillingCycle: "monthly",
          toBillingCycle: "monthly",
          effectiveAt: "2026-08-14T10:00:00.000Z",
          creditAmountCents: 0,
          chargeAmountCents: 0,
          invoiceId: null,
          requestedByType: "user",
          requestedById: "user-1",
          createdAt: "2026-08-01T10:00:00.000Z",
          appliedAt: null,
          canceledAt: null,
        },
      ];
    },
    async getSubscriptionById() {
      return {
        id: "sub-5",
        workspaceId: "workspace-5",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-growth-monthly",
        status: "active",
        autoRenew: true,
        currentPeriodStart: "2026-07-14T10:00:00.000Z",
        currentPeriodEnd: "2026-08-14T10:00:00.000Z",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: "2026-08-14T10:00:00.000Z",
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-5",
        createdAt: "2026-07-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    async findActivePrice(input) {
      assert.equal(input.planId, "starter");
      assert.equal(input.billingCycle, "monthly");
      return { id: "price-starter-monthly" };
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.processScheduledChanges();

  assert.equal(result.changed, 1);
  assert.equal(dependencies.scheduledChanges[0]?.subscriptionId, "sub-5");
  assert.equal(
    dependencies.scheduledChanges[0]?.input.priceId,
    "price-starter-monthly",
  );
  assert.equal(dependencies.changeUpdates[0]?.mutation.status, "applied");
});

test("reconcileSubscription aponta active local sem provider", async () => {
  const dependencies = createDependencies({
    async getSubscriptionById() {
      return {
        id: "sub-6",
        workspaceId: "workspace-6",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-6",
        status: "active",
        autoRenew: true,
        currentPeriodStart: "2026-07-14T10:00:00.000Z",
        currentPeriodEnd: "2026-08-14T10:00:00.000Z",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: "2026-08-14T10:00:00.000Z",
        provider: null,
        providerSubscriptionId: null,
        createdAt: "2026-07-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.reconcileSubscription("sub-6");

  assert.equal(result.findings[0]?.code, "local_active_without_provider");
});

test("reconcileInvoice ativa assinatura pending quando Pix já foi pago", async () => {
  const dependencies = createDependencies({
    async getInvoiceById() {
      return {
        id: "inv-2",
        subscriptionId: "sub-7",
        workspaceId: "workspace-7",
        priceId: "price-7",
        type: "subscription",
        status: "pending",
        amountCents: 14900,
        currency: "BRL",
        periodStart: null,
        periodEnd: null,
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
        providerPaymentId: "pay-2",
        providerAuthorizedPaymentId: null,
        paymentExpiresAt: "2026-08-14T14:00:00.000Z",
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    async getSubscriptionById() {
      return {
        id: "sub-7",
        workspaceId: "workspace-7",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-7",
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
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    getProvider() {
      return {
        async getManualPayment(providerPaymentId) {
          assert.equal(providerPaymentId, "pay-2");
          return {
            provider: "mercado_pago",
            providerPaymentId: "pay-2",
            providerAuthorizedPaymentId: null,
            status: "approved",
            providerSubscriptionId: null,
            externalReference: "billing_invoice:inv-2",
            paymentMethod: "pix_manual",
            checkoutUrl: null,
            qrCode: null,
            qrCodeBase64: null,
            expiresAt: "2026-08-14T14:00:00.000Z",
          };
        },
      };
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.reconcileInvoice("inv-2");

  assert.equal(result.changed, 2);
  assert.equal(result.findings[0]?.code, "invoice_paid_subscription_not_active");
  assert.equal(dependencies.activations.length, 1);
  assert.equal(dependencies.workspaceUpdates[0]?.status, "active");
});

test("reconcileInvoice aplica upgrade pago para assinatura ativa", async () => {
  const dependencies = createDependencies({
    async getInvoiceById() {
      return {
        id: "inv-up-2",
        subscriptionId: "sub-up-2",
        workspaceId: "workspace-up-2",
        priceId: "price-growth-monthly",
        type: "upgrade",
        status: "pending",
        amountCents: 9900,
        currency: "BRL",
        periodStart: "2026-08-14T10:00:00.000Z",
        periodEnd: "2026-09-14T10:00:00.000Z",
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
        providerPaymentId: "pay-up-2",
        providerAuthorizedPaymentId: null,
        paymentExpiresAt: "2026-08-14T14:00:00.000Z",
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    async getSubscriptionById() {
      return {
        id: "sub-up-2",
        workspaceId: "workspace-up-2",
        planId: "starter",
        billingCycle: "monthly",
        priceId: "price-starter-monthly",
        status: "active",
        autoRenew: true,
        currentPeriodStart: "2026-08-14T10:00:00.000Z",
        currentPeriodEnd: "2026-09-14T10:00:00.000Z",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: "2026-09-14T10:00:00.000Z",
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-up-2",
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    async getSubscriptionChangeByInvoiceId(invoiceId) {
      assert.equal(invoiceId, "inv-up-2");
      return {
        id: "chg-up-2",
        subscriptionId: "sub-up-2",
        workspaceId: "workspace-up-2",
        type: "upgrade",
        status: "pending_payment",
        fromPlanId: "starter",
        toPlanId: "growth",
        fromBillingCycle: "monthly",
        toBillingCycle: "monthly",
        effectiveAt: "2026-08-14T10:00:00.000Z",
        creditAmountCents: 1500,
        chargeAmountCents: 11400,
        invoiceId: "inv-up-2",
        requestedByType: "user",
        requestedById: "user-1",
        createdAt: "2026-08-14T10:00:00.000Z",
        appliedAt: null,
        canceledAt: null,
      };
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
        async getManualPayment(providerPaymentId) {
          assert.equal(providerPaymentId, "pay-up-2");
          return {
            provider: "mercado_pago",
            providerPaymentId: "pay-up-2",
            providerAuthorizedPaymentId: null,
            status: "approved",
            providerSubscriptionId: "mp-sub-up-2",
            externalReference: "billing_invoice:inv-up-2",
            paymentMethod: "pix_manual",
            checkoutUrl: null,
            qrCode: null,
            qrCodeBase64: null,
            expiresAt: "2026-08-14T14:00:00.000Z",
          };
        },
        async updateSubscriptionAmount(input) {
          assert.deepEqual(input, {
            providerSubscriptionId: "mp-sub-up-2",
            amountCents: 14900,
            currency: "BRL",
            billingCycle: "monthly",
          });
          return {
            provider: "mercado_pago",
            providerSubscriptionId: "mp-sub-up-2",
            status: "active",
            checkoutUrl: null,
            externalReference: "billing_subscription:sub-up-2",
            payerEmail: "owner@dabi.app",
          };
        },
      };
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.reconcileInvoice("inv-up-2");

  assert.equal(result.changed, 2);
  assert.equal(dependencies.appliedUpgrades.length, 1);
  assert.equal(dependencies.changeUpdates[0]?.mutation.status, "applied");
  assert.equal(dependencies.workspaceUpdates[0]?.planId, "growth");
});

test("collectOperationalFindings expõe webhooks falhos para diagnóstico", async () => {
  const dependencies = createDependencies({
    async listFailedWebhookEvents() {
      return [
        {
          id: "evt-1",
          provider: "mercado_pago",
          providerEventId: "req-1",
          eventType: "payment",
          resourceId: "pay-1",
          payloadHash: "hash",
          status: "failed",
          attempts: 3,
          receivedAt: "2026-08-14T10:00:00.000Z",
          processedAt: null,
          errorCode: "MP_ERROR",
          errorMessage: "boom",
          createdAt: "2026-08-14T10:00:00.000Z",
          updatedAt: "2026-08-14T10:00:00.000Z",
        },
      ];
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.collectOperationalFindings();

  assert.equal(result.findings[0]?.code, "webhook_processing_failed");
  assert.equal(result.findings[0]?.webhookEventId, "evt-1");
});
