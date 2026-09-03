import { platformMigrations } from "../database/migrations/index.mjs";
import { migrateDatabase } from "../database/migrations/runner.mjs";

const result = await migrateDatabase({
  databaseUrl: process.env.DATABASE_URL,
  migrations: platformMigrations,
});

console.log(
  result.applied.length === 0
    ? "Database is already up to date."
    : `Applied migrations: ${result.applied.join(", ")}`,
);
