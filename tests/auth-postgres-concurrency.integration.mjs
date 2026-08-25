import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { closeNeonPostgresShim } from "./support/neon-postgres-shim.mjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    "TEST_DATABASE_URL is required. Use an isolated PostgreSQL database; never use DATABASE_URL from production.",
  );
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl;

const [platformModule, passwordModule] = await Promise.all([
  import("../src/lib/server/platform.ts"),
  import("../src/lib/auth/password.ts"),
]);

const {
  consumePasswordResetToken,
  ensurePlatformReady,
  findUserById,
  inviteWorkspaceMember,
  issuePasswordResetToken,
} = platformModule;
const { hashPassword, verifyPassword } = passwordModule;
const controlSql = postgres(testDatabaseUrl, { idle_timeout: 1, max: 4 });

const RESET_LOCK_KEY = 741_010;
const SEAT_LOCK_KEY = 741_011;

async function waitForBlockedQueries(fragment, minimum) {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const rows = await controlSql`
      SELECT COUNT(*)::int AS count
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state = 'active'
        AND query ILIKE ${`%${fragment}%`}
    `;

    if (Number(rows[0]?.count ?? 0) >= minimum) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    `Timed out waiting for ${minimum} overlapping PostgreSQL operation(s) containing ${fragment}.`,
  );
}

async function createWorkspace(prefix) {
  const suffix = randomUUID();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const email = `${prefix}-owner-${suffix}@example.test`;

  await controlSql`
    INSERT INTO users (
      id, email, password_hash, full_name, platform_role, status, created_at, updated_at
    )
    VALUES (
      ${userId},
      ${email},
      ${await hashPassword(`Owner-${suffix}`)},
      'Integration Test Owner',
      'user',
      'active',
      NOW(),
      NOW()
    )
  `;
  await controlSql`
    INSERT INTO workspaces (
      id, name, slug, owner_user_id, business_mode, status, created_at, updated_at
    )
    VALUES (
      ${workspaceId},
      ${`${prefix}-${suffix}`},
      ${`${prefix}-${suffix}`},
      ${userId},
      '3d',
      'active',
      NOW(),
      NOW()
    )
  `;
  await controlSql`
    INSERT INTO workspace_memberships (
      id, workspace_id, user_id, workspace_role, invited_by_user_id, created_at
    )
    VALUES (${randomUUID()}, ${workspaceId}, ${userId}, 'owner', ${userId}, NOW())
  `;

  return { email, userId, workspaceId };
}

async function cleanupWorkspace(workspaceId) {
  const users = await controlSql`
    SELECT user_id
    FROM workspace_memberships
    WHERE workspace_id = ${workspaceId}
  `;

  await controlSql`
    DELETE FROM workspaces
    WHERE id = ${workspaceId}
  `;

  for (const user of users) {
    await controlSql`
      DELETE FROM users
      WHERE id = ${user.user_id}
    `;
  }
}

async function installResetGate() {
  await controlSql`
    CREATE OR REPLACE FUNCTION auth_concurrency_block_reset_consume()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(741010);
      RETURN NEW;
    END;
    $$
  `;
  await controlSql`
    CREATE TRIGGER auth_concurrency_block_reset_consume
    BEFORE UPDATE OF consumed_at ON password_reset_tokens
    FOR EACH ROW
    WHEN (OLD.consumed_at IS NULL AND NEW.consumed_at IS NOT NULL)
    EXECUTE FUNCTION auth_concurrency_block_reset_consume()
  `;
}

async function removeResetGate() {
  await controlSql`
    DROP TRIGGER IF EXISTS auth_concurrency_block_reset_consume
    ON password_reset_tokens
  `;
  await controlSql`
    DROP FUNCTION IF EXISTS auth_concurrency_block_reset_consume()
  `;
}

async function installSeatGate() {
  await controlSql`
    CREATE OR REPLACE FUNCTION auth_concurrency_block_membership_insert()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(741011);
      RETURN NEW;
    END;
    $$
  `;
  await controlSql`
    CREATE TRIGGER auth_concurrency_block_membership_insert
    BEFORE INSERT ON workspace_memberships
    FOR EACH ROW
    EXECUTE FUNCTION auth_concurrency_block_membership_insert()
  `;
}

async function removeSeatGate() {
  await controlSql`
    DROP TRIGGER IF EXISTS auth_concurrency_block_membership_insert
    ON workspace_memberships
  `;
  await controlSql`
    DROP FUNCTION IF EXISTS auth_concurrency_block_membership_insert()
  `;
}

async function unlock(key) {
  await controlSql`SELECT pg_advisory_unlock(${key})`;
}

test.before(async () => {
  await ensurePlatformReady();
});

test.after(async () => {
  await controlSql.end({ timeout: 1 });
  await closeNeonPostgresShim();
});

