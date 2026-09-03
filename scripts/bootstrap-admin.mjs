import { bootstrapPlatformAdmin } from "../database/bootstrap-admin.mjs";

const result = await bootstrapPlatformAdmin({
  databaseUrl: process.env.DATABASE_URL,
  email: process.env.BOOTSTRAP_ADMIN_EMAIL,
  password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
  fullName: process.env.BOOTSTRAP_ADMIN_NAME ?? "Administrador DaBi",
  workspaceName: process.env.BOOTSTRAP_WORKSPACE_NAME ?? "Dabi Tech 3D",
});

console.log(
  result.created
    ? "Initial super admin created."
    : "Bootstrap skipped because the database already has users.",
);
