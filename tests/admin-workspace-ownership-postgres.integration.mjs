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

const platformModule = await import("../src/lib/server/platform.ts");
const { hashPassword } = await import("../src/lib/auth/password.ts");
const {
  ensurePlatformReady,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} = platformModule;
const controlSql = postgres(testDatabaseUrl, { idle_timeout: 1, max: 6 });

const OWNERSHIP_LOCK_KEY = 741_012;

async function waitForBlockedQueries(fragment, minimum = 1) {
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

    if (Number(rows[0]?.count ?? 0) >= minimum) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    `Timed out waiting for ${minimum} overlapping PostgreSQL operation(s) containing ${fragment}.`,
  );
}

async function createWorkspace(prefix) {
  const suffix = randomUUID();
  const workspaceId = randomUUID();
  const owner = await createUser(`${prefix}-owner-${suffix}`);

  await controlSql`
    INSERT INTO workspaces (
      id, name, slug, owner_user_id, business_mode, status, created_at, updated_at
    )
    VALUES (
      ${workspaceId}, ${`${prefix}-${suffix}`}, ${`${prefix}-${suffix}`},
      ${owner.userId}, '3d', 'active', NOW(), NOW()
    )
  `;
  await controlSql`
    INSERT INTO workspace_memberships (
      id, workspace_id, user_id, workspace_role, invited_by_user_id, created_at
    )
    VALUES (
      ${owner.membershipId}, ${workspaceId}, ${owner.userId}, 'owner', ${owner.userId}, NOW()
    )
  `;

  return { workspaceId, owner, users: [owner.userId] };
}

async function createUser(prefix) {
  const suffix = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  await controlSql`
    INSERT INTO users (
      id, email, password_hash, full_name, platform_role, status, created_at, updated_at
    )
    VALUES (
      ${userId}, ${`${prefix}-${suffix}@example.test`}, ${await hashPassword(`Password-${suffix}`)},
      'Ownership integration user', 'user', 'active', NOW(), NOW()
    )
  `;
  return { userId, membershipId };
}

async function addMember(workspace, role) {
  const member = await createUser("ownership-member");
  await controlSql`
    INSERT INTO workspace_memberships (
      id, workspace_id, user_id, workspace_role, invited_by_user_id, created_at
    )
    VALUES (
      ${member.membershipId}, ${workspace.workspaceId}, ${member.userId}, ${role},
      ${workspace.owner.userId}, NOW()
    )
  `;
  workspace.users.push(member.userId);
  return member;
}

async function readOwnership(workspaceId) {
  const [workspace] = await controlSql`
    SELECT owner_user_id
    FROM workspaces
    WHERE id = ${workspaceId}
  `;
  const owners = await controlSql`
    SELECT id, user_id
    FROM workspace_memberships
    WHERE workspace_id = ${workspaceId}
      AND workspace_role = 'owner'
  `;
  return { ownerUserId: workspace?.owner_user_id ?? null, owners };
}

async function assertOwnership(workspaceId, expectedOwnerUserId) {
  const state = await readOwnership(workspaceId);
  assert.equal(state.owners.length, 1);
  assert.equal(state.owners[0]?.user_id, expectedOwnerUserId);
  assert.equal(state.ownerUserId, expectedOwnerUserId);
}

async function cleanupWorkspace(workspace) {
  await controlSql`DELETE FROM workspaces WHERE id = ${workspace.workspaceId}`;
  for (const userId of workspace.users) {
    await controlSql`DELETE FROM users WHERE id = ${userId}`;
  }
}

async function installTransferGate() {
  await removeTransferGate();
  await controlSql`
    CREATE OR REPLACE FUNCTION admin_ownership_block_role_update()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(741012);
      RETURN NEW;
    END;
    $$
  `;
  await controlSql`
    CREATE TRIGGER admin_ownership_block_role_update
    BEFORE UPDATE OF workspace_role ON workspace_memberships
    FOR EACH ROW
    EXECUTE FUNCTION admin_ownership_block_role_update()
  `;
}

