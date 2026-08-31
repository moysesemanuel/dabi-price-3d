import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { closeNeonPostgresShim } from "./support/neon-postgres-shim.mjs";

const testDatabaseUrl = resolveTestDatabaseUrl(process.env.TEST_DATABASE_URL);

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required and must point to an isolated PostgreSQL database.");
}

function resolveTestDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return databaseUrl;

  // PgBouncer can queue the second transaction before PostgreSQL observes it.
  // This suite verifies a database-level race, so Neon must use its direct endpoint.
  return databaseUrl.replace(/-pooler\.(?=[^.]+\.aws\.neon\.tech)/, ".");
}

process.env.NODE_ENV = "test";
process.env.TEST_DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_URL = testDatabaseUrl;

const platform = await import("../src/lib/server/platform.ts");
const repository = await import("../src/lib/billing/repository.ts");
const sql = postgres(testDatabaseUrl, { idle_timeout: 1, max: 6 });
const INVOICE_INSERT_LOCK_KEY = 741_012;

async function waitForBlockedInserts(minimum) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const rows = await sql`
      SELECT COUNT(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'active'
        AND query ILIKE '%billing_invoices%'
    `;

    if (Number(rows[0]?.count ?? 0) >= minimum) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Timed out waiting for concurrent billing invoice inserts.");
}

async function createFixture() {
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const subscriptionId = randomUUID();
  const priceId = randomUUID();
  const suffix = randomUUID();

  await sql`
    INSERT INTO users (id, email, password_hash, full_name, platform_role, status, created_at, updated_at)
    VALUES (${userId}, ${`billing-recovery-${suffix}@example.test`}, 'not-used', 'Billing recovery', 'user', 'active', NOW(), NOW())
  `;
  await sql`
    INSERT INTO workspaces (id, name, slug, owner_user_id, business_mode, status, created_at, updated_at)
    VALUES (${workspaceId}, ${`Billing recovery ${suffix}`}, ${`billing-recovery-${suffix}`}, ${userId}, '3d', 'active', NOW(), NOW())
  `;
  await sql`
    INSERT INTO billing_prices (id, plan_id, billing_cycle, amount_cents, currency, active_from, created_at, updated_at)
    VALUES (${priceId}, 'starter', 'monthly', 4900, 'BRL', NOW() - INTERVAL '1 day', NOW(), NOW())
  `;
  await sql`
    INSERT INTO billing_subscriptions (id, workspace_id, plan_id, billing_cycle, price_id, status, auto_renew, provider, provider_subscription_id, created_at, updated_at)
    VALUES (${subscriptionId}, ${workspaceId}, 'starter', 'monthly', ${priceId}, 'pending', true, 'mercado_pago', ${`mp-${suffix}`}, NOW(), NOW())
  `;

  return { userId, workspaceId, subscriptionId, priceId };
}

async function cleanupFixture(fixture) {
  await sql`DELETE FROM workspaces WHERE id = ${fixture.workspaceId}`;
  await sql`DELETE FROM users WHERE id = ${fixture.userId}`;
}

async function installInsertGate() {
  await sql`
    CREATE OR REPLACE FUNCTION billing_recovery_block_invoice_insert()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(741012);
      RETURN NEW;
    END;
    $$
  `;
  await sql`
    CREATE TRIGGER billing_recovery_block_invoice_insert
    BEFORE INSERT ON billing_invoices
    FOR EACH ROW EXECUTE FUNCTION billing_recovery_block_invoice_insert()
  `;
}

async function removeInsertGate() {
  await sql`DROP TRIGGER IF EXISTS billing_recovery_block_invoice_insert ON billing_invoices`;
  await sql`DROP FUNCTION IF EXISTS billing_recovery_block_invoice_insert()`;
}

test.before(async () => {
  await platform.ensurePlatformReady();
});

test.after(async () => {
  await sql.end({ timeout: 1 });
  await closeNeonPostgresShim();
});

test("PostgreSQL cria billing price sem conflito de identificador de pagamento", async () => {
  const activeFrom = "2026-08-29T00:00:00.000Z";
  const price = await repository.createBillingPrice({
    planId: "starter",
    billingCycle: "monthly",
    amountCents: 4900,
    currency: "BRL",
    activeFrom,
  });

  try {
    assert.ok(price);
    assert.equal(price.planId, "starter");
    assert.equal(price.billingCycle, "monthly");
    assert.equal(price.amountCents, 4900);
  } finally {
    if (price) await sql`DELETE FROM billing_prices WHERE id = ${price.id}`;
  }
});

test("PostgreSQL materializa uma única invoice sob recovery concorrente", async () => {
  const fixture = await createFixture();
  await installInsertGate();
  await sql`SELECT pg_advisory_lock(${INVOICE_INSERT_LOCK_KEY})`;
  let lockHeld = true;

  const input = {
    subscriptionId: fixture.subscriptionId,
    workspaceId: fixture.workspaceId,
    priceId: fixture.priceId,
    type: "subscription",
    status: "pending",
    amountCents: 4900,
    currency: "BRL",
    periodStart: "2026-08-29T00:00:00.000Z",
    periodEnd: "2026-09-29T00:00:00.000Z",
    paymentMethod: "card",
    provider: "mercado_pago",
    providerPaymentId: "payment-concurrent-recovery",
    providerAuthorizedPaymentId: "authorized-concurrent-recovery",
  };

  try {
    const first = repository.createBillingInvoice(input);
    await waitForBlockedInserts(1);
    const second = repository.createBillingInvoice(input);
    await waitForBlockedInserts(2);
    await sql`SELECT pg_advisory_unlock(${INVOICE_INSERT_LOCK_KEY})`;
    lockHeld = false;

    const [firstInvoice, secondInvoice] = await Promise.all([first, second]);
    assert.equal([firstInvoice, secondInvoice].filter(Boolean).length, 1);

    const invoices = await sql`
      SELECT id, provider_payment_id, provider_authorized_payment_id
      FROM billing_invoices
      WHERE subscription_id = ${fixture.subscriptionId}
    `;
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0]?.provider_payment_id, input.providerPaymentId);
    assert.equal(invoices[0]?.provider_authorized_payment_id, input.providerAuthorizedPaymentId);
  } finally {
    if (lockHeld) await sql`SELECT pg_advisory_unlock(${INVOICE_INSERT_LOCK_KEY})`;
    await removeInsertGate();
    await cleanupFixture(fixture);
  }
});
