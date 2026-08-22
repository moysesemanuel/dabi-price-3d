import assert from "node:assert/strict";
import test from "node:test";

import {
  BillingAdminService,
  BillingAdminServiceError,
} from "../src/lib/billing/admin-service.ts";

function createSession(platformRole = "super_admin") {
  return {
    sessionId: "sess-1",
    user: {
      id: "user-1",
      email: "admin@dabi.app",
      fullName: "Admin",
      platformRole,
      status: "active",
    },
    workspace: {
      id: "workspace-1",
      name: "Workspace Admin",
      slug: "workspace-admin",
      role: "owner",
    },
  };
}

function createDependencies(overrides = {}) {
  const auditEvents = [];

  return {
    auditEvents,
    isPersistenceEnabled() {
      return true;
    },
    getPersistenceMode() {
      return "database";
    },
    async getSummary() {
      return {
        mrrCents: 14900,
        arrCents: 178800,
        totalRevenueCents: 29800,
        activeSubscriptions: 1,
        pendingSubscriptions: 0,
        pastDueSubscriptions: 0,
        pausedSubscriptions: 0,
        scheduledCancelSubscriptions: 0,
        expiredSubscriptions: 0,
        newSubscriptionsLast30Days: 1,
        cancellationsLast30Days: 0,
        churnRatePercent: 0,
        pendingPayments: 0,
        failedPayments: 0,
        failedWebhooks: 1,
        reconciliationBacklog: 1,
        starterSubscriptions: 0,
        growthSubscriptions: 1,
        scaleSubscriptions: 0,
        monthlySubscriptions: 1,
        annualSubscriptions: 0,
        pixManualPayments: 1,
        pixAutomaticPayments: 0,
        cardPayments: 0,
      };
    },
    async listWorkspaces() {
      return [];
    },
    async listSubscriptions() {
      return [];
    },
    async listInvoices() {
      return [];
    },
    async listWebhookEvents() {
      return [];
    },
    async listAuditEvents() {
      return [];
    },
    async collectOperationalFindings() {
      return [{ code: "webhook_processing_failed" }];
    },
    async runProviderReconciliation() {
      return {
        processed: 3,
        changed: 1,
        findings: [
          {
            code: "provider_active_local_pending",
            workspaceId: "workspace-1",
            subscriptionId: "sub-1",
            details: { providerSubscriptionId: "mp-sub-1" },
          },
        ],
        steps: {},
      };
    },
    async getSubscriptionRecord() {
      return {
        subscriptionId: "sub-1",
        workspaceId: "workspace-1",
        workspaceName: "Workspace Admin",
        workspaceSlug: "workspace-admin",
        ownerEmail: "owner@dabi.app",
        planId: "growth",
        billingCycle: "monthly",
        status: "active",
        autoRenew: true,
        currentPeriodStart: "2026-08-01T00:00:00.000Z",
        currentPeriodEnd: "2026-09-01T00:00:00.000Z",
        gracePeriodEndsAt: null,
        accessUntil: "2026-09-01T00:00:00.000Z",
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-1",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-14T00:00:00.000Z",
      };
    },
    async getSubscriptionById() {
      return {
        id: "sub-1",
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-1",
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
        providerSubscriptionId: "mp-sub-1",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-14T00:00:00.000Z",
      };
    },
    async listInvoicesBySubscriptionId() {
      return [];
    },
    async listAuditEventsBySubscriptionId() {
      return [];
    },
    async updateSubscription(subscriptionId, mutation) {
      return {
        id: subscriptionId,
        workspaceId: "workspace-1",
        planId: "growth",
        billingCycle: "monthly",
        priceId: "price-1",
        status: "active",
        autoRenew: true,
        currentPeriodStart: "2026-08-01T00:00:00.000Z",
        currentPeriodEnd: "2026-09-01T00:00:00.000Z",
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
        endedAt: null,
        accessUntil: mutation.accessUntil ?? null,
        provider: "mercado_pago",
        providerSubscriptionId: "mp-sub-1",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-14T00:00:00.000Z",
      };
    },
    async appendAuditEvent(input) {
      auditEvents.push(input);
    },
    getProvider() {
      return {
        async getSubscription(providerSubscriptionId) {
          return {
            provider: "mercado_pago",
            providerSubscriptionId,
            status: "active",
            checkoutUrl: null,
            externalReference: "billing_subscription:sub-1",
            payerEmail: "owner@dabi.app",
          };
        },
      };
    },
    now() {
      return new Date("2026-08-14T12:00:00.000Z");
    },
    ...overrides,
  };
}

