import postgres from "postgres";

const MIGRATION_LOCK_KEY = 2_026_083_101;
const MIGRATION_ID_PATTERN = /^\d{4}-[a-z0-9][a-z0-9-]*$/;

export async function migrateDatabase({ databaseUrl, migrations }) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_REQUIRED");
  }

  assertMigrations(migrations);

  const sql = postgres(databaseUrl, {
    idle_timeout: 5,
    max: 1,
    onnotice: () => {},
  });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const applied = [];

    for (const migration of migrations) {
      const didApply = await sql.begin(async (transaction) => {
        await transaction`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`;

        const rows = await transaction`
          SELECT checksum
          FROM schema_migrations
          WHERE id = ${migration.id}
          LIMIT 1
        `;
        const existing = rows[0];

        if (existing) {
          if (existing.checksum !== migration.checksum) {
            throw new Error("MIGRATION_CHECKSUM_MISMATCH");
          }

          return false;
        }

        await migration.up(transaction);
        await transaction`
          INSERT INTO schema_migrations (id, checksum)
          VALUES (${migration.id}, ${migration.checksum})
        `;

        return true;
      });

      if (didApply) {
        applied.push(migration.id);
      }
    }

    return { applied };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function assertMigrations(migrations) {
  if (!Array.isArray(migrations)) {
    throw new Error("MIGRATIONS_REQUIRED");
  }

  let previousId = null;

  for (const migration of migrations) {
    if (
      !migration ||
      typeof migration.id !== "string" ||
      !MIGRATION_ID_PATTERN.test(migration.id) ||
      typeof migration.checksum !== "string" ||
      migration.checksum.length === 0 ||
      typeof migration.up !== "function"
    ) {
      throw new Error("MIGRATION_INVALID");
    }

    if (previousId && migration.id <= previousId) {
      throw new Error("MIGRATION_ORDER_INVALID");
    }

    previousId = migration.id;
  }
}
