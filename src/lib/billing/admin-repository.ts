import "server-only";

import { getSql } from "@/lib/server/neon";
import { ensurePlatformReady } from "@/lib/server/platform";
import type { BillingWebhookEvent } from "./types.ts";
import type {
  BillingAdminAuditEventRecord,
  BillingAdminInvoiceRecord,
  BillingAdminSubscriptionRecord,
  BillingAdminSummary,
  BillingAdminWorkspaceRecord,
} from "./admin-service.ts";

type BillingAdminSummaryRow = {
  mrr_cents: number | null;
  arr_cents: number | null;
  total_revenue_cents: number | null;
  active_subscriptions: number | null;
  pending_subscriptions: number | null;
  past_due_subscriptions: number | null;
  paused_subscriptions: number | null;
  scheduled_cancel_subscriptions: number | null;
  expired_subscriptions: number | null;
  new_subscriptions_last_30_days: number | null;
  cancellations_last_30_days: number | null;
  // PostgreSQL numeric values are returned as strings by the Neon driver.
  churn_rate_percent: number | string | null;
  pending_payments: number | null;
  failed_payments: number | null;
  failed_webhooks: number | null;
  reconciliation_backlog: number | null;
  starter_subscriptions: number | null;
  growth_subscriptions: number | null;
  scale_subscriptions: number | null;
  monthly_subscriptions: number | null;
  annual_subscriptions: number | null;
  pix_manual_payments: number | null;
  pix_automatic_payments: number | null;
  card_payments: number | null;
};

type BillingAdminWorkspaceRow = {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  owner_email: string | null;
  owner_full_name: string | null;
  current_subscription_id: string | null;
  current_plan_id: BillingAdminSubscriptionRecord["planId"] | null;
  current_billing_cycle: BillingAdminSubscriptionRecord["billingCycle"] | null;
  current_status: BillingAdminSubscriptionRecord["status"] | null;
  access_until: string | null;
  current_period_end: string | null;
  calculations_count: number | null;
  created_at: string;
};

type BillingAdminSubscriptionRow = {
  subscription_id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  owner_email: string | null;
  plan_id: BillingAdminSubscriptionRecord["planId"];
  billing_cycle: BillingAdminSubscriptionRecord["billingCycle"];
  status: BillingAdminSubscriptionRecord["status"];
  auto_renew: boolean;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  access_until: string | null;
  provider: BillingAdminSubscriptionRecord["provider"];
  provider_subscription_id: string | null;
  created_at: string;
  updated_at: string;
};

type BillingAdminInvoiceRow = {
  invoice_id: string;
  subscription_id: string;
  workspace_id: string;
  workspace_name: string;
  plan_id: BillingAdminInvoiceRecord["planId"];
  billing_cycle: BillingAdminInvoiceRecord["billingCycle"];
  type: BillingAdminInvoiceRecord["type"];
  status: BillingAdminInvoiceRecord["status"];
  amount_cents: number;
  currency: string;
  payment_method: BillingAdminInvoiceRecord["paymentMethod"];
  provider: BillingAdminInvoiceRecord["provider"];
  provider_payment_id: string | null;
  provider_authorized_payment_id: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
};