test("snapshot administrativo exige super admin", async () => {
  const service = new BillingAdminService(createDependencies());

  await assert.rejects(
    () => service.getSnapshot(createSession("user")),
    (error) =>
      error instanceof BillingAdminServiceError &&
      error.code === "FORBIDDEN_BILLING_ADMIN" &&
      error.status === 403,
  );
});

test("snapshot administrativo retorna fallback vazio sem persistência", async () => {
  const service = new BillingAdminService(
    createDependencies({
      isPersistenceEnabled() {
        return false;
      },
      getPersistenceMode() {
        return "local";
      },
    }),
  );

  const snapshot = await service.getSnapshot(createSession());

  assert.equal(snapshot.persistence.enabled, false);
  assert.equal(snapshot.persistence.mode, "local");
  assert.equal(snapshot.summary.activeSubscriptions, 0);
  assert.deepEqual(snapshot.workspaces, []);
});

test("snapshot administrativo normaliza churn numérico retornado como texto", async () => {
  const service = new BillingAdminService(
    createDependencies({
      async getSummary() {
        return {
          ...(await createDependencies().getSummary()),
          churnRatePercent: "12.50",
        };
      },
    }),
  );

  const snapshot = await service.getSnapshot(createSession());

  assert.equal(snapshot.summary.churnRatePercent, 12.5);
});

test("grantAccessUntil atualiza exceção administrativa e audita a ação", async () => {
  const dependencies = createDependencies();
  const service = new BillingAdminService(dependencies);

  const updated = await service.grantAccessUntil({
    session: createSession(),
    subscriptionId: "sub-1",
    accessUntil: "2026-09-10T10:00:00.000Z",
    reason: "Extensão aprovada após indisponibilidade do provider.",
  });

  assert.equal(updated.accessUntil, "2026-09-10T10:00:00.000Z");
  assert.deepEqual(dependencies.auditEvents[0], {
    workspaceId: "workspace-1",
    subscriptionId: "sub-1",
    actorType: "super_admin",
    actorId: "user-1",
    action: "subscription.access_until_overridden",
    metadata: {
      previousAccessUntil: "2026-09-01T00:00:00.000Z",
      nextAccessUntil: "2026-09-10T10:00:00.000Z",
      reason: "Extensão aprovada após indisponibilidade do provider.",
    },
  });
});

test("grantAccessUntil exige justificativa para a exceção administrativa", async () => {
  const service = new BillingAdminService(createDependencies());

  await assert.rejects(
    () =>
      service.grantAccessUntil({
        session: createSession(),
        subscriptionId: "sub-1",
        accessUntil: "2026-09-10T10:00:00.000Z",
        reason: "   ",
      }),
    (error) =>
      error instanceof BillingAdminServiceError &&
      error.code === "ADMIN_BILLING_ACCESS_UNTIL_REASON_REQUIRED" &&
      error.status === 400,
  );
});

test("inspectProviderState consulta o provider remoto e audita a inspeção", async () => {
  const dependencies = createDependencies();
  const service = new BillingAdminService(dependencies);

  const inspection = await service.inspectProviderState({
    session: createSession(),
    subscriptionId: "sub-1",
  });

  assert.equal(inspection.remoteSubscription.providerSubscriptionId, "mp-sub-1");
  assert.equal(dependencies.auditEvents[0]?.action, "subscription.provider_inspected");
});

test("super admin dispara reconciliacao limitada e auditada", async () => {
  const dependencies = createDependencies();
  const service = new BillingAdminService(dependencies);

  const result = await service.runProviderReconciliation({
    session: createSession(),
  });

  assert.deepEqual(result, {
    processed: 3,
    changed: 1,
    findings: [
      {
        code: "provider_active_local_pending",
        workspaceId: "workspace-1",
        subscriptionId: "sub-1",
        details: { providerSubscriptionId: "mp-sub-1" },
      },
    ],
    steps: {},
  });
  assert.deepEqual(dependencies.auditEvents[0], {
    actorType: "super_admin",
    actorId: "user-1",
    action: "billing.provider_reconciliation_requested",
    metadata: {
      limit: 20,
      processed: 3,
      changed: 1,
      findings: [
        {
          code: "provider_active_local_pending",
          workspaceId: "workspace-1",
          subscriptionId: "sub-1",
          details: { providerSubscriptionId: "mp-sub-1" },
        },
      ],
    },
  });
});
