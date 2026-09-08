import assert from "node:assert/strict";
import test from "node:test";
import { migrateDatabase } from "../database/migrations/runner.mjs";
import platformSchemaMigration from "../database/migrations/0001-platform-schema.mjs";
import {
  clearRecordedQueries,
  recordedQueries,
} from "./support/neon-postgres-shim.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required and must point to an isolated PostgreSQL database.",
  );
}

process.env.DATABASE_URL = testDatabaseUrl;

const { ensurePlatformReady, getAuthenticatedSessionByToken } = await import(
  "../src/lib/server/platform.ts"
);

test.before(async () => {
  await migrateDatabase({
    databaseUrl: testDatabaseUrl,
    migrations: [platformSchemaMigration],
  });
});

test("sessao em banco migrado nao executa DDL", async () => {
  clearRecordedQueries();

  await ensurePlatformReady();
  await getAuthenticatedSessionByToken("missing-session-token");

  const ddl = recordedQueries().filter((query) =>
    /^(CREATE|ALTER|DROP)\s/i.test(query.trim()),
  );

  assert.deepEqual(ddl, []);
});
