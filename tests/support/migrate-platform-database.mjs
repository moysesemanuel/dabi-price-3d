import { migrateDatabase } from "../../database/migrations/runner.mjs";
import platformSchemaMigration from "../../database/migrations/0001-platform-schema.mjs";

export async function migratePlatformDatabase(databaseUrl) {
  return migrateDatabase({
    databaseUrl,
    migrations: [platformSchemaMigration],
  });
}