type BillingAdminAuditEventRow = {
  id: string;
  workspace_id: string | null;
  workspace_name: string | null;
  subscription_id: string | null;
  invoice_id: string | null;
  actor_type: BillingAdminAuditEventRecord["actorType"];
  actor_id: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type BillingWebhookEventRow = {
  id: string;
  provider: BillingWebhookEvent["provider"];
  provider_event_id: string;
  event_type: string;
  resource_id: string | null;
  payload_hash: string;
  status: BillingWebhookEvent["status"];
  attempts: number;
  received_at: string;
  processed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function getBillingAdminSummary() {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    WITH current_subscriptions AS (
      SELECT DISTINCT ON (workspace_id)
        id,
        workspace_id,
        plan_id,
        billing_cycle,
        price_id,
        status,
        created_at,
        ended_at
      FROM billing_subscriptions
      WHERE status IN ('pending', 'active', 'past_due', 'scheduled_cancel', 'paused')
      ORDER BY workspace_id, created_at DESC
    ),
    priced_subscriptions AS (
      SELECT
        cs.*,
        COALESCE(bp.amount_cents, fallback_bp.amount_cents, 0) AS amount_cents
      FROM current_subscriptions cs
      LEFT JOIN billing_prices bp
        ON bp.id = cs.price_id
      LEFT JOIN LATERAL (
        SELECT amount_cents
        FROM billing_prices
        WHERE plan_id = cs.plan_id
          AND billing_cycle = cs.billing_cycle
          AND active_until IS NULL
        ORDER BY active_from DESC
        LIMIT 1
      ) fallback_bp ON TRUE
    ),
    subscription_metrics AS (
      SELECT
        COALESCE(SUM(
          CASE
            WHEN status IN ('active', 'past_due', 'scheduled_cancel') AND billing_cycle = 'monthly'
              THEN amount_cents
            WHEN status IN ('active', 'past_due', 'scheduled_cancel') AND billing_cycle = 'annual'
              THEN ROUND(amount_cents / 12.0)
            ELSE 0
          END
        ), 0) AS mrr_cents,
        COALESCE(SUM(
          CASE
            WHEN status IN ('active', 'past_due', 'scheduled_cancel') AND billing_cycle = 'monthly'
              THEN amount_cents * 12
            WHEN status IN ('active', 'past_due', 'scheduled_cancel') AND billing_cycle = 'annual'
              THEN amount_cents
            ELSE 0
          END
        ), 0) AS arr_cents,
        COUNT(*) FILTER (WHERE status = 'active') AS active_subscriptions,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_subscriptions,
        COUNT(*) FILTER (WHERE status = 'past_due') AS past_due_subscriptions,
        COUNT(*) FILTER (WHERE status = 'paused') AS paused_subscriptions,
        COUNT(*) FILTER (WHERE status = 'scheduled_cancel') AS scheduled_cancel_subscriptions,
        COUNT(*) FILTER (WHERE status = 'expired') AS expired_subscriptions,
        COUNT(*) FILTER (WHERE plan_id = 'starter') AS starter_subscriptions,
        COUNT(*) FILTER (WHERE plan_id = 'growth') AS growth_subscriptions,
        COUNT(*) FILTER (WHERE plan_id = 'scale') AS scale_subscriptions,
        COUNT(*) FILTER (WHERE billing_cycle = 'monthly') AS monthly_subscriptions,
        COUNT(*) FILTER (WHERE billing_cycle = 'annual') AS annual_subscriptions,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '30 days'
        ) AS new_subscriptions_last_30_days
      FROM priced_subscriptions
    ),
    cancellation_metrics AS (
      SELECT
        COUNT(*) FILTER (
          WHERE ended_at IS NOT NULL
            AND ended_at >= NOW() - INTERVAL '30 days'
            AND status IN ('canceled', 'expired')
        ) AS cancellations_last_30_days
      FROM billing_subscriptions
    ),
    invoice_metrics AS (
      SELECT
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS total_revenue_cents,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_payments,
        COUNT(*) FILTER (WHERE status IN ('failed', 'expired', 'canceled')) AS failed_payments,
        COUNT(*) FILTER (WHERE payment_method = 'pix_manual') AS pix_manual_payments,
        COUNT(*) FILTER (WHERE payment_method = 'pix_automatic') AS pix_automatic_payments,
        COUNT(*) FILTER (WHERE payment_method = 'card') AS card_payments
      FROM billing_invoices
    ),
    webhook_metrics AS (
      SELECT
        COUNT(*) FILTER (WHERE status = 'failed') AS failed_webhooks
      FROM billing_webhook_events
    )
    SELECT
      subscription_metrics.mrr_cents,
      subscription_metrics.arr_cents,
      invoice_metrics.total_revenue_cents,
      subscription_metrics.active_subscriptions,
      subscription_metrics.pending_subscriptions,
      subscription_metrics.past_due_subscriptions,
      subscription_metrics.paused_subscriptions,
      subscription_metrics.scheduled_cancel_subscriptions,
      subscription_metrics.expired_subscriptions,
      subscription_metrics.new_subscriptions_last_30_days,
      cancellation_metrics.cancellations_last_30_days,
      CASE
        WHEN subscription_metrics.active_subscriptions > 0
          THEN ROUND(
            (cancellation_metrics.cancellations_last_30_days::numeric / subscription_metrics.active_subscriptions::numeric) * 100,
            2
          )
        ELSE NULL
      END AS churn_rate_percent,
      invoice_metrics.pending_payments,
      invoice_metrics.failed_payments,
      webhook_metrics.failed_webhooks,
      webhook_metrics.failed_webhooks AS reconciliation_backlog,
      subscription_metrics.starter_subscriptions,
      subscription_metrics.growth_subscriptions,
      subscription_metrics.scale_subscriptions,
      subscription_metrics.monthly_subscriptions,
      subscription_metrics.annual_subscriptions,
      invoice_metrics.pix_manual_payments,
      invoice_metrics.pix_automatic_payments,
      invoice_metrics.card_payments
    FROM subscription_metrics, cancellation_metrics, invoice_metrics, webhook_metrics
  `) as BillingAdminSummaryRow[];

  return mapBillingAdminSummary(rows[0] ?? null);
}

export async function listBillingAdminWorkspaces(limit = 20) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    WITH current_subscriptions AS (
      SELECT DISTINCT ON (workspace_id)
        id,
        workspace_id,
        plan_id,
        billing_cycle,
        status,
        access_until,
        current_period_end
      FROM billing_subscriptions
      WHERE status IN ('pending', 'active', 'past_due', 'scheduled_cancel', 'paused')
      ORDER BY workspace_id, created_at DESC
    ),
    calculation_counts AS (
      SELECT workspace_id, COUNT(*)::int AS calculations_count
      FROM calculation_snapshots
      GROUP BY workspace_id
    )
    SELECT
      w.id AS workspace_id,
      w.name AS workspace_name,
      w.slug AS workspace_slug,
      owner.email AS owner_email,
      owner.full_name AS owner_full_name,
      cs.id AS current_subscription_id,
      cs.plan_id AS current_plan_id,
      cs.billing_cycle AS current_billing_cycle,
      cs.status AS current_status,
      cs.access_until,
      cs.current_period_end,
      COALESCE(cc.calculations_count, 0) AS calculations_count,
      w.created_at
    FROM workspaces w
    LEFT JOIN users owner
      ON owner.id = w.owner_user_id
    LEFT JOIN current_subscriptions cs
      ON cs.workspace_id = w.id
    LEFT JOIN calculation_counts cc
      ON cc.workspace_id = w.id
    ORDER BY w.created_at DESC
    LIMIT ${limit}
  `) as BillingAdminWorkspaceRow[];

  return rows.map(mapBillingAdminWorkspaceRow);
}

