import { isSuperAdminSession } from "../auth/access-control.ts";
import type { AuthenticatedWorkspaceSession } from "../server/platform.ts";
import type { PersistenceMode } from "../server/persistence-mode.ts";
import type {
  BillingAuditActorType,
  BillingAuditEvent,
  BillingInvoice,
  BillingSubscription,
  BillingWebhookEvent,
} from "./types.ts";
import type { BillingReconciliationFinding } from "./reconciliation-service.ts";

export type BillingAdminSummary = {
  mrrCents: number;
  arrCents: number;
  totalRevenueCents: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  pastDueSubscriptions: number;
  pausedSubscriptions: number;
  scheduledCancelSubscriptions: number;
  expiredSubscriptions: number;
  newSubscriptionsLast30Days: number;
  cancellationsLast30Days: number;
  churnRatePercent: number | null;
  pendingPayments: number;
  failedPayments: number;
  failedWebhooks: number;
  reconciliationBacklog: number;
  starterSubscriptions: number;
  growthSubscriptions: number;
  scaleSubscriptions: number;
  monthlySubscriptions: number;
  annualSubscriptions: number;
  pixManualPayments: number;
  pixAutomaticPayments: number;
  cardPayments: number;
};

export type BillingAdminWorkspaceRecord = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  ownerEmail: string | null;
  ownerFullName: string | null;
  currentSubscriptionId: string | null;
  currentPlanId: BillingSubscription["planId"] | null;
  currentBillingCycle: BillingSubscription["billingCycle"] | null;
  currentStatus: BillingSubscription["status"] | null;
  accessUntil: string | null;
  currentPeriodEnd: string | null;
  calculationsCount: number;
  createdAt: string;
};

export type BillingAdminSubscriptionRecord = {
  subscriptionId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  ownerEmail: string | null;
  planId: BillingSubscription["planId"];
  billingCycle: BillingSubscription["billingCycle"];
  status: BillingSubscription["status"];
  autoRenew: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
  accessUntil: string | null;
  provider: BillingSubscription["provider"];
  providerSubscriptionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingAdminInvoiceRecord = {
  invoiceId: string;
  subscriptionId: string;
  workspaceId: string;
  workspaceName: string;
  planId: BillingSubscription["planId"] | null;
  billingCycle: BillingSubscription["billingCycle"] | null;
  type: BillingInvoice["type"];
  status: BillingInvoice["status"];
  amountCents: number;
  currency: string;
  paymentMethod: BillingInvoice["paymentMethod"];
  provider: BillingInvoice["provider"];
  providerPaymentId: string | null;
  providerAuthorizedPaymentId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingAdminAuditEventRecord = BillingAuditEvent & {
  workspaceName: string | null;
};

export type BillingAdminSubscriptionDetails = {
  subscription: BillingAdminSubscriptionRecord;
  invoices: BillingAdminInvoiceRecord[];
  timeline: BillingAdminAuditEventRecord[];
};

export type BillingAdminSnapshot = {
  generatedAt: string;
  persistence: {
    mode: PersistenceMode;
    enabled: boolean;
  };
  summary: BillingAdminSummary;
  workspaces: BillingAdminWorkspaceRecord[];
  subscriptions: BillingAdminSubscriptionRecord[];
  invoices: BillingAdminInvoiceRecord[];
  webhookEvents: BillingWebhookEvent[];
  auditEvents: BillingAdminAuditEventRecord[];
  findings: BillingReconciliationFinding[];
};

export class BillingAdminServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "BillingAdminServiceError";
    this.code = code;
    this.status = status;
  }
}

