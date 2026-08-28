import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { closeNeonPostgresShim } from "./support/neon-postgres-shim.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is required and must point to an isolated PostgreSQL database.");
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl;

const platform = await import("../src/lib/server/platform.ts");
const { hashPassword } = await import("../src/lib/auth/password.ts");
const {
  deletePlatformUser,
  ensurePlatformReady,
  findPlatformUserById,
  listPlatformUserMemberships,
  revokePlatformUserSessions,
  updatePlatformUserStatus,
} = platform;
const sql = postgres(testDatabaseUrl, { idle_timeout: 1, max: 4 });

async function createUser({ role = "user", status = "active" } = {}) {
  const id = randomUUID();
  const suffix = randomUUID();
  await sql`
    INSERT INTO users (id, email, password_hash, full_name, platform_role, status, created_at, updated_at)
    VALUES (${id}, ${`admin-users-${suffix}@example.test`}, ${await hashPassword(`Password-${suffix}`)},
      'Admin user integration', ${role}, ${status}, NOW(), NOW())
  `;
  return id;
}

async function createWorkspaceMembership(userId) {
  const workspaceId = randomUUID();
  await sql`
    INSERT INTO workspaces (id, name, slug, owner_user_id, business_mode, status, created_at, updated_at)
    VALUES (${workspaceId}, ${`admin-users-${workspaceId}`}, ${`admin-users-${workspaceId}`}, ${userId}, '3d', 'active', NOW(), NOW())
  `;
  await sql`
    INSERT INTO workspace_memberships (id, workspace_id, user_id, workspace_role, invited_by_user_id, created_at)
    VALUES (${randomUUID()}, ${workspaceId}, ${userId}, 'owner', ${userId}, NOW())
  `;
  return workspaceId;
}

async function createSessions(userId, workspaceId, count = 2) {
  for (let index = 0; index < count; index += 1) {
    await sql`
      INSERT INTO user_sessions (id, user_id, workspace_id, token_hash, expires_at, created_at, last_seen_at)
      VALUES (${randomUUID()}, ${userId}, ${workspaceId}, ${`admin-users-token-${randomUUID()}`}, NOW() + INTERVAL '1 day', NOW(), NOW())
    `;
  }
}

async function sessionCount(userId) {
  const [row] = await sql`SELECT COUNT(*)::int AS count FROM user_sessions WHERE user_id = ${userId}`;
  return Number(row?.count ?? 0);
}

async function cleanup({ users = [], workspaces = [] }) {
  for (const workspaceId of workspaces) await sql`DELETE FROM workspaces WHERE id = ${workspaceId}`;
  for (const userId of users) await sql`DELETE FROM users WHERE id = ${userId}`;
}

test.before(async () => {
  await ensurePlatformReady();
});

test.after(async () => {
  await sql.end({ timeout: 1 });
  await closeNeonPostgresShim();
});

test("PostgreSQL protege a ultima conta super admin contra desativacao e exclusao", async () => {
  const existingSuperAdmins = await sql`
    SELECT id
    FROM users
    WHERE platform_role = 'super_admin'
  `;
  for (const admin of existingSuperAdmins) {
    await sql`UPDATE users SET platform_role = 'user' WHERE id = ${admin.id}`;
  }
  const userId = await createUser({ role: "super_admin" });
  try {
    await assert.rejects(updatePlatformUserStatus({ userId, status: "disabled" }), /LAST_SUPER_ADMIN_PROTECTED/);
    await assert.rejects(deletePlatformUser({ userId }), /LAST_SUPER_ADMIN_PROTECTED/);
    const user = await findPlatformUserById(userId);
    assert.equal(user?.platformRole, "super_admin");
    assert.equal(user?.userStatus, "active");
  } finally {
    await cleanup({ users: [userId] });
    for (const admin of existingSuperAdmins) {
      await sql`UPDATE users SET platform_role = 'super_admin' WHERE id = ${admin.id}`;
    }
  }
});

test("PostgreSQL permite desativar um de dois super admins", async () => {
  const firstUserId = await createUser({ role: "super_admin" });
  const secondUserId = await createUser({ role: "super_admin" });
  try {
    const updated = await updatePlatformUserStatus({ userId: firstUserId, status: "disabled" });
    assert.equal(updated?.userStatus, "disabled");
    assert.equal((await findPlatformUserById(secondUserId))?.userStatus, "active");
  } finally {
    await cleanup({ users: [firstUserId, secondUserId] });
  }
});

test("PostgreSQL desativar usuario revoga todas as sessoes", async () => {
  const userId = await createUser();
  const workspaceId = await createWorkspaceMembership(userId);
  try {
    await createSessions(userId, workspaceId);
    assert.equal(await sessionCount(userId), 2);
    const updated = await updatePlatformUserStatus({ userId, status: "disabled" });
    assert.equal(updated?.userStatus, "disabled");
    assert.equal(await sessionCount(userId), 0);
  } finally {
    await cleanup({ users: [userId], workspaces: [workspaceId] });
  }
});

test("PostgreSQL revoga sessoes explicitamente e preserva o usuario", async () => {
  const userId = await createUser();
  const workspaceId = await createWorkspaceMembership(userId);
  try {
    await createSessions(userId, workspaceId);
    assert.equal(await revokePlatformUserSessions(userId), 2);
    assert.equal(await sessionCount(userId), 0);
    assert.equal((await findPlatformUserById(userId))?.userStatus, "active");
  } finally {
    await cleanup({ users: [userId], workspaces: [workspaceId] });
  }
});

test("PostgreSQL retorna memberships do usuario com workspace e role", async () => {
  const userId = await createUser();
  const workspaceId = await createWorkspaceMembership(userId);
  try {
    const memberships = await listPlatformUserMemberships(userId);
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0]?.workspaceId, workspaceId);
    assert.equal(memberships[0]?.workspaceRole, "owner");
    assert.equal(memberships[0]?.userStatus, "active");
  } finally {
    await cleanup({ users: [userId], workspaces: [workspaceId] });
  }
});