export async function listBillingAdminSubscriptions(limit = 20) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      bs.id AS subscription_id,
      bs.workspace_id,
      w.name AS workspace_name,
      w.slug AS workspace_slug,
      owner.email AS owner_email,
      bs.plan_id,
      bs.billing_cycle,
      bs.status,
      bs.auto_renew,
      bs.current_period_start,
      bs.current_period_end,
      bs.grace_period_ends_at,
      bs.access_until,
      bs.provider,
      bs.provider_subscription_id,
      bs.created_at,
      bs.updated_at
    FROM billing_subscriptions bs
    INNER JOIN workspaces w
      ON w.id = bs.workspace_id
    LEFT JOIN users owner
      ON owner.id = w.owner_user_id
    ORDER BY bs.created_at DESC
    LIMIT ${limit}
  `) as BillingAdminSubscriptionRow[];

  return rows.map(mapBillingAdminSubscriptionRow);
}

export async function getBillingAdminSubscriptionRecord(subscriptionId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      bs.id AS subscription_id,
      bs.workspace_id,
      w.name AS workspace_name,
      w.slug AS workspace_slug,
      owner.email AS owner_email,
      bs.plan_id,
      bs.billing_cycle,
      bs.status,
      bs.auto_renew,
      bs.current_period_start,
      bs.current_period_end,
      bs.grace_period_ends_at,
      bs.access_until,
      bs.provider,
      bs.provider_subscription_id,
      bs.created_at,
      bs.updated_at
    FROM billing_subscriptions bs
    INNER JOIN workspaces w
      ON w.id = bs.workspace_id
    LEFT JOIN users owner
      ON owner.id = w.owner_user_id
    WHERE bs.id = ${subscriptionId}
    LIMIT 1
  `) as BillingAdminSubscriptionRow[];

  return rows[0] ? mapBillingAdminSubscriptionRow(rows[0]) : null;
}