export type BillingAdminServiceDependencies = {
  isPersistenceEnabled(): boolean;
  getPersistenceMode(): PersistenceMode;
  getSummary(): Promise<BillingAdminSummary>;
  listWorkspaces(limit: number): Promise<BillingAdminWorkspaceRecord[]>;
  listSubscriptions(limit: number): Promise<BillingAdminSubscriptionRecord[]>;
  listInvoices(limit: number): Promise<BillingAdminInvoiceRecord[]>;
  listWebhookEvents(limit: number): Promise<BillingWebhookEvent[]>;
  listAuditEvents(limit: number): Promise<BillingAdminAuditEventRecord[]>;
  collectOperationalFindings(limit: number): Promise<BillingReconciliationFinding[]>;
  getSubscriptionRecord(
    subscriptionId: string,
  ): Promise<BillingAdminSubscriptionRecord | null>;
  getSubscriptionById(subscriptionId: string): Promise<BillingSubscription | null>;
  listInvoicesBySubscriptionId(
    subscriptionId: string,
    limit: number,
  ): Promise<BillingAdminInvoiceRecord[]>;
  listAuditEventsBySubscriptionId(
    subscriptionId: string,
    limit: number,
  ): Promise<BillingAdminAuditEventRecord[]>;
  updateSubscription(
    subscriptionId: string,
    mutation: Partial<Pick<BillingSubscription, "accessUntil">>,
  ): Promise<BillingSubscription | null>;
  appendAuditEvent(input: {
    workspaceId?: string | null;
    subscriptionId?: string | null;
    invoiceId?: string | null;
    actorType: BillingAuditActorType;
    actorId?: string | null;
    action: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<void>;
  getProvider(
    provider: BillingSubscription["provider"],
  ):
    | Pick<
        import("./providers/billing-provider.ts").BillingProvider,
        "getSubscription"
      >
    | null;
  now(): Date;
};

export class BillingAdminService {
  private readonly dependencies: BillingAdminServiceDependencies;

  constructor(dependencies: BillingAdminServiceDependencies) {
    this.dependencies = dependencies;
  }

  async getSnapshot(
    session: AuthenticatedWorkspaceSession,
  ): Promise<BillingAdminSnapshot> {
    this.assertSuperAdmin(session);

    const nowIso = this.dependencies.now().toISOString();

    if (!this.dependencies.isPersistenceEnabled()) {
      return {
        generatedAt: nowIso,
        persistence: {
          mode: this.dependencies.getPersistenceMode(),
          enabled: false,
        },
        summary: createEmptySummary(),
        workspaces: [],
        subscriptions: [],
        invoices: [],
        webhookEvents: [],
        auditEvents: [],
        findings: [],
      };
    }

    const [
      summary,
      workspaces,
      subscriptions,
      invoices,
      webhookEvents,
      auditEvents,
      findings,
    ] = await Promise.all([
      this.dependencies.getSummary(),
      this.dependencies.listWorkspaces(20),
      this.dependencies.listSubscriptions(20),
      this.dependencies.listInvoices(20),
      this.dependencies.listWebhookEvents(20),
      this.dependencies.listAuditEvents(20),
      this.dependencies.collectOperationalFindings(50),
    ]);

    return {
      generatedAt: nowIso,
      persistence: {
        mode: this.dependencies.getPersistenceMode(),
        enabled: true,
      },
      summary: {
        ...summary,
        reconciliationBacklog: Math.max(
          summary.reconciliationBacklog,
          findings.length,
        ),
      },
      workspaces,
      subscriptions,
      invoices,
      webhookEvents,
      auditEvents,
      findings,
    };
  }

  async getSubscriptionDetails(input: {
    session: AuthenticatedWorkspaceSession;
    subscriptionId: string;
  }): Promise<BillingAdminSubscriptionDetails | null> {
    this.assertSuperAdmin(input.session);

    if (!this.dependencies.isPersistenceEnabled()) {
      return null;
    }

    const subscription = await this.dependencies.getSubscriptionRecord(
      input.subscriptionId,
    );

    if (!subscription) {
      return null;
    }

    const [invoices, timeline] = await Promise.all([
      this.dependencies.listInvoicesBySubscriptionId(input.subscriptionId, 30),
      this.dependencies.listAuditEventsBySubscriptionId(input.subscriptionId, 40),
    ]);

    return {
      subscription,
      invoices,
      timeline,
    };
  }

  async grantAccessUntil(input: {
    session: AuthenticatedWorkspaceSession;
    subscriptionId: string;
    accessUntil: string | null;
  }) {
    this.assertSuperAdmin(input.session);
    this.assertPersistence();

    const subscription = await this.dependencies.getSubscriptionById(
      input.subscriptionId,
    );

    if (!subscription) {
      throw new BillingAdminServiceError(
        "Assinatura nao encontrada.",
        "ADMIN_BILLING_SUBSCRIPTION_NOT_FOUND",
        404,
      );
    }

    if (input.accessUntil && Number.isNaN(Date.parse(input.accessUntil))) {
      throw new BillingAdminServiceError(
        "Informe uma data valida para accessUntil.",
        "ADMIN_BILLING_INVALID_ACCESS_UNTIL",
        400,
      );
    }

    const updatedSubscription = await this.dependencies.updateSubscription(
      subscription.id,
      {
        accessUntil: input.accessUntil,
      },
    );

    if (!updatedSubscription) {
      throw new BillingAdminServiceError(
        "Falha ao atualizar accessUntil.",
        "ADMIN_BILLING_ACCESS_UNTIL_UPDATE_FAILED",
        500,
      );
    }

    await this.dependencies.appendAuditEvent({
      workspaceId: updatedSubscription.workspaceId,
      subscriptionId: updatedSubscription.id,
      actorType: "super_admin",
      actorId: input.session.user.id,
      action: "subscription.access_until_overridden",
      metadata: {
        previousAccessUntil: subscription.accessUntil,
        nextAccessUntil: input.accessUntil,
      },
    });

    return updatedSubscription;
  }

  async inspectProviderState(input: {
    session: AuthenticatedWorkspaceSession;
    subscriptionId: string;
  }) {
    this.assertSuperAdmin(input.session);
    this.assertPersistence();

    const subscription = await this.dependencies.getSubscriptionById(
      input.subscriptionId,
    );

    if (!subscription) {
      throw new BillingAdminServiceError(
        "Assinatura nao encontrada.",
        "ADMIN_BILLING_SUBSCRIPTION_NOT_FOUND",
        404,
      );
    }

    if (!subscription.provider || !subscription.providerSubscriptionId) {
      throw new BillingAdminServiceError(
        "A assinatura nao possui provider vinculado.",
        "ADMIN_BILLING_PROVIDER_NOT_AVAILABLE",
        409,
      );
    }

    const provider = this.dependencies.getProvider(subscription.provider);

    if (!provider) {
      throw new BillingAdminServiceError(
        "Provider indisponivel para consulta.",
        "ADMIN_BILLING_PROVIDER_NOT_AVAILABLE",
        409,
      );
    }

    const remoteSubscription = await provider.getSubscription(
      subscription.providerSubscriptionId,
    );

    await this.dependencies.appendAuditEvent({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription.id,
      actorType: "super_admin",
      actorId: input.session.user.id,
      action: "subscription.provider_inspected",
      metadata: {
        provider: subscription.provider,
        providerSubscriptionId: subscription.providerSubscriptionId,
        remoteStatus: remoteSubscription.status,
      },
    });

    return {
      localSubscription: subscription,
      remoteSubscription,
    };
  }

  private assertSuperAdmin(session: AuthenticatedWorkspaceSession) {
    if (!isSuperAdminSession(session)) {
      throw new BillingAdminServiceError(
        "A area administrativa de billing e exclusiva para super admin.",
        "FORBIDDEN_BILLING_ADMIN",
        403,
      );
    }
  }

  private assertPersistence() {
    if (!this.dependencies.isPersistenceEnabled()) {
      throw new BillingAdminServiceError(
        "Esse ambiente nao possui persistencia de billing habilitada.",
        "BILLING_ADMIN_PERSISTENCE_REQUIRED",
        409,
      );
    }
  }
}

function createEmptySummary(): BillingAdminSummary {
  return {
    mrrCents: 0,
    arrCents: 0,
    totalRevenueCents: 0,
    activeSubscriptions: 0,
    pendingSubscriptions: 0,
    pastDueSubscriptions: 0,
    pausedSubscriptions: 0,
    scheduledCancelSubscriptions: 0,
    expiredSubscriptions: 0,
    newSubscriptionsLast30Days: 0,
    cancellationsLast30Days: 0,
    churnRatePercent: null,
    pendingPayments: 0,
    failedPayments: 0,
    failedWebhooks: 0,
    reconciliationBacklog: 0,
    starterSubscriptions: 0,
    growthSubscriptions: 0,
    scaleSubscriptions: 0,
    monthlySubscriptions: 0,
    annualSubscriptions: 0,
    pixManualPayments: 0,
    pixAutomaticPayments: 0,
    cardPayments: 0,
  };
}
