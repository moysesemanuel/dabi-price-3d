import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { closeNeonPostgresShim } from "./support/neon-postgres-shim.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required and must be isolated.");
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl;

const { ensurePlatformReady } = await import("../src/lib/server/platform.ts");
const { getAdminDashboardAnalytics } = await import("../src/lib/billing/admin-dashboard-analytics-repository.ts");
const { resolveAdminAnalyticsPeriod } = await import("../src/lib/billing/admin-dashboard-analytics.ts");
const { hashPassword } = await import("../src/lib/auth/password.ts");
const sql = postgres(testDatabaseUrl, { idle_timeout: 1, max: 4 });

async function createWorkspace(label) {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const suffix = randomUUID();
  await sql`INSERT INTO users (id, email, password_hash, full_name, platform_role, status, created_at, updated_at)
    VALUES (${userId}, ${`${label}-${suffix}@example.test`}, ${await hashPassword(`Password-${suffix}`)}, 'Analytics user', 'user', 'active', NOW(), NOW())`;
  await sql`INSERT INTO workspaces (id, name, slug, owner_user_id, business_mode, status, created_at, updated_at)
    VALUES (${workspaceId}, ${label}, ${`${label}-${suffix}`}, ${userId}, '3d', 'active', NOW(), NOW())`;
  await sql`INSERT INTO workspace_memberships (id, workspace_id, user_id, workspace_role, invited_by_user_id, created_at)
    VALUES (${randomUUID()}, ${workspaceId}, ${userId}, 'owner', ${userId}, NOW())`;
  return { userId, workspaceId };
}

async function createSubscription(workspaceId, { plan = "starter", cycle = "monthly", status = "active", createdAt = "2030-08-20T12:00:00Z" } = {}) {
  const id = randomUUID();
  await sql`INSERT INTO billing_subscriptions (id, workspace_id, plan_id, billing_cycle, status, auto_renew, created_at, updated_at)
    VALUES (${id}, ${workspaceId}, ${plan}, ${cycle}, ${status}, false, ${createdAt}, ${createdAt})`;
  return id;
}

async function createInvoice(subscriptionId, workspaceId, input) {
  await sql`INSERT INTO billing_invoices (id, subscription_id, workspace_id, type, status, amount_cents, currency, paid_at, failed_at, created_at, updated_at)
    VALUES (${randomUUID()}, ${subscriptionId}, ${workspaceId}, ${input.type ?? "subscription"}, ${input.status}, ${input.amountCents ?? 0}, 'BRL', ${input.paidAt ?? null}, ${input.failedAt ?? null}, ${input.createdAt}, ${input.createdAt})`;
}

async function createWebhook(status, receivedAt) {
  const id = randomUUID();
  await sql`INSERT INTO billing_webhook_events (id, provider, provider_event_id, event_type, payload_hash, status, received_at, created_at, updated_at)
    VALUES (${id}, 'mercado_pago', ${randomUUID()}, 'analytics_fixture', ${randomUUID()}, ${status}, ${receivedAt}, ${receivedAt}, ${receivedAt})`;
  return id;
}

async function cleanup(records) {
  for (const webhookId of records.webhooks) await sql`DELETE FROM billing_webhook_events WHERE id = ${webhookId}`;
  for (const workspaceId of records.workspaces) await sql`DELETE FROM workspaces WHERE id = ${workspaceId}`;
  for (const userId of records.users) await sql`DELETE FROM users WHERE id = ${userId}`;
}

test.before(async () => {
  await ensurePlatformReady();
  await sql`DELETE FROM billing_webhook_events WHERE event_type = 'analytics_fixture'`;
  await sql`
    DELETE FROM billing_webhook_events
    WHERE received_at >= '2030-08-22T03:00:00Z'
      AND received_at < '2030-08-29T03:00:00Z'
  `;
});
test.after(async () => { await sql.end({ timeout: 1 }); await closeNeonPostgresShim(); });