async function removeTransferGate() {
  await controlSql`
    DROP TRIGGER IF EXISTS admin_ownership_block_role_update
    ON workspace_memberships
  `;
  await controlSql`
    DROP FUNCTION IF EXISTS admin_ownership_block_role_update()
  `;
}

async function installWorkspaceFailureGate() {
  await removeWorkspaceFailureGate();
  await controlSql`
    CREATE OR REPLACE FUNCTION admin_ownership_fail_workspace_update()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'controlled ownership transfer failure';
    END;
    $$
  `;
  await controlSql`
    CREATE TRIGGER admin_ownership_fail_workspace_update
    BEFORE UPDATE OF owner_user_id ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION admin_ownership_fail_workspace_update()
  `;
}

async function removeWorkspaceFailureGate() {
  await controlSql`
    DROP TRIGGER IF EXISTS admin_ownership_fail_workspace_update
    ON workspaces
  `;
  await controlSql`
    DROP FUNCTION IF EXISTS admin_ownership_fail_workspace_update()
  `;
}

async function unlockOwnershipGate() {
  await controlSql`SELECT pg_advisory_unlock(${OWNERSHIP_LOCK_KEY})`;
}

test.before(async () => {
  await ensurePlatformReady();
  await removeTransferGate();
  await removeWorkspaceFailureGate();
});

test.after(async () => {
  await removeTransferGate();
  await removeWorkspaceFailureGate();
  await controlSql.end({ timeout: 1 });
  await closeNeonPostgresShim();
});