export async function listBillingAdminInvoices(limit = 20) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      bi.id AS invoice_id,
      bi.subscription_id,
      bi.workspace_id,
      w.name AS workspace_name,
      bs.plan_id,
      bs.billing_cycle,
      bi.type,
      bi.status,
      bi.amount_cents,
      bi.currency,
      bi.payment_method,
      bi.provider,
      bi.provider_payment_id,
      bi.provider_authorized_payment_id,
      bi.period_start,
      bi.period_end,
      bi.paid_at,
      bi.failed_at,
      bi.created_at,
      bi.updated_at
    FROM billing_invoices bi
    INNER JOIN workspaces w
      ON w.id = bi.workspace_id
    LEFT JOIN billing_subscriptions bs
      ON bs.id = bi.subscription_id
    ORDER BY bi.created_at DESC
    LIMIT ${limit}
  `) as BillingAdminInvoiceRow[];

  return rows.map(mapBillingAdminInvoiceRow);
}

export async function listBillingAdminInvoicesBySubscriptionId(
  subscriptionId: string,
  limit = 30,
) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      bi.id AS invoice_id,
      bi.subscription_id,
      bi.workspace_id,
      w.name AS workspace_name,
      bs.plan_id,
      bs.billing_cycle,
      bi.type,
      bi.status,
      bi.amount_cents,
      bi.currency,
      bi.payment_method,
      bi.provider,
      bi.provider_payment_id,
      bi.provider_authorized_payment_id,
      bi.period_start,
      bi.period_end,
      bi.paid_at,
      bi.failed_at,
      bi.created_at,
      bi.updated_at
    FROM billing_invoices bi
    INNER JOIN workspaces w
      ON w.id = bi.workspace_id
    LEFT JOIN billing_subscriptions bs
      ON bs.id = bi.subscription_id
    WHERE bi.subscription_id = ${subscriptionId}
    ORDER BY bi.created_at DESC
    LIMIT ${limit}
  `) as BillingAdminInvoiceRow[];

  return rows.map(mapBillingAdminInvoiceRow);
}

export async function listBillingAdminWebhookEvents(limit = 20) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      id,
      provider,
      provider_event_id,
      event_type,
      resource_id,
      payload_hash,
      status,
      attempts,
      received_at,
      processed_at,
      error_code,
      error_message,
      created_at,
      updated_at
    FROM billing_webhook_events
    ORDER BY received_at DESC
    LIMIT ${limit}
  `) as BillingWebhookEventRow[];

  return rows.map(mapBillingWebhookEventRow);
}

export async function listBillingAdminAuditEvents(limit = 20) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      bae.id,
      bae.workspace_id,
      w.name AS workspace_name,
      bae.subscription_id,
      bae.invoice_id,
      bae.actor_type,
      bae.actor_id,
      bae.action,
      bae.metadata,
      bae.created_at
    FROM billing_audit_events bae
    LEFT JOIN workspaces w
      ON w.id = bae.workspace_id
    ORDER BY bae.created_at DESC
    LIMIT ${limit}
  `) as BillingAdminAuditEventRow[];

  return rows.map(mapBillingAdminAuditEventRow);
}

