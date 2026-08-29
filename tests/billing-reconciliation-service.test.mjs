import assert from "node:assert/strict";
import test from "node:test";

import { BillingReconciliationService } from "../src/lib/billing/reconciliation-service.ts";

function createDependencies(overrides = {}) {
  const activations = [];
  const renewals = [];
  const pastDues = [];
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
    renewals,
    pastDues,
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
      async renewSubscription(subscriptionId, input) {
        renewals.push({ subscriptionId, input });
      },
      async markPastDue(subscriptionId, input) {
        pastDues.push({ subscriptionId, input });
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
    async findInvoiceByProviderPaymentId() {
      return null;
    },
    async findInvoiceByProviderAuthorizedPaymentId() {
      return null;
    },
    async createInvoice() {
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
  const subscriptionOperationClaims = [];
  const dependencies = createDependencies({
    async withSubscriptionOperation(subscriptionId, operation) {
      subscriptionOperationClaims.push(subscriptionId);
      return operation();
    },
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
  assert.deepEqual(subscriptionOperationClaims, ["sub-1"]);
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

test("processExpiredInvoices nao sobrescreve pagamento vencido por transicao concorrente", async () => {
  const dependencies = createDependencies({
    async listInvoicesForExpiration() {
      return [
        {
          id: "inv-concurrent-1",
          subscriptionId: "sub-concurrent-1",
          workspaceId: "workspace-concurrent-1",
          priceId: "price-1",
          type: "subscription",
          status: "pending",
          amountCents: 14900,
          currency: "BRL",
          periodStart: null,
          periodEnd: null,
          paymentMethod: "pix_manual",
          provider: "mercado_pago",
          providerPaymentId: "pay-concurrent-1",
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
    async transitionPendingInvoice() {
      // A competing payment webhook transitioned the invoice before expiry won.
      return null;
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.processExpiredInvoices();

  assert.equal(result.changed, 0);
  assert.equal(dependencies.invoiceUpdates.length, 0);
  assert.equal(dependencies.auditEvents.length, 0);
});

test("reconcileInvoice retoma ativacao interrompida depois de invoice paga", async () => {
  const claimed = [];
  const completed = [];
  const dependencies = createDependencies({
    async getInvoiceById() {
      return {
        id: "inv-paid-recovery-1",
        subscriptionId: "sub-paid-recovery-1",
        workspaceId: "workspace-paid-recovery-1",
        priceId: "price-1",
        type: "subscription",
        status: "paid",
        amountCents: 14900,
        currency: "BRL",
        periodStart: "2026-08-14T12:00:00.000Z",
        periodEnd: "2026-09-14T12:00:00.000Z",
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
        providerPaymentId: "pay-paid-recovery-1",
        providerAuthorizedPaymentId: null,
        paymentExpiresAt: null,
        paidAt: "2026-08-14T12:00:00.000Z",
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T11:59:00.000Z",
        updatedAt: "2026-08-14T12:00:00.000Z",
      };
    },
    async getSubscriptionById() {
      return {
        id: "sub-paid-recovery-1",
        workspaceId: "workspace-paid-recovery-1",
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
        createdAt: "2026-08-14T11:59:00.000Z",
        updatedAt: "2026-08-14T12:00:00.000Z",
      };
    },
    async claimInvoiceEffect(invoiceId) {
      claimed.push(invoiceId);
      return "claim-paid-recovery-1";
    },
    async completeInvoiceEffect(input) {
      completed.push(input);
      return true;
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.reconcileInvoice("inv-paid-recovery-1");

  assert.equal(result.changed, 1);
  assert.equal(dependencies.activations.length, 1);
  assert.deepEqual(claimed, ["inv-paid-recovery-1"]);
  assert.deepEqual(completed, [
    {
      invoiceId: "inv-paid-recovery-1",
      claimToken: "claim-paid-recovery-1",
    },
  ]);
});

test("reconcileInvoice concorrente aplica somente um efeito de invoice paga", async () => {
  let claimAvailable = true;
  const completed = [];
  const dependencies = createDependencies({
    async getInvoiceById() {
      return {
        id: "inv-paid-concurrent-1",
        subscriptionId: "sub-paid-concurrent-1",
        workspaceId: "workspace-paid-concurrent-1",
        priceId: "price-1",
        type: "subscription",
        status: "paid",
        amountCents: 14900,
        currency: "BRL",
        periodStart: null,
        periodEnd: null,
        paymentMethod: "pix_manual",
        provider: "mercado_pago",
        providerPaymentId: "pay-paid-concurrent-1",
        providerAuthorizedPaymentId: null,
        paymentExpiresAt: null,
        paidAt: "2026-08-14T12:00:00.000Z",
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T11:59:00.000Z",
        updatedAt: "2026-08-14T12:00:00.000Z",
      };
    },
    async getSubscriptionById() {
      return {
        id: "sub-paid-concurrent-1",
        workspaceId: "workspace-paid-concurrent-1",
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
        createdAt: "2026-08-14T11:59:00.000Z",
        updatedAt: "2026-08-14T12:00:00.000Z",
      };
    },
    async claimInvoiceEffect() {
      if (!claimAvailable) {
        return null;
      }

      claimAvailable = false;
      return "claim-paid-concurrent-1";
    },
    async completeInvoiceEffect(input) {
      completed.push(input);
      return true;
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const results = await Promise.all([
    service.reconcileInvoice("inv-paid-concurrent-1"),
    service.reconcileInvoice("inv-paid-concurrent-1"),
  ]);

  assert.deepEqual(results.map((result) => result.changed).sort(), [0, 1]);
  assert.equal(dependencies.activations.length, 1);
  assert.equal(completed.length, 1);
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

function createAuthorizedPaymentRecoveryHarness({
  payments = [
    {
      provider: "mercado_pago",
      providerPaymentId: "pay-recovery-1",
      providerAuthorizedPaymentId: "auth-recovery-1",
      status: "approved",
      providerSubscriptionId: "mp-sub-recovery-1",
      externalReference: "billing_subscription:sub-recovery-1",
      paymentMethod: "card",
      approvedAt: "2026-08-14T12:00:00.000Z",
    },
  ],
  invoices = [],
} = {}) {
  const subscription = {
    id: "sub-recovery-1",
    workspaceId: "workspace-recovery-1",
    planId: "starter",
    billingCycle: "monthly",
    priceId: "price-starter-monthly",
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
    providerSubscriptionId: "mp-sub-recovery-1",
    createdAt: "2026-08-14T11:00:00.000Z",
    updatedAt: "2026-08-14T11:00:00.000Z",
  };
  let invoiceSequence = invoices.length;

  const dependencies = createDependencies({
    async getSubscriptionById(subscriptionId) {
      assert.equal(subscriptionId, subscription.id);
      return subscription;
    },
    async getInvoiceById(invoiceId) {
      return invoices.find((invoice) => invoice.id === invoiceId) ?? null;
    },
    async findInvoiceByProviderPaymentId({ providerPaymentId }) {
      return (
        invoices.find(
          (invoice) => invoice.providerPaymentId === providerPaymentId,
        ) ?? null
      );
    },
    async findInvoiceByProviderAuthorizedPaymentId({
      providerAuthorizedPaymentId,
    }) {
      return (
        invoices.find(
          (invoice) =>
            invoice.providerAuthorizedPaymentId === providerAuthorizedPaymentId,
        ) ?? null
      );
    },
    async createInvoice(input) {
      const invoice = {
        id: `inv-recovery-${++invoiceSequence}`,
        ...input,
        paymentExpiresAt: null,
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T12:00:00.000Z",
        updatedAt: "2026-08-14T12:00:00.000Z",
      };
      invoices.push(invoice);
      return invoice;
    },
    async updateInvoice(invoiceId, mutation) {
      const invoice = invoices.find((current) => current.id === invoiceId);
      if (!invoice) {
        return null;
      }

      Object.assign(invoice, mutation);
      return invoice;
    },
    async transitionPendingInvoice(invoiceId, mutation) {
      const invoice = invoices.find((current) => current.id === invoiceId);
      if (!invoice || invoice.status !== "pending") {
        return null;
      }

      Object.assign(invoice, mutation);
      return invoice;
    },
    async claimInvoiceEffect() {
      return "claim-recovery-1";
    },
    async completeInvoiceEffect() {
      return true;
    },
    getProvider() {
      return {
        async getSubscription() {
          return { status: "active" };
        },
        async listAuthorizedPayments() {
          return payments;
        },
        async getPayment(providerAuthorizedPaymentId) {
          const payment = payments.find(
            (current) =>
              current.providerAuthorizedPaymentId === providerAuthorizedPaymentId,
          );
          assert.ok(payment);
          return payment;
        },
      };
    },
  });

  const activateSubscription = dependencies.billingService.activateSubscription;
  dependencies.billingService.activateSubscription = async (...args) => {
    await activateSubscription(...args);
    subscription.status = "active";
    subscription.accessUntil = args[1].accessUntil;
  };

  return { dependencies, invoices, subscription };
}

test("reconcileSubscription recupera pagamento autorizado aprovado em assinatura pending", async () => {
  const { dependencies, invoices, subscription } =
    createAuthorizedPaymentRecoveryHarness();
  const service = new BillingReconciliationService(dependencies);

  const result = await service.reconcileSubscription(subscription.id);

  assert.equal(result.changed, 2);
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].status, "paid");
  assert.equal(invoices[0].providerAuthorizedPaymentId, "auth-recovery-1");
  assert.equal(invoices[0].providerPaymentId, "pay-recovery-1");
  assert.equal(subscription.status, "active");
  assert.equal(dependencies.activations.length, 1);
  assert.equal(dependencies.workspaceUpdates.length, 1);
});

test("reconcileSubscription reexecutada não duplica invoice nem ativação", async () => {
  const { dependencies, invoices, subscription } =
    createAuthorizedPaymentRecoveryHarness();
  const service = new BillingReconciliationService(dependencies);

  await service.reconcileSubscription(subscription.id);
  const second = await service.reconcileSubscription(subscription.id);

  assert.equal(second.changed, 0);
  assert.equal(invoices.length, 1);
  assert.equal(dependencies.activations.length, 1);
});

test("reconcileSubscription não ativa cobrança autorizada ainda não aprovada", async () => {
  const { dependencies, invoices, subscription } = createAuthorizedPaymentRecoveryHarness({
    payments: [
      {
        provider: "mercado_pago",
        providerPaymentId: "pay-pending-1",
        providerAuthorizedPaymentId: "auth-pending-1",
        status: "pending",
        providerSubscriptionId: "mp-sub-recovery-1",
        externalReference: "billing_subscription:sub-recovery-1",
        paymentMethod: "card",
      },
    ],
  });
  const service = new BillingReconciliationService(dependencies);

  const result = await service.reconcileSubscription(subscription.id);

  assert.equal(result.changed, 0);
  assert.equal(result.findings[0]?.code, "provider_authorized_payment_not_approved");
  assert.equal(invoices.length, 0);
  assert.equal(dependencies.activations.length, 0);
});

test("reconcileSubscription rejeita external reference incompatível", async () => {
  const { dependencies, invoices, subscription } = createAuthorizedPaymentRecoveryHarness({
    payments: [
      {
        provider: "mercado_pago",
        providerPaymentId: "pay-mismatch-ref-1",
        providerAuthorizedPaymentId: "auth-mismatch-ref-1",
        status: "approved",
        providerSubscriptionId: "mp-sub-recovery-1",
        externalReference: "billing_subscription:other-subscription",
        paymentMethod: "card",
      },
    ],
  });
  const service = new BillingReconciliationService(dependencies);

  const result = await service.reconcileSubscription(subscription.id);

  assert.equal(result.changed, 0);
  assert.equal(
    result.findings[0]?.code,
    "provider_authorized_payment_correlation_mismatch",
  );
  assert.equal(invoices.length, 0);
});

test("reconcileSubscription rejeita authorized payment de outra assinatura do provider", async () => {
  const { dependencies, invoices, subscription } = createAuthorizedPaymentRecoveryHarness({
    payments: [
      {
        provider: "mercado_pago",
        providerPaymentId: "pay-mismatch-sub-1",
        providerAuthorizedPaymentId: "auth-mismatch-sub-1",
        status: "approved",
        providerSubscriptionId: "mp-sub-other",
        externalReference: "billing_subscription:sub-recovery-1",
        paymentMethod: "card",
      },
    ],
  });
  const service = new BillingReconciliationService(dependencies);

  const result = await service.reconcileSubscription(subscription.id);

  assert.equal(result.changed, 0);
  assert.equal(
    result.findings[0]?.code,
    "provider_authorized_payment_correlation_mismatch",
  );
  assert.equal(invoices.length, 0);
});

test("reconcileSubscription escolhe deterministicamente a primeira cobrança aprovada", async () => {
  const { dependencies, invoices, subscription } = createAuthorizedPaymentRecoveryHarness({
    payments: [
      {
        provider: "mercado_pago",
        providerPaymentId: "pay-first-1",
        providerAuthorizedPaymentId: "auth-first-1",
        status: "approved",
        providerSubscriptionId: "mp-sub-recovery-1",
        externalReference: "billing_subscription:sub-recovery-1",
        paymentMethod: "card",
      },
      {
        provider: "mercado_pago",
        providerPaymentId: "pay-second-1",
        providerAuthorizedPaymentId: "auth-second-1",
        status: "approved",
        providerSubscriptionId: "mp-sub-recovery-1",
        externalReference: "billing_subscription:sub-recovery-1",
        paymentMethod: "card",
      },
    ],
  });
  const service = new BillingReconciliationService(dependencies);

  await service.reconcileSubscription(subscription.id);

  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].providerAuthorizedPaymentId, "auth-first-1");
});

test("reconcileSubscription reutiliza invoice encontrada por authorized payment", async () => {
  const invoice = {
    id: "inv-existing-authorized-1",
    subscriptionId: "sub-recovery-1",
    workspaceId: "workspace-recovery-1",
    priceId: "price-starter-monthly",
    type: "subscription",
    status: "pending",
    amountCents: 4900,
    currency: "BRL",
    periodStart: "2026-08-14T12:00:00.000Z",
    periodEnd: "2026-09-14T12:00:00.000Z",
    paymentMethod: "card",
    provider: "mercado_pago",
    providerPaymentId: "pay-recovery-1",
    providerAuthorizedPaymentId: "auth-recovery-1",
    paymentExpiresAt: null,
    paidAt: null,
    failedAt: null,
    refundedAt: null,
    createdAt: "2026-08-14T12:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
  };
  const { dependencies, invoices, subscription } = createAuthorizedPaymentRecoveryHarness({
    invoices: [invoice],
  });
  const service = new BillingReconciliationService(dependencies);

  await service.reconcileSubscription(subscription.id);

  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].status, "paid");
});

test("reconcileSubscription reutiliza invoice encontrada por payment do provider", async () => {
  const invoice = {
    id: "inv-existing-payment-1",
    subscriptionId: "sub-recovery-1",
    workspaceId: "workspace-recovery-1",
    priceId: "price-starter-monthly",
    type: "subscription",
    status: "pending",
    amountCents: 4900,
    currency: "BRL",
    periodStart: "2026-08-14T12:00:00.000Z",
    periodEnd: "2026-09-14T12:00:00.000Z",
    paymentMethod: "card",
    provider: "mercado_pago",
    providerPaymentId: "pay-recovery-1",
    providerAuthorizedPaymentId: "different-authorized-id",
    paymentExpiresAt: null,
    paidAt: null,
    failedAt: null,
    refundedAt: null,
    createdAt: "2026-08-14T12:00:00.000Z",
    updatedAt: "2026-08-14T12:00:00.000Z",
  };
  const { dependencies, invoices, subscription } = createAuthorizedPaymentRecoveryHarness({
    invoices: [invoice],
  });
  const service = new BillingReconciliationService(dependencies);

  await service.reconcileSubscription(subscription.id);

  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].status, "paid");
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

test("reconcileInvoice renova assinatura ativa com cobrança automática paga", async () => {
  const dependencies = createDependencies({
    async getInvoiceById() {
      return {
        id: "inv-renew-3",
        subscriptionId: "sub-renew-3",
        workspaceId: "workspace-renew-3",
        priceId: "price-growth-monthly",
        type: "renewal",
        status: "pending",
        amountCents: 14900,
        currency: "BRL",
        periodStart: "2026-08-14T10:00:00.000Z",
        periodEnd: "2026-09-14T10:00:00.000Z",
        paymentMethod: "pix_automatic",
        provider: "mercado_pago",
        providerPaymentId: "pay-renew-3",
        providerAuthorizedPaymentId: "auth-renew-3",
        paymentExpiresAt: null,
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    async getSubscriptionById() {
      return {
        id: "sub-renew-3",
        workspaceId: "workspace-renew-3",
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
        providerSubscriptionId: "mp-sub-renew-3",
        createdAt: "2026-07-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    getProvider() {
      return {
        async getManualPayment() {
          throw new Error("not used");
        },
        async getPayment(providerAuthorizedPaymentId) {
          assert.equal(providerAuthorizedPaymentId, "auth-renew-3");
          return {
            provider: "mercado_pago",
            providerPaymentId: "pay-renew-3",
            providerAuthorizedPaymentId: "auth-renew-3",
            status: "approved",
            providerSubscriptionId: "mp-sub-renew-3",
            externalReference: "billing_subscription:sub-renew-3",
            paymentMethod: "pix_automatic",
          };
        },
      };
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.reconcileInvoice("inv-renew-3");

  assert.equal(result.changed, 2);
  assert.equal(dependencies.renewals.length, 1);
  assert.equal(
    dependencies.renewals[0]?.input.currentPeriodStart,
    "2026-08-14T10:00:00.000Z",
  );
  assert.equal(dependencies.workspaceUpdates[0]?.status, "active");
});

test("reconcileInvoice inicia tolerância quando renovação automática falha", async () => {
  const dependencies = createDependencies({
    async getInvoiceById() {
      return {
        id: "inv-renew-4",
        subscriptionId: "sub-renew-4",
        workspaceId: "workspace-renew-4",
        priceId: "price-growth-monthly",
        type: "renewal",
        status: "pending",
        amountCents: 14900,
        currency: "BRL",
        periodStart: "2026-08-14T10:00:00.000Z",
        periodEnd: "2026-09-14T10:00:00.000Z",
        paymentMethod: "pix_automatic",
        provider: "mercado_pago",
        providerPaymentId: "pay-renew-4",
        providerAuthorizedPaymentId: "auth-renew-4",
        paymentExpiresAt: null,
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: "2026-08-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    async getSubscriptionById() {
      return {
        id: "sub-renew-4",
        workspaceId: "workspace-renew-4",
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
        providerSubscriptionId: "mp-sub-renew-4",
        createdAt: "2026-07-14T10:00:00.000Z",
        updatedAt: "2026-08-14T10:00:00.000Z",
      };
    },
    getProvider() {
      return {
        async getManualPayment() {
          throw new Error("not used");
        },
        async getPayment() {
          return {
            provider: "mercado_pago",
            providerPaymentId: "pay-renew-4",
            providerAuthorizedPaymentId: "auth-renew-4",
            status: "rejected",
            providerSubscriptionId: "mp-sub-renew-4",
            externalReference: "billing_subscription:sub-renew-4",
            paymentMethod: "pix_automatic",
          };
        },
      };
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.reconcileInvoice("inv-renew-4");

  assert.equal(result.changed, 2);
  assert.equal(result.findings[0]?.code, "invoice_failed_subscription_active");
  assert.deepEqual(dependencies.pastDues[0], {
    subscriptionId: "sub-renew-4",
    input: {
      actorType: "system",
      gracePeriodEndsAt: "2026-08-19T12:00:00.000Z",
    },
  });
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

test("reconcileProviderState percorre assinaturas e invoices selecionadas para o lote", async () => {
  const calls = [];
  const subscription = {
    id: "sub-provider-batch-1",
    workspaceId: "workspace-provider-batch-1",
    planId: "growth",
    billingCycle: "monthly",
    priceId: "price-growth-monthly",
    status: "active",
    autoRenew: true,
    currentPeriodStart: "2026-08-01T00:00:00.000Z",
    currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    gracePeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    cancelRequestedAt: null,
    endedAt: null,
    accessUntil: "2026-09-01T00:00:00.000Z",
    provider: "mercado_pago",
    providerSubscriptionId: "mp-sub-provider-batch-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
  };
  const dependencies = createDependencies({
    async listSubscriptionsForProviderReconciliation(limit) {
      calls.push(["subscriptions", limit]);
      return [subscription];
    },
    async listInvoicesForProviderReconciliation(limit) {
      calls.push(["invoices", limit]);
      return [];
    },
    async getSubscriptionById(subscriptionId) {
      assert.equal(subscriptionId, subscription.id);
      return subscription;
    },
    getProvider() {
      return {
        async getSubscription(providerSubscriptionId) {
          assert.equal(providerSubscriptionId, subscription.providerSubscriptionId);
          return { status: "active" };
        },
      };
    },
  });

  const service = new BillingReconciliationService(dependencies);
  const result = await service.reconcileProviderState(25);

  assert.deepEqual(calls, [
    ["subscriptions", 25],
    ["invoices", 25],
  ]);
  assert.equal(result.processed, 1);
  assert.equal(result.changed, 0);
  assert.deepEqual(result.findings, []);
});