test("PostgreSQL transfere ownership mantendo um unico owner", async () => {
  const workspace = await createWorkspace("ownership-transfer");
  const target = await addMember(workspace, "manager");

  try {
    const member = await updateWorkspaceMemberRole({
      workspaceId: workspace.workspaceId,
      membershipId: target.membershipId,
      workspaceRole: "owner",
      updatedByUserId: workspace.owner.userId,
    });
    assert.equal(member?.userId, target.userId);
    assert.equal(member?.workspaceRole, "owner");
    await assertOwnership(workspace.workspaceId, target.userId);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("PostgreSQL rejeita rebaixamento e remocao diretos do owner", async () => {
  const workspace = await createWorkspace("ownership-direct-protection");

  try {
    await assert.rejects(
      updateWorkspaceMemberRole({
        workspaceId: workspace.workspaceId,
        membershipId: workspace.owner.membershipId,
        workspaceRole: "manager",
        updatedByUserId: workspace.owner.userId,
      }),
      /WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED/,
    );
    await assert.rejects(
      removeWorkspaceMember({
        workspaceId: workspace.workspaceId,
        membershipId: workspace.owner.membershipId,
        removedByUserId: workspace.owner.userId,
      }),
      /WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED/,
    );
    await assertOwnership(workspace.workspaceId, workspace.owner.userId);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("PostgreSQL rejeita role desconhecida sem normalizar para operator", async () => {
  const workspace = await createWorkspace("ownership-invalid-role");
  const target = await addMember(workspace, "manager");

  try {
    await assert.rejects(
      updateWorkspaceMemberRole({
        workspaceId: workspace.workspaceId,
        membershipId: target.membershipId,
        workspaceRole: "unknown-role",
        updatedByUserId: workspace.owner.userId,
      }),
      /INVALID_WORKSPACE_ROLE/,
    );
    const [membership] = await controlSql`
      SELECT workspace_role
      FROM workspace_memberships
      WHERE id = ${target.membershipId}
    `;
    assert.equal(membership?.workspace_role, "manager");
    await assertOwnership(workspace.workspaceId, workspace.owner.userId);
  } finally {
    await cleanupWorkspace(workspace);
  }
});

test("PostgreSQL faz rollback completo se a transferencia falhar", async () => {
  const workspace = await createWorkspace("ownership-rollback");
  const target = await addMember(workspace, "manager");
  await installWorkspaceFailureGate();

  try {
    await assert.rejects(
      updateWorkspaceMemberRole({
        workspaceId: workspace.workspaceId,
        membershipId: target.membershipId,
        workspaceRole: "owner",
        updatedByUserId: workspace.owner.userId,
      }),
      /controlled ownership transfer failure/,
    );
    await assertOwnership(workspace.workspaceId, workspace.owner.userId);
    const [targetRow] = await controlSql`
      SELECT workspace_role
      FROM workspace_memberships
      WHERE id = ${target.membershipId}
    `;
    assert.equal(targetRow?.workspace_role, "manager");
  } finally {
    await removeWorkspaceFailureGate();
    await cleanupWorkspace(workspace);
  }
});

test("PostgreSQL serializa duas transferencias concorrentes", async () => {
  const workspace = await createWorkspace("ownership-concurrent-transfers");
  const firstTarget = await addMember(workspace, "manager");
  const secondTarget = await addMember(workspace, "manager");
  await installTransferGate();
  await controlSql`SELECT pg_advisory_lock(${OWNERSHIP_LOCK_KEY})`;
  let gateHeld = true;

  try {
    const first = updateWorkspaceMemberRole({
      workspaceId: workspace.workspaceId,
      membershipId: firstTarget.membershipId,
      workspaceRole: "owner",
      updatedByUserId: workspace.owner.userId,
    });
    await waitForBlockedQueries("workspace_memberships");

    const second = updateWorkspaceMemberRole({
      workspaceId: workspace.workspaceId,
      membershipId: secondTarget.membershipId,
      workspaceRole: "owner",
      updatedByUserId: workspace.owner.userId,
    });
    await waitForBlockedQueries("FROM workspaces");
    await unlockOwnershipGate();
    gateHeld = false;

    await Promise.all([first, second]);
    const state = await readOwnership(workspace.workspaceId);
    assert.equal(state.owners.length, 1);
    assert.ok([firstTarget.userId, secondTarget.userId].includes(state.ownerUserId));
    assert.equal(state.owners[0]?.user_id, state.ownerUserId);
  } finally {
    if (gateHeld) await unlockOwnershipGate();
    await removeTransferGate();
    await cleanupWorkspace(workspace);
  }
});

test("PostgreSQL serializa transferencia contra remocao do alvo", async () => {
  const workspace = await createWorkspace("ownership-transfer-removal");
  const target = await addMember(workspace, "manager");
  await installTransferGate();
  await controlSql`SELECT pg_advisory_lock(${OWNERSHIP_LOCK_KEY})`;
  let gateHeld = true;

  try {
    const transfer = updateWorkspaceMemberRole({
      workspaceId: workspace.workspaceId,
      membershipId: target.membershipId,
      workspaceRole: "owner",
      updatedByUserId: workspace.owner.userId,
    });
    await waitForBlockedQueries("workspace_memberships");

    const removal = removeWorkspaceMember({
      workspaceId: workspace.workspaceId,
      membershipId: target.membershipId,
      removedByUserId: workspace.owner.userId,
    }).then(
      (value) => ({ status: "fulfilled", value }),
      (error) => ({ status: "rejected", error }),
    );
    await waitForBlockedQueries("FROM workspaces");
    await unlockOwnershipGate();
    gateHeld = false;

    await assert.doesNotReject(transfer);
    const removalResult = await removal;
    assert.equal(removalResult.status, "rejected");
    assert.equal(removalResult.error?.message, "WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED");
    await assertOwnership(workspace.workspaceId, target.userId);
    const [targetMembership] = await controlSql`
      SELECT user_id, workspace_role
      FROM workspace_memberships
      WHERE id = ${target.membershipId}
    `;
    assert.equal(targetMembership?.user_id, target.userId);
    assert.equal(targetMembership?.workspace_role, "owner");
  } finally {
    if (gateHeld) await unlockOwnershipGate();
    await removeTransferGate();
    await cleanupWorkspace(workspace);
  }
});