export async function listBillingAdminAuditEventsBySubscriptionId(
  subscriptionId: string,
  limit = 40,
) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      bae.id,
      bae.workspace_id,
      w.name AS workspace_name,
      bae.subscription_id,
      bae.invoice_id,
      bae.actor_type,
      bae.actor_id,
      bae.action,
      bae.metadata,
      bae.created_at
    FROM billing_audit_events bae
    LEFT JOIN workspaces w
      ON w.id = bae.workspace_id
    WHERE bae.subscription_id = ${subscriptionId}
    ORDER BY bae.created_at DESC
    LIMIT ${limit}
  `) as BillingAdminAuditEventRow[];

  return rows.map(mapBillingAdminAuditEventRow);
}

function mapBillingAdminSummary(
  row: BillingAdminSummaryRow | null,
): BillingAdminSummary {
  if (!row) {
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

  return {
    mrrCents: row.mrr_cents ?? 0,
    arrCents: row.arr_cents ?? 0,
    totalRevenueCents: row.total_revenue_cents ?? 0,
    activeSubscriptions: row.active_subscriptions ?? 0,
    pendingSubscriptions: row.pending_subscriptions ?? 0,
    pastDueSubscriptions: row.past_due_subscriptions ?? 0,
    pausedSubscriptions: row.paused_subscriptions ?? 0,
    scheduledCancelSubscriptions: row.scheduled_cancel_subscriptions ?? 0,
    expiredSubscriptions: row.expired_subscriptions ?? 0,
    newSubscriptionsLast30Days: row.new_subscriptions_last_30_days ?? 0,
    cancellationsLast30Days: row.cancellations_last_30_days ?? 0,
    churnRatePercent: normalizeNullableNumber(row.churn_rate_percent),
    pendingPayments: row.pending_payments ?? 0,
    failedPayments: row.failed_payments ?? 0,
    failedWebhooks: row.failed_webhooks ?? 0,
    reconciliationBacklog: row.reconciliation_backlog ?? 0,
    starterSubscriptions: row.starter_subscriptions ?? 0,
    growthSubscriptions: row.growth_subscriptions ?? 0,
    scaleSubscriptions: row.scale_subscriptions ?? 0,
    monthlySubscriptions: row.monthly_subscriptions ?? 0,
    annualSubscriptions: row.annual_subscriptions ?? 0,
    pixManualPayments: row.pix_manual_payments ?? 0,
    pixAutomaticPayments: row.pix_automatic_payments ?? 0,
    cardPayments: row.card_payments ?? 0,
  };
}

function normalizeNullableNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const normalized = typeof value === "number" ? value : Number(value);

  return Number.isFinite(normalized) ? normalized : null;
}

function mapBillingAdminWorkspaceRow(
  row: BillingAdminWorkspaceRow,
): BillingAdminWorkspaceRecord {
  return {
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceSlug: row.workspace_slug,
    ownerEmail: row.owner_email,
    ownerFullName: row.owner_full_name,
    currentSubscriptionId: row.current_subscription_id,
    currentPlanId: row.current_plan_id,
    currentBillingCycle: row.current_billing_cycle,
    currentStatus: row.current_status,
    accessUntil: row.access_until,
    currentPeriodEnd: row.current_period_end,
    calculationsCount: row.calculations_count ?? 0,
    createdAt: row.created_at,
  };
}

function mapBillingAdminSubscriptionRow(
  row: BillingAdminSubscriptionRow,
): BillingAdminSubscriptionRecord {
  return {
    subscriptionId: row.subscription_id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    workspaceSlug: row.workspace_slug,
    ownerEmail: row.owner_email,
    planId: row.plan_id,
    billingCycle: row.billing_cycle,
    status: row.status,
    autoRenew: row.auto_renew,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    gracePeriodEndsAt: row.grace_period_ends_at,
    accessUntil: row.access_until,
    provider: row.provider,
    providerSubscriptionId: row.provider_subscription_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBillingAdminInvoiceRow(
  row: BillingAdminInvoiceRow,
): BillingAdminInvoiceRecord {
  return {
    invoiceId: row.invoice_id,
    subscriptionId: row.subscription_id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    planId: row.plan_id,
    billingCycle: row.billing_cycle,
    type: row.type,
    status: row.status,
    amountCents: row.amount_cents,
    currency: row.currency,
    paymentMethod: row.payment_method,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    providerAuthorizedPaymentId: row.provider_authorized_payment_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    paidAt: row.paid_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBillingAdminAuditEventRow(
  row: BillingAdminAuditEventRow,
): BillingAdminAuditEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    subscriptionId: row.subscription_id,
    invoiceId: row.invoice_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    action: row.action,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

function mapBillingWebhookEventRow(row: BillingWebhookEventRow): BillingWebhookEvent {
  return {
    id: row.id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    eventType: row.event_type,
    resourceId: row.resource_id,
    payloadHash: row.payload_hash,
    status: row.status,
    attempts: row.attempts,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