test("PostgreSQL agrega analytics diarios no timezone de Sao Paulo", async () => {
  const records = { workspaces: [], users: [], webhooks: [] };
  const first = await createWorkspace("analytics-first");
  const second = await createWorkspace("analytics-second");
  const third = await createWorkspace("analytics-third");
  const fourth = await createWorkspace("analytics-fourth");
  for (const record of [first, second, third, fourth]) { records.workspaces.push(record.workspaceId); records.users.push(record.userId); }
  try {
    const firstSubscription = await createSubscription(first.workspaceId, { plan: "starter", cycle: "monthly", status: "active" });
    const secondSubscription = await createSubscription(second.workspaceId, { plan: "starter", cycle: "monthly", status: "pending" });
    const thirdSubscription = await createSubscription(third.workspaceId, { plan: "growth", cycle: "monthly", status: "past_due" });
    const fourthSubscription = await createSubscription(fourth.workspaceId, { plan: "scale", cycle: "annual", status: "paused" });
    await createInvoice(firstSubscription, first.workspaceId, { status: "paid", amountCents: 10000, paidAt: "2030-08-28T02:30:00Z", createdAt: "2030-08-27T10:00:00Z" });
    await createInvoice(firstSubscription, first.workspaceId, { type: "renewal", status: "paid", amountCents: 2500, paidAt: "2030-08-28T02:45:00Z", createdAt: "2030-08-27T11:00:00Z" });
    await createInvoice(secondSubscription, second.workspaceId, { status: "paid", amountCents: 3000, paidAt: "2030-08-28T03:15:00Z", createdAt: "2030-08-28T03:15:00Z" });
    await createInvoice(secondSubscription, second.workspaceId, { status: "pending", amountCents: 4900, createdAt: "2030-08-28T15:00:00Z" });
    await createInvoice(thirdSubscription, third.workspaceId, { status: "failed", amountCents: 4900, failedAt: "2030-08-28T03:20:00Z", createdAt: "2030-08-27T12:00:00Z" });
    await createInvoice(fourthSubscription, fourth.workspaceId, { status: "paid", amountCents: 9999, paidAt: "2030-08-20T15:00:00Z", createdAt: "2030-08-20T15:00:00Z" });
    records.webhooks.push(await createWebhook("processed", "2030-08-28T02:30:00Z"));
    records.webhooks.push(await createWebhook("failed", "2030-08-28T02:40:00Z"));
    records.webhooks.push(await createWebhook("ignored", "2030-08-28T03:10:00Z"));

    const analytics = await getAdminDashboardAnalytics(resolveAdminAnalyticsPeriod("7d", new Date("2030-08-28T15:00:00Z")));
    const august27 = analytics.revenue.find((row) => row.date === "2030-08-27");
    const august28 = analytics.revenue.find((row) => row.date === "2030-08-28");
    const august26 = analytics.revenue.find((row) => row.date === "2030-08-26");
    assert.deepEqual(august27, { date: "2030-08-27", paidInvoiceCount: 2, paidRevenueCents: 12500, cumulativePaidRevenueCents: 12500 });
    assert.deepEqual(august28, { date: "2030-08-28", paidInvoiceCount: 1, paidRevenueCents: 3000, cumulativePaidRevenueCents: 15500 });
    assert.deepEqual(august26, { date: "2030-08-26", paidInvoiceCount: 0, paidRevenueCents: 0, cumulativePaidRevenueCents: 0 });
    assert.deepEqual(analytics.invoices.find((row) => row.date === "2030-08-27"), { date: "2030-08-27", created: 3, paid: 2, pending: 0, failed: 0 });
    assert.deepEqual(analytics.invoices.find((row) => row.date === "2030-08-28"), { date: "2030-08-28", created: 2, paid: 1, pending: 1, failed: 1 });
    assert.deepEqual(analytics.webhooks.find((row) => row.date === "2030-08-27"), { date: "2030-08-27", processed: 1, failed: 1, ignored: 0 });
    assert.deepEqual(analytics.webhooks.find((row) => row.date === "2030-08-28"), { date: "2030-08-28", processed: 0, failed: 0, ignored: 1 });
    assert.deepEqual(analytics.newPaidSubscriptions.find((row) => row.date === "2030-08-27"), { date: "2030-08-27", count: 1 });
    assert.deepEqual(analytics.newPaidSubscriptions.find((row) => row.date === "2030-08-28"), { date: "2030-08-28", count: 1 });
    assert.deepEqual(analytics.distributions.plan.sort((a, b) => a.key.localeCompare(b.key)), [{ key: "growth", count: 1 }, { key: "scale", count: 1 }, { key: "starter", count: 2 }]);
    assert.deepEqual(analytics.distributions.billingCycle.sort((a, b) => a.key.localeCompare(b.key)), [{ key: "annual", count: 1 }, { key: "monthly", count: 3 }]);
    assert.deepEqual(analytics.distributions.status.sort((a, b) => a.key.localeCompare(b.key)), [{ key: "active", count: 1 }, { key: "past_due", count: 1 }, { key: "paused", count: 1 }, { key: "pending", count: 1 }]);
  } finally { await cleanup(records); }
});