test("PostgreSQL consume atomicamente um unico reset concorrente", async () => {
  const workspace = await createWorkspace("reset-concurrency");
  const issuedToken = await issuePasswordResetToken(workspace.email);
  assert.ok(issuedToken);

  const [firstHash, secondHash] = await Promise.all([
    hashPassword("First-reset-password"),
    hashPassword("Second-reset-password"),
  ]);

  await controlSql`
    INSERT INTO user_sessions (
      id, user_id, workspace_id, token_hash, expires_at, created_at, last_seen_at
    )
    VALUES
      (${randomUUID()}, ${workspace.userId}, ${workspace.workspaceId}, ${randomUUID()}, NOW() + INTERVAL '1 day', NOW(), NOW()),
      (${randomUUID()}, ${workspace.userId}, ${workspace.workspaceId}, ${randomUUID()}, NOW() + INTERVAL '1 day', NOW(), NOW())
  `;

  await installResetGate();
  await controlSql`SELECT pg_advisory_lock(${RESET_LOCK_KEY})`;
  let resetLockHeld = true;

  try {
    const firstAttempt = consumePasswordResetToken({
      token: issuedToken.token,
      passwordHash: firstHash,
    });
    await waitForBlockedQueries("password_reset_tokens", 1);

    const secondAttempt = consumePasswordResetToken({
      token: issuedToken.token,
      passwordHash: secondHash,
    });
    await waitForBlockedQueries("password_reset_tokens", 2);
    await unlock(RESET_LOCK_KEY);
    resetLockHeld = false;

    const [firstResult, secondResult] = await Promise.all([
      firstAttempt,
      secondAttempt,
    ]);
    assert.equal([firstResult, secondResult].filter(Boolean).length, 1);
    assert.equal(firstResult ? secondResult : firstResult, null);

    const user = await findUserById(workspace.userId);
    assert.ok(user);
    const winningPassword = firstResult
      ? "First-reset-password"
      : "Second-reset-password";
    const losingPassword = firstResult
      ? "Second-reset-password"
      : "First-reset-password";
    assert.equal(await verifyPassword(winningPassword, user.password_hash), true);
    assert.equal(await verifyPassword(losingPassword, user.password_hash), false);

    const [token] = await controlSql`
      SELECT consumed_at
      FROM password_reset_tokens
      WHERE user_id = ${workspace.userId}
    `;
    const [sessionCount] = await controlSql`
      SELECT COUNT(*)::int AS count
      FROM user_sessions
      WHERE user_id = ${workspace.userId}
    `;
    assert.ok(token?.consumed_at);
    assert.equal(Number(sessionCount?.count ?? 0), 0);
  } finally {
    if (resetLockHeld) {
      await unlock(RESET_LOCK_KEY);
    }
    await removeResetGate();
    await cleanupWorkspace(workspace.workspaceId);
  }
});

test("PostgreSQL reserva somente o ultimo assento sob convites concorrentes", async () => {
  const workspace = await createWorkspace("seat-concurrency");
  const firstEmail = `seat-first-${randomUUID()}@example.test`;
  const secondEmail = `seat-second-${randomUUID()}@example.test`;

  await installSeatGate();
  await controlSql`SELECT pg_advisory_lock(${SEAT_LOCK_KEY})`;
  let seatLockHeld = true;

  try {
    const firstAttempt = inviteWorkspaceMember({
      workspaceId: workspace.workspaceId,
      fullName: "First concurrent invite",
      email: firstEmail,
      workspaceRole: "operator",
      invitedByUserId: workspace.userId,
      seatLimit: 2,
    });
    await waitForBlockedQueries("workspace_memberships", 1);

    const secondAttempt = inviteWorkspaceMember({
      workspaceId: workspace.workspaceId,
      fullName: "Second concurrent invite",
      email: secondEmail,
      workspaceRole: "operator",
      invitedByUserId: workspace.userId,
      seatLimit: 2,
    });
    await waitForBlockedQueries("FROM workspaces", 1);
    await unlock(SEAT_LOCK_KEY);
    seatLockHeld = false;

    const results = await Promise.allSettled([firstAttempt, secondAttempt]);
    const accepted = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(accepted.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(rejected[0]?.reason?.message, "SEAT_LIMIT_REACHED");

    const [membershipCount] = await controlSql`
      SELECT COUNT(*)::int AS count
      FROM workspace_memberships
      WHERE workspace_id = ${workspace.workspaceId}
    `;
    const [invitedUsers] = await controlSql`
      SELECT COUNT(*)::int AS count
      FROM users
      WHERE email = ANY(${[firstEmail, secondEmail]})
    `;
    const [workspaceRow] = await controlSql`
      SELECT id, owner_user_id
      FROM workspaces
      WHERE id = ${workspace.workspaceId}
    `;
    assert.equal(Number(membershipCount?.count ?? 0), 2);
    assert.equal(Number(invitedUsers?.count ?? 0), 1);
    assert.equal(workspaceRow?.owner_user_id, workspace.userId);
  } finally {
    if (seatLockHeld) {
      await unlock(SEAT_LOCK_KEY);
    }
    await removeSeatGate();
    await cleanupWorkspace(workspace.workspaceId);
  }
});
