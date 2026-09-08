import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required and must point to an isolated PostgreSQL database.",
  );
}

const { migrateDatabase } = await import("../database/migrations/runner.mjs");
const platformSchemaMigration = (
  await import("../database/migrations/0001-platform-schema.mjs")
).default;
const { platformMigrations } = await import("../database/migrations/index.mjs");
const { bootstrapPlatformAdmin } = await import(
  "../database/bootstrap-admin.mjs"
);
const sql = postgres(testDatabaseUrl, {
  idle_timeout: 1,
  max: 1,
  onnotice: () => {},
});

async function resetSchema() {
  await sql.unsafe("DROP SCHEMA public CASCADE");
  await sql.unsafe("CREATE SCHEMA public");
}

async function appliedMigrationIds() {
  const rows = await sql`
    SELECT id
    FROM schema_migrations
    ORDER BY id ASC
  `;

  return rows.map((row) => row.id);
}

test.beforeEach(async () => {
  await resetSchema();
});

test.after(async () => {
  await sql.end({ timeout: 1 });
});

test("aplica cada migracao uma unica vez", async () => {
  const migrations = [
    {
      id: "0001-test-ledger",
      checksum: "first-checksum",
      async up(transaction) {
        await transaction`CREATE TABLE application_records (id TEXT PRIMARY KEY)`;
      },
    },
  ];

  const first = await migrateDatabase({
    databaseUrl: testDatabaseUrl,
    migrations,
  });
  const second = await migrateDatabase({
    databaseUrl: testDatabaseUrl,
    migrations,
  });

  assert.deepEqual(first.applied, ["0001-test-ledger"]);
  assert.deepEqual(second.applied, []);
  assert.deepEqual(await appliedMigrationIds(), ["0001-test-ledger"]);
});

test("catalogo oficial expoe migracoes em ordem, sem repetir id", () => {
  const ids = platformMigrations.map((migration) => migration.id);

  // A lista fixa exigia editar este teste a cada migracao nova, e o que
  // importa nao e quais existem, e sim que estejam em ordem crescente e sem
  // id repetido: o runner aplica na ordem do catalogo.
  assert.ok(ids.length > 0);
  assert.deepEqual(ids, [...ids].sort());
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[0], "0001-platform-schema");

  for (const id of ids) {
    assert.match(id, /^\d{4}-[a-z0-9][a-z0-9-]*$/);
  }
});

test("recusa checksum alterado para migracao ja aplicada", async () => {
  await migrateDatabase({
    databaseUrl: testDatabaseUrl,
    migrations: [
      {
        id: "0001-test-ledger",
        checksum: "original-checksum",
        async up() {},
      },
    ],
  });

  await assert.rejects(
    migrateDatabase({
      databaseUrl: testDatabaseUrl,
      migrations: [
        {
          id: "0001-test-ledger",
          checksum: "changed-checksum",
          async up() {},
        },
      ],
    }),
    /MIGRATION_CHECKSUM_MISMATCH/,
  );
});

test("cria o schema de plataforma e os quatro precos comerciais", async () => {
  await migrateDatabase({
    databaseUrl: testDatabaseUrl,
    migrations: [platformSchemaMigration],
  });

  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  const names = new Set(tables.map((row) => row.table_name));

  for (const table of [
    "users",
    "workspaces",
    "workspace_memberships",
    "user_sessions",
    "billing_prices",
    "billing_subscriptions",
    "billing_invoices",
    "billing_invoice_effect_claims",
    "billing_subscription_operation_claims",
  ]) {
    assert.equal(names.has(table), true);
  }

  const prices = await sql`
    SELECT plan_id, billing_cycle, amount_cents
    FROM billing_prices
    WHERE active_until IS NULL
    ORDER BY plan_id, billing_cycle
  `;
  assert.deepEqual(Array.from(prices), [
    { plan_id: "growth", billing_cycle: "annual", amount_cents: 79900 },
    { plan_id: "growth", billing_cycle: "monthly", amount_cents: 7900 },
    { plan_id: "starter", billing_cycle: "annual", amount_cents: 49000 },
    { plan_id: "starter", billing_cycle: "monthly", amount_cents: 4900 },
  ]);
});

test("cria o primeiro super admin somente em banco sem usuarios", async () => {
  await migrateDatabase({
    databaseUrl: testDatabaseUrl,
    migrations: platformMigrations,
  });

  const input = {
    email: "admin@example.test",
    // Gerada a cada execucao: um literal com cara de senha aqui dispara o
    // scanner de segredos da PR, e nao ha motivo para o valor ser fixo.
    password: randomUUID(),
    fullName: "Admin de teste",
    workspaceName: "Workspace de teste",
  };
  const first = await bootstrapPlatformAdmin({
    databaseUrl: testDatabaseUrl,
    ...input,
  });
  const second = await bootstrapPlatformAdmin({
    databaseUrl: testDatabaseUrl,
    ...input,
  });

  assert.equal(first.created, true);
  assert.equal(second.created, false);

  const users = await sql`
    SELECT email, platform_role, status
    FROM users
  `;
  assert.deepEqual(Array.from(users), [
    {
      email: "admin@example.test",
      platform_role: "super_admin",
      status: "active",
    },
  ]);
});

test("nao registra uma migracao cuja transacao falha", async () => {
  await assert.rejects(
    migrateDatabase({
      databaseUrl: testDatabaseUrl,
      migrations: [
        {
          id: "0001-test-failure",
          checksum: "failure-checksum",
          async up(transaction) {
            await transaction`SELECT 1 / 0`;
          },
        },
      ],
    }),
  );

  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'schema_migrations'
  `;

  if (rows.length > 0) {
    assert.deepEqual(await appliedMigrationIds(), []);
  }
});
