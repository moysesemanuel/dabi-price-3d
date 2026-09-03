import "server-only";

import { getSql } from "@/lib/server/neon";
import { ensurePlatformReady } from "@/lib/server/platform";
import {
  fillDailyBuckets,
  type AdminAnalyticsPeriod,
  type AdminDashboardAnalytics,
} from "./admin-dashboard-analytics.ts";

type RevenueRow = { date: string; paid_invoice_count: number; paid_revenue_cents: number };
type InvoiceRow = { date: string; created: number; paid: number; pending: number; failed: number };
type WebhookRow = { date: string; processed: number; failed: number; ignored: number };
type SubscriptionRow = { date: string; count: number };
type DistributionRow = { dimension: "plan" | "billingCycle" | "status"; key: string; count: number };

export async function getAdminDashboardAnalytics(
  period: AdminAnalyticsPeriod,
): Promise<AdminDashboardAnalytics> {
  await ensurePlatformReady();
  const sql = getSql();
  const [revenueRows, invoiceRows, webhookRows, subscriptionRows, distributionRows] = await Promise.all([
    (async () => (await sql`
      SELECT TO_CHAR((paid_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS paid_invoice_count,
        COALESCE(SUM(amount_cents), 0)::int AS paid_revenue_cents
      FROM billing_invoices
      WHERE status = 'paid' AND paid_at >= ${period.start} AND paid_at < ${period.end}
      GROUP BY 1 ORDER BY 1
    `) as RevenueRow[])(),
    (async () => (await sql`
      SELECT date, SUM(created)::int AS created, SUM(paid)::int AS paid,
        SUM(pending)::int AS pending, SUM(failed)::int AS failed
      FROM (
        SELECT TO_CHAR((created_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS date,
          COUNT(*)::int AS created, 0::int AS paid, 0::int AS pending, 0::int AS failed
        FROM billing_invoices WHERE created_at >= ${period.start} AND created_at < ${period.end} GROUP BY 1
        UNION ALL
        SELECT TO_CHAR((paid_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD'), 0, COUNT(*)::int, 0, 0
        FROM billing_invoices WHERE status = 'paid' AND paid_at >= ${period.start} AND paid_at < ${period.end} GROUP BY 1
        UNION ALL
        SELECT TO_CHAR((created_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD'), 0, 0, COUNT(*)::int, 0
        FROM billing_invoices WHERE status = 'pending' AND created_at >= ${period.start} AND created_at < ${period.end} GROUP BY 1
        UNION ALL
        SELECT TO_CHAR((failed_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD'), 0, 0, 0, COUNT(*)::int
        FROM billing_invoices WHERE status = 'failed' AND failed_at >= ${period.start} AND failed_at < ${period.end} GROUP BY 1
      ) daily GROUP BY date ORDER BY date
    `) as InvoiceRow[])(),
    (async () => (await sql`
      SELECT TO_CHAR((received_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS date,
        COUNT(*) FILTER (WHERE status = 'processed')::int AS processed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status = 'ignored')::int AS ignored
      FROM billing_webhook_events
      WHERE received_at >= ${period.start} AND received_at < ${period.end}
      GROUP BY 1 ORDER BY 1
    `) as WebhookRow[])(),
    (async () => (await sql`
      SELECT TO_CHAR((first_paid_at AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM (
        SELECT DISTINCT ON (workspace_id) workspace_id, paid_at AS first_paid_at
        FROM billing_invoices
        WHERE type = 'subscription' AND status = 'paid' AND paid_at IS NOT NULL
        ORDER BY workspace_id, paid_at ASC
      ) initial_subscriptions
      WHERE first_paid_at >= ${period.start} AND first_paid_at < ${period.end}
      GROUP BY 1 ORDER BY 1
    `) as SubscriptionRow[])(),
    (async () => (await sql`
      WITH current_subscriptions AS (
        SELECT DISTINCT ON (workspace_id) plan_id, billing_cycle, status
        FROM billing_subscriptions ORDER BY workspace_id, created_at DESC
      )
      SELECT 'plan'::text AS dimension, plan_id AS key, COUNT(*)::int AS count FROM current_subscriptions GROUP BY plan_id
      UNION ALL
      SELECT 'billingCycle'::text, billing_cycle, COUNT(*)::int FROM current_subscriptions GROUP BY billing_cycle
      UNION ALL
      SELECT 'status'::text, status, COUNT(*)::int FROM current_subscriptions GROUP BY status
    `) as DistributionRow[])(),
  ]);

  let cumulativePaidRevenueCents = 0;
  const revenue = fillDailyBuckets(period, revenueRows.map((row) => ({
    date: row.date,
    paidInvoiceCount: Number(row.paid_invoice_count),
    paidRevenueCents: Number(row.paid_revenue_cents),
    cumulativePaidRevenueCents: 0,
  })), (date) => ({ date, paidInvoiceCount: 0, paidRevenueCents: 0, cumulativePaidRevenueCents: 0 })).map((row) => {
    cumulativePaidRevenueCents += row.paidRevenueCents;
    return { ...row, cumulativePaidRevenueCents };
  });

  return {
    period,
    revenue,
    invoices: fillDailyBuckets(period, invoiceRows.map((row) => ({ date: row.date, created: Number(row.created), paid: Number(row.paid), pending: Number(row.pending), failed: Number(row.failed) })), (date) => ({ date, created: 0, paid: 0, pending: 0, failed: 0 })),
    webhooks: fillDailyBuckets(period, webhookRows.map((row) => ({ date: row.date, processed: Number(row.processed), failed: Number(row.failed), ignored: Number(row.ignored) })), (date) => ({ date, processed: 0, failed: 0, ignored: 0 })),
    newPaidSubscriptions: fillDailyBuckets(period, subscriptionRows.map((row) => ({ date: row.date, count: Number(row.count) })), (date) => ({ date, count: 0 })),
    distributions: {
      plan: distributionRows.filter((row) => row.dimension === "plan").map(mapDistribution),
      billingCycle: distributionRows.filter((row) => row.dimension === "billingCycle").map(mapDistribution),
      status: distributionRows.filter((row) => row.dimension === "status").map(mapDistribution),
    },
  };
}

function mapDistribution(row: DistributionRow) {
  return { key: row.key, count: Number(row.count) };
}
