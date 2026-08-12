import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { normalizeWorkspaceRole } from "@/lib/auth/access-control";
import {
  defaultAppPreferences,
  normalizeAppPreferences,
  resolveCalculationHistoryLimit,
  type AppPreferences,
} from "@/lib/settings/app-preferences";
import {
  normalizeSavedCalculation,
  type SavedCalculation,
} from "@/lib/history/workspace-calculations";
import { hashPassword } from "@/lib/auth/password";
import { getSql, hasDatabaseUrl } from "@/lib/server/neon";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  platform_role: string;
  status: string;
};

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
};

type WorkspaceMembershipRow = {
  workspace_id: string;
  workspace_role: string;
  workspace_name: string;
  workspace_slug: string;
};

type SessionLookupRow = {
  session_id: string;
  user_id: string;
  email: string;
  full_name: string;
  platform_role: string;
  status: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  workspace_role: string;
};

type PasswordResetTokenLookupRow = {
  id: string;
  user_id: string;
  email: string;
  status: string;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
};

type WorkspaceMemberLookupRow = {
  membership_id: string;
  workspace_id: string;
  user_id: string;
  email: string;
  full_name: string;
  platform_role: string;
  user_status: string;
  workspace_role: string;
  invited_by_user_id: string | null;
  invited_by_name: string | null;
  membership_created_at: string;
  last_login_at: string | null;
  workspace_owner_user_id: string;
};

type PlatformUserLookupRow = {
  user_id: string;
  email: string;
  full_name: string;
  platform_role: string;
  status: string;
  created_at: string;
  last_login_at: string | null;
  workspace_count: number;
  primary_workspace_id: string | null;
  primary_workspace_name: string | null;
  primary_workspace_slug: string | null;
  primary_workspace_role: string | null;
};

type PreferencesRow = {
  data: AppPreferences | string;
};

type CalculationRow = {
  data: SavedCalculation | string;
};

type MercadoLivreTokenRow = {
  workspace_id: string;
  access_token: string;
  refresh_token: string;
  user_id: string;
  scope: string | null;
  expires_at: string;
  updated_at: string;
};

export type PlatformRole =
  | "super_admin"
  | "platform_admin"
  | "support_agent"
  | "developer"
  | "user";

export type AuthenticatedWorkspaceSession = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    platformRole: PlatformRole;
    status: string;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    role: string;
  };
};

export type WorkspaceMemberRecord = {
  membershipId: string;
  workspaceId: string;
  userId: string;
  email: string;
  fullName: string;
  platformRole: PlatformRole;
  userStatus: string;
  workspaceRole: string;
  invitedByUserId: string | null;
  invitedByName: string | null;
  joinedAt: string;
  lastLoginAt: string | null;
  isWorkspaceOwner: boolean;
};

export type PlatformUserRecord = {
  userId: string;
  email: string;
  fullName: string;
  platformRole: PlatformRole;
  userStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
  workspaceCount: number;
  primaryWorkspaceId: string | null;
  primaryWorkspaceName: string | null;
  primaryWorkspaceSlug: string | null;
  primaryWorkspaceRole: string | null;
};

let platformReadyPromise: Promise<void> | null = null;

export function isPlatformPersistenceAvailable() {
  return hasDatabaseUrl();
}

export async function ensurePlatformReady() {
  if (!hasDatabaseUrl()) {
    throw new Error(
      "DATABASE_URL is required for autenticação, sessões e persistência do workspace.",
    );
  }

  if (!platformReadyPromise) {
    platformReadyPromise = initializePlatform();
  }

  await platformReadyPromise;
}

export type RegisterWorkspaceOwnerInput = {
  fullName: string;
  email: string;
  password: string;
  workspaceName: string;
}

export async function findUserByEmail(email: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const normalizedEmail = normalizeEmail(email);
  const rows = (await sql`
    SELECT id, email, password_hash, full_name, platform_role, status
    FROM users
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function registerWorkspaceOwner(
  input: RegisterWorkspaceOwnerInput,
) {
  await ensurePlatformReady();

  const sql = getSql();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedFullName = input.fullName.trim();
  const normalizedWorkspaceName = input.workspaceName.trim();

  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser) {
    throw new Error("EMAIL_ALREADY_REGISTERED");
  }

  const userId = randomUUID();
  const workspaceId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const workspaceSlug = await createUniqueWorkspaceSlug(
    normalizedWorkspaceName,
  );

  const preferences = normalizeAppPreferences({
    ...defaultAppPreferences,
    workspaceName: normalizedWorkspaceName,
    operatorName: normalizedFullName,
    operatorEmail: normalizedEmail,
    onboardingCompleted: false,
  });

  try {
    await sql.transaction([
      sql`
      INSERT INTO users (
        id,
        email,
        password_hash,
        full_name,
        platform_role,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${normalizedEmail},
        ${passwordHash},
        ${normalizedFullName},
        'user',
        'active',
        NOW(),
        NOW()
      )
    `,

      sql`
      INSERT INTO workspaces (
        id,
        name,
        slug,
        owner_user_id,
        business_mode,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${workspaceId},
        ${normalizedWorkspaceName},
        ${workspaceSlug},
        ${userId},
        '3d',
        'active',
        NOW(),
        NOW()
      )
    `,

      sql`
      INSERT INTO workspace_memberships (
        id,
        workspace_id,
        user_id,
        workspace_role,
        invited_by_user_id,
        created_at
      )
      VALUES (
        ${randomUUID()},
        ${workspaceId},
        ${userId},
        'owner',
        ${userId},
        NOW()
      )
    `,

      sql`
      INSERT INTO workspace_preferences (
        workspace_id,
        data,
        updated_by_user_id,
        updated_at
      )
      VALUES (
        ${workspaceId},
        CAST(${JSON.stringify(preferences)} AS JSONB),
        ${userId},
        NOW()
      )
    `,

      sql`
      INSERT INTO workspace_audit_events (
        id,
        workspace_id,
        user_id,
        type,
        title,
        description,
        tone,
        occurred_at
      )
      VALUES (
        ${randomUUID()},
        ${workspaceId},
        ${userId},
        'workspace-created',
        'Workspace criado',
        'Workspace criado durante o cadastro inicial.',
        'success',
        NOW()
      )
    `,
    ]);
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new Error("EMAIL_ALREADY_REGISTERED");
    }

    throw error;
  }

  return {
    userId,
    workspaceId,
    email: normalizedEmail,
    fullName: normalizedFullName,
    workspaceName: normalizedWorkspaceName,
    workspaceSlug,
  };
}

export async function findUserById(userId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash, full_name, platform_role, status
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `) as UserRow[];

  return rows[0] ?? null;
}

export async function updateUserPassword(input: {
  userId: string;
  passwordHash: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();

  await sql`
    UPDATE users
    SET
      password_hash = ${input.passwordHash},
      updated_at = NOW()
    WHERE id = ${input.userId}
  `;

  await sql`
    DELETE FROM user_sessions
    WHERE user_id = ${input.userId}
  `;
}

export async function issuePasswordResetToken(
  email: string,
  options?: {
    allowedStatuses?: string[];
  },
) {
  await ensurePlatformReady();

  const user = await findUserByEmail(email);
  const allowedStatuses = options?.allowedStatuses ?? ["active"];

  if (!user || !allowedStatuses.includes(user.status)) {
    return null;
  }

  const sql = getSql();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30).toISOString();

  await sql`
    DELETE FROM password_reset_tokens
    WHERE user_id = ${user.id}
      OR expires_at <= NOW()
      OR consumed_at IS NOT NULL
  `;

  const rows = (await sql`
    INSERT INTO password_reset_tokens (
      id,
      user_id,
      token_hash,
      expires_at,
      consumed_at,
      created_at
    )
    VALUES (
      ${randomUUID()},
      ${user.id},
      ${tokenHash},
      ${expiresAt},
      NULL,
      NOW()
    )
    RETURNING id, user_id, token_hash, expires_at, consumed_at
  `) as Array<Omit<PasswordResetTokenLookupRow, "email">>;

  if (!rows[0]) {
    throw new Error("Falha ao emitir token de recuperação.");
  }

  return {
    token: rawToken,
    email: user.email,
    userId: user.id,
    expiresAt,
  };
}

export async function verifyPasswordResetToken(token: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const tokenHash = hashOpaqueToken(token);
  const rows = (await sql`
    SELECT
      t.id,
      t.user_id,
      u.email,
      u.status,
      t.token_hash,
      t.expires_at,
      t.consumed_at
    FROM password_reset_tokens t
    JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ${tokenHash}
    LIMIT 1
  `) as PasswordResetTokenLookupRow[];
  const row = rows[0];

  if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    status: row.status,
    expiresAt: row.expires_at,
  };
}

export async function consumePasswordResetToken(input: {
  token: string;
  passwordHash: string;
}) {
  await ensurePlatformReady();

  const verifiedToken = await verifyPasswordResetToken(input.token);

  if (!verifiedToken) {
    return null;
  }

  await updateUserPassword({
    userId: verifiedToken.userId,
    passwordHash: input.passwordHash,
  });

  const sql = getSql();

  await sql`
    UPDATE password_reset_tokens
    SET consumed_at = NOW()
    WHERE id = ${verifiedToken.id}
  `;

  if (verifiedToken.status !== "active") {
    await sql`
      UPDATE users
      SET
        status = 'active',
        updated_at = NOW()
      WHERE id = ${verifiedToken.userId}
    `;
  }

  return verifiedToken;
}

export async function findPrimaryWorkspaceForUser(userId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      m.workspace_id,
      m.workspace_role,
      w.name AS workspace_name,
      w.slug AS workspace_slug
    FROM workspace_memberships m
    JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ${userId}
    ORDER BY
      CASE m.workspace_role
        WHEN 'owner' THEN 0
        WHEN 'manager' THEN 1
        ELSE 2
      END,
      m.created_at ASC
    LIMIT 1
  `) as WorkspaceMembershipRow[];

  if (!rows[0]) {
    return null;
  }

  return {
    ...rows[0],
    workspace_role: normalizeWorkspaceRole(rows[0].workspace_role),
  };
}

export async function createUserSession(input: {
  userId: string;
  workspaceId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const sessionId = randomUUID();

  await sql`
    INSERT INTO user_sessions (
      id,
      user_id,
      workspace_id,
      token_hash,
      expires_at,
      created_at,
      last_seen_at
    )
    VALUES (
      ${sessionId},
      ${input.userId},
      ${input.workspaceId},
      ${input.tokenHash},
      ${input.expiresAt.toISOString()},
      NOW(),
      NOW()
    )
  `;

  await sql`
    UPDATE users
    SET
      last_login_at = NOW(),
      updated_at = NOW()
    WHERE id = ${input.userId}
  `;

  return sessionId;
}

export async function deleteUserSession(tokenHash: string) {
  if (!hasDatabaseUrl()) {
    return;
  }

  await ensurePlatformReady();
  const sql = getSql();

  await sql`
    DELETE FROM user_sessions
    WHERE token_hash = ${tokenHash}
  `;
}

export async function getAuthenticatedSessionByToken(tokenHash: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      s.id AS session_id,
      u.id AS user_id,
      u.email,
      u.full_name,
      u.platform_role,
      u.status,
      w.id AS workspace_id,
      w.name AS workspace_name,
      w.slug AS workspace_slug,
      m.workspace_role
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN workspaces w ON w.id = s.workspace_id
    JOIN workspace_memberships m
      ON m.workspace_id = s.workspace_id
      AND m.user_id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > NOW()
    LIMIT 1
  `) as SessionLookupRow[];
  const row = rows[0];

  if (!row || row.status !== "active") {
    return null;
  }

  return {
    sessionId: row.session_id,
    user: {
      id: row.user_id,
      email: row.email,
      fullName: row.full_name,
      platformRole: normalizePlatformRole(row.platform_role),
      status: row.status,
    },
    workspace: {
      id: row.workspace_id,
      name: row.workspace_name,
      slug: row.workspace_slug,
      role: normalizeWorkspaceRole(row.workspace_role),
    },
  } satisfies AuthenticatedWorkspaceSession;
}

export async function listWorkspaceMembers(workspaceId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      m.id AS membership_id,
      m.workspace_id,
      m.user_id,
      u.email,
      u.full_name,
      u.platform_role,
      u.status AS user_status,
      m.workspace_role,
      m.invited_by_user_id,
      inviter.full_name AS invited_by_name,
      m.created_at AS membership_created_at,
      u.last_login_at,
      w.owner_user_id AS workspace_owner_user_id
    FROM workspace_memberships m
    JOIN users u ON u.id = m.user_id
    JOIN workspaces w ON w.id = m.workspace_id
    LEFT JOIN users inviter ON inviter.id = m.invited_by_user_id
    WHERE m.workspace_id = ${workspaceId}
    ORDER BY
      CASE m.workspace_role
        WHEN 'owner' THEN 0
        WHEN 'manager' THEN 1
        ELSE 2
      END,
      m.created_at ASC
  `) as WorkspaceMemberLookupRow[];

  return rows.map(mapWorkspaceMemberRow);
}

export async function listPlatformUsers() {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.full_name,
      u.platform_role,
      u.status,
      u.created_at,
      u.last_login_at,
      COALESCE(workspace_counts.workspace_count, 0)::int AS workspace_count,
      primary_membership.workspace_id AS primary_workspace_id,
      primary_membership.workspace_name AS primary_workspace_name,
      primary_membership.workspace_slug AS primary_workspace_slug,
      primary_membership.workspace_role AS primary_workspace_role
    FROM users u
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS workspace_count
      FROM workspace_memberships m
      WHERE m.user_id = u.id
    ) workspace_counts ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        m.workspace_id,
        w.name AS workspace_name,
        w.slug AS workspace_slug,
        m.workspace_role
      FROM workspace_memberships m
      JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = u.id
      ORDER BY
        CASE m.workspace_role
          WHEN 'owner' THEN 0
          WHEN 'manager' THEN 1
          ELSE 2
        END,
        m.created_at ASC
      LIMIT 1
    ) primary_membership ON TRUE
    ORDER BY
      CASE u.platform_role
        WHEN 'super_admin' THEN 0
        WHEN 'platform_admin' THEN 1
        WHEN 'support_agent' THEN 2
        WHEN 'developer' THEN 3
        ELSE 4
      END,
      u.created_at ASC
  `) as PlatformUserLookupRow[];

  return rows.map(mapPlatformUserRow);
}

export async function findPlatformUserById(userId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      u.id AS user_id,
      u.email,
      u.full_name,
      u.platform_role,
      u.status,
      u.created_at,
      u.last_login_at,
      COALESCE(workspace_counts.workspace_count, 0)::int AS workspace_count,
      primary_membership.workspace_id AS primary_workspace_id,
      primary_membership.workspace_name AS primary_workspace_name,
      primary_membership.workspace_slug AS primary_workspace_slug,
      primary_membership.workspace_role AS primary_workspace_role
    FROM users u
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS workspace_count
      FROM workspace_memberships m
      WHERE m.user_id = u.id
    ) workspace_counts ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        m.workspace_id,
        w.name AS workspace_name,
        w.slug AS workspace_slug,
        m.workspace_role
      FROM workspace_memberships m
      JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = u.id
      ORDER BY
        CASE m.workspace_role
          WHEN 'owner' THEN 0
          WHEN 'manager' THEN 1
          ELSE 2
        END,
        m.created_at ASC
      LIMIT 1
    ) primary_membership ON TRUE
    WHERE u.id = ${userId}
    LIMIT 1
  `) as PlatformUserLookupRow[];

  return rows[0] ? mapPlatformUserRow(rows[0]) : null;
}

export async function findWorkspaceMemberById(input: {
  workspaceId: string;
  membershipId: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      m.id AS membership_id,
      m.workspace_id,
      m.user_id,
      u.email,
      u.full_name,
      u.platform_role,
      u.status AS user_status,
      m.workspace_role,
      m.invited_by_user_id,
      inviter.full_name AS invited_by_name,
      m.created_at AS membership_created_at,
      u.last_login_at,
      w.owner_user_id AS workspace_owner_user_id
    FROM workspace_memberships m
    JOIN users u ON u.id = m.user_id
    JOIN workspaces w ON w.id = m.workspace_id
    LEFT JOIN users inviter ON inviter.id = m.invited_by_user_id
    WHERE m.workspace_id = ${input.workspaceId}
      AND m.id = ${input.membershipId}
    LIMIT 1
  `) as WorkspaceMemberLookupRow[];

  return rows[0] ? mapWorkspaceMemberRow(rows[0]) : null;
}

export async function findWorkspaceMemberByEmail(input: {
  workspaceId: string;
  email: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT
      m.id AS membership_id,
      m.workspace_id,
      m.user_id,
      u.email,
      u.full_name,
      u.platform_role,
      u.status AS user_status,
      m.workspace_role,
      m.invited_by_user_id,
      inviter.full_name AS invited_by_name,
      m.created_at AS membership_created_at,
      u.last_login_at,
      w.owner_user_id AS workspace_owner_user_id
    FROM workspace_memberships m
    JOIN users u ON u.id = m.user_id
    JOIN workspaces w ON w.id = m.workspace_id
    LEFT JOIN users inviter ON inviter.id = m.invited_by_user_id
    WHERE m.workspace_id = ${input.workspaceId}
      AND u.email = ${normalizeEmail(input.email)}
    LIMIT 1
  `) as WorkspaceMemberLookupRow[];

  return rows[0] ? mapWorkspaceMemberRow(rows[0]) : null;
}

export async function inviteWorkspaceMember(input: {
  workspaceId: string;
  fullName: string;
  email: string;
  workspaceRole: string;
  invitedByUserId: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedFullName = sanitizeMemberName(input.fullName, normalizedEmail);
  const normalizedRole = normalizeWorkspaceRole(input.workspaceRole);
  const existingWorkspaceMember = await findWorkspaceMemberByEmail({
    workspaceId: input.workspaceId,
    email: normalizedEmail,
  });

  if (existingWorkspaceMember) {
    throw new Error("MEMBER_ALREADY_EXISTS");
  }

  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser && existingUser.status === "disabled") {
    throw new Error("USER_DISABLED");
  }

  if (existingUser) {
    const otherMemberships = (await sql`
      SELECT workspace_id
      FROM workspace_memberships
      WHERE user_id = ${existingUser.id}
        AND workspace_id <> ${input.workspaceId}
      LIMIT 1
    `) as Array<{ workspace_id: string }>;

    if (otherMemberships[0]) {
      throw new Error("MULTI_WORKSPACE_NOT_SUPPORTED");
    }
  }

  const userId = existingUser?.id ?? randomUUID();

  if (!existingUser) {
    await sql`
      INSERT INTO users (
        id,
        email,
        password_hash,
        full_name,
        platform_role,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${normalizedEmail},
        ${await buildInvitedUserPasswordHash()},
        ${normalizedFullName},
        'user',
        'invited',
        NOW(),
        NOW()
      )
    `;
  } else {
    await sql`
      UPDATE users
      SET
        full_name = ${normalizedFullName},
        updated_at = NOW()
      WHERE id = ${existingUser.id}
    `;
  }

  const membershipId = randomUUID();

  await sql`
    INSERT INTO workspace_memberships (
      id,
      workspace_id,
      user_id,
      workspace_role,
      invited_by_user_id,
      created_at
    )
    VALUES (
      ${membershipId},
      ${input.workspaceId},
      ${userId},
      ${normalizedRole},
      ${input.invitedByUserId},
      NOW()
    )
  `;

  await syncWorkspaceSeatUsage(input.workspaceId, input.invitedByUserId);

  const member = await findWorkspaceMemberById({
    workspaceId: input.workspaceId,
    membershipId,
  });

  if (!member) {
    throw new Error("MEMBER_INVITE_FAILED");
  }

  return member;
}

export async function updateWorkspaceMemberRole(input: {
  workspaceId: string;
  membershipId: string;
  workspaceRole: string;
  updatedByUserId: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const normalizedRole = normalizeWorkspaceRole(input.workspaceRole);
  const targetMember = await findWorkspaceMemberById({
    workspaceId: input.workspaceId,
    membershipId: input.membershipId,
  });

  if (!targetMember) {
    return null;
  }

  if (normalizedRole === "owner") {
    await sql`
      UPDATE workspace_memberships
      SET workspace_role = 'manager'
      WHERE workspace_id = ${input.workspaceId}
        AND workspace_role = 'owner'
    `;

    await sql`
      UPDATE workspaces
      SET
        owner_user_id = ${targetMember.userId},
        updated_at = NOW()
      WHERE id = ${input.workspaceId}
    `;
  }

  await sql`
    UPDATE workspace_memberships
    SET workspace_role = ${normalizedRole}
    WHERE id = ${input.membershipId}
      AND workspace_id = ${input.workspaceId}
  `;

  await syncWorkspaceSeatUsage(input.workspaceId, input.updatedByUserId);

  return findWorkspaceMemberById({
    workspaceId: input.workspaceId,
    membershipId: input.membershipId,
  });
}

export async function removeWorkspaceMember(input: {
  workspaceId: string;
  membershipId: string;
  removedByUserId: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const member = await findWorkspaceMemberById({
    workspaceId: input.workspaceId,
    membershipId: input.membershipId,
  });

  if (!member) {
    return null;
  }

  await sql`
    DELETE FROM workspace_memberships
    WHERE id = ${input.membershipId}
      AND workspace_id = ${input.workspaceId}
  `;

  const remainingMemberships = (await sql`
    SELECT 1
    FROM workspace_memberships
    WHERE user_id = ${member.userId}
    LIMIT 1
  `) as Array<{ "?column?": number }>;

  if (!remainingMemberships[0]) {
    await sql`
      DELETE FROM user_sessions
      WHERE user_id = ${member.userId}
    `;

    await sql`
      UPDATE users
      SET
        status = 'disabled',
        updated_at = NOW()
      WHERE id = ${member.userId}
    `;
  }

  await syncWorkspaceSeatUsage(input.workspaceId, input.removedByUserId);

  return member;
}

export async function updateWorkspaceMemberProfile(input: {
  workspaceId: string;
  membershipId: string;
  email: string;
  fullName: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const member = await findWorkspaceMemberById({
    workspaceId: input.workspaceId,
    membershipId: input.membershipId,
  });

  if (!member) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const normalizedFullName = sanitizeMemberName(input.fullName, normalizedEmail);
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser && existingUser.id !== member.userId) {
    throw new Error("EMAIL_ALREADY_IN_USE");
  }

  await sql`
    UPDATE users
    SET
      email = ${normalizedEmail},
      full_name = ${normalizedFullName},
      updated_at = NOW()
    WHERE id = ${member.userId}
  `;

  return findWorkspaceMemberById({
    workspaceId: input.workspaceId,
    membershipId: input.membershipId,
  });
}

export async function updatePlatformUserProfile(input: {
  userId: string;
  email: string;
  fullName: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const user = await findUserById(input.userId);

  if (!user) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const normalizedFullName = sanitizeMemberName(input.fullName, normalizedEmail);
  const existingUser = await findUserByEmail(normalizedEmail);

  if (existingUser && existingUser.id !== user.id) {
    throw new Error("EMAIL_ALREADY_IN_USE");
  }

  await sql`
    UPDATE users
    SET
      email = ${normalizedEmail},
      full_name = ${normalizedFullName},
      updated_at = NOW()
    WHERE id = ${user.id}
  `;

  return findPlatformUserById(user.id);
}

export async function deletePlatformUser(input: { userId: string }) {
  await ensurePlatformReady();

  const sql = getSql();
  const user = await findPlatformUserById(input.userId);

  if (!user) {
    return null;
  }

  const ownerRows = (await sql`
    SELECT id
    FROM workspaces
    WHERE owner_user_id = ${input.userId}
    LIMIT 1
  `) as Array<{ id: string }>;

  if (ownerRows[0]) {
    throw new Error("OWNER_USER_DELETE_FORBIDDEN");
  }

  await sql`
    DELETE FROM users
    WHERE id = ${input.userId}
  `;

  return user;
}

export async function getWorkspacePreferences(workspaceId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT data
    FROM workspace_preferences
    WHERE workspace_id = ${workspaceId}
    LIMIT 1
  `) as PreferencesRow[];

  if (rows[0]) {
    return normalizePreferencesPayload(rows[0].data);
  }

  const workspaceRows = (await sql`
    SELECT id, name, slug
    FROM workspaces
    WHERE id = ${workspaceId}
    LIMIT 1
  `) as WorkspaceRow[];
  const workspace = workspaceRows[0];

  if (!workspace) {
    throw new Error("Workspace não encontrado para carregar preferências.");
  }

  const preferences = normalizeAppPreferences({
    ...defaultAppPreferences,
    workspaceName: workspace.name,
  });

  await sql`
    INSERT INTO workspace_preferences (
      workspace_id,
      data,
      updated_by_user_id,
      updated_at
    )
    VALUES (
      ${workspaceId},
      CAST(${JSON.stringify(preferences)} AS JSONB),
      NULL,
      NOW()
    )
    ON CONFLICT (workspace_id) DO NOTHING
  `;

  return preferences;
}

export async function saveWorkspacePreferences(input: {
  workspaceId: string;
  updatedByUserId: string;
  preferences: AppPreferences;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const normalizedPreferences = normalizeAppPreferences({
    ...input.preferences,
    subscription: {
      ...input.preferences.subscription,
      seatsUsed: await getWorkspaceSeatUsageCount(input.workspaceId),
    },
  });
  const nextSlug = await createUniqueWorkspaceSlug(
  normalizedPreferences.workspaceName,
  input.workspaceId,
);

  await sql`
    INSERT INTO workspace_preferences (
      workspace_id,
      data,
      updated_by_user_id,
      updated_at
    )
    VALUES (
      ${input.workspaceId},
      CAST(${JSON.stringify(normalizedPreferences)} AS JSONB),
      ${input.updatedByUserId},
      NOW()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = NOW()
  `;

  await sql`
    UPDATE workspaces
    SET
      name = ${normalizedPreferences.workspaceName},
      slug = ${nextSlug},
      updated_at = NOW()
    WHERE id = ${input.workspaceId}
  `;

  return normalizedPreferences;
}

export async function applyWorkspaceSubscriptionUpdate(input: {
  workspaceId: string;
  planId: AppPreferences["subscription"]["planId"];
  status: AppPreferences["subscription"]["status"];
  source: string;
  mercadoPagoSubscriptionId?: string | null;
  description?: string | null;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const currentPreferences = await getWorkspacePreferences(input.workspaceId);
  const nextPreferences = normalizeAppPreferences({
    ...currentPreferences,
    subscription: {
      ...currentPreferences.subscription,
      planId: input.planId,
      status: input.status,
      seatsUsed: await getWorkspaceSeatUsageCount(input.workspaceId),
    },
  });

  const changed =
    currentPreferences.subscription.planId !== nextPreferences.subscription.planId ||
    currentPreferences.subscription.status !== nextPreferences.subscription.status;

  if (!changed) {
    return {
      changed: false,
      previousPreferences: currentPreferences,
      nextPreferences,
    };
  }

  await sql`
    INSERT INTO workspace_preferences (
      workspace_id,
      data,
      updated_by_user_id,
      updated_at
    )
    VALUES (
      ${input.workspaceId},
      CAST(${JSON.stringify(nextPreferences)} AS JSONB),
      NULL,
      NOW()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = NOW()
  `;

  await appendAuditEvent({
    workspaceId: input.workspaceId,
    userId: null,
    type: "subscription-synced",
    title: "Assinatura sincronizada",
    description:
      input.description?.trim() ||
      `Assinatura sincronizada via ${input.source} para ${nextPreferences.subscription.planId} (${nextPreferences.subscription.status}).` +
      (input.mercadoPagoSubscriptionId
        ? ` Assinatura Mercado Pago: ${input.mercadoPagoSubscriptionId}.`
        : ""),
    tone: "success",
  });

  return {
    changed: true,
    previousPreferences: currentPreferences,
    nextPreferences,
  };
}

export async function listCalculationSnapshots(workspaceId: string) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    SELECT data
    FROM calculation_snapshots
    WHERE workspace_id = ${workspaceId}
    ORDER BY saved_at DESC, updated_at DESC
  `) as CalculationRow[];

  return rows
    .map((row) => normalizeCalculationPayload(row.data))
    .filter((value): value is SavedCalculation => value !== null);
}

export async function saveCalculationSnapshot(input: {
  workspaceId: string;
  userId: string;
  item: SavedCalculation;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const normalizedItem = normalizeCalculationInput(input.item);

  await sql`
    INSERT INTO calculation_snapshots (
      id,
      workspace_id,
      user_id,
      data,
      saved_at,
      updated_at
    )
    VALUES (
      ${normalizedItem.id},
      ${input.workspaceId},
      ${input.userId},
      CAST(${JSON.stringify(normalizedItem)} AS JSONB),
      ${normalizedItem.savedAt},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      data = EXCLUDED.data,
      user_id = EXCLUDED.user_id,
      saved_at = EXCLUDED.saved_at,
      updated_at = NOW()
  `;

  const preferences = await getWorkspacePreferences(input.workspaceId);
  const historyLimit = resolveCalculationHistoryLimit(preferences);

  await sql`
    DELETE FROM calculation_snapshots
    WHERE workspace_id = ${input.workspaceId}
      AND id NOT IN (
        SELECT id
        FROM calculation_snapshots
        WHERE workspace_id = ${input.workspaceId}
        ORDER BY saved_at DESC, updated_at DESC
        LIMIT ${historyLimit}
      )
  `;

  return normalizedItem;
}

export async function deleteCalculationSnapshot(
  workspaceId: string,
  calculationId: string,
) {
  await ensurePlatformReady();
  const sql = getSql();

  await sql`
    DELETE FROM calculation_snapshots
    WHERE workspace_id = ${workspaceId}
      AND id = ${calculationId}
  `;
}

export async function clearCalculationSnapshots(workspaceId: string) {
  await ensurePlatformReady();
  const sql = getSql();

  await sql`
    DELETE FROM calculation_snapshots
    WHERE workspace_id = ${workspaceId}
  `;
}

export async function appendAuditEvent(input: {
  workspaceId: string;
  userId: string | null;
  type: string;
  title: string;
  description: string;
  tone: string;
  occurredAt?: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();

  await sql`
    INSERT INTO workspace_audit_events (
      id,
      workspace_id,
      user_id,
      type,
      title,
      description,
      tone,
      occurred_at
    )
    VALUES (
      ${randomUUID()},
      ${input.workspaceId},
      ${input.userId},
      ${input.type},
      ${input.title.trim()},
      ${input.description.trim()},
      ${input.tone},
      ${input.occurredAt ?? new Date().toISOString()}
    )
  `;
}

export async function getStoredMercadoLivreToken(workspaceId: string) {
  await ensurePlatformReady();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      workspace_id,
      access_token,
      refresh_token,
      user_id,
      scope,
      expires_at,
      updated_at
    FROM meli_oauth_tokens
    WHERE workspace_id = ${workspaceId}
    LIMIT 1
  `) as MercadoLivreTokenRow[];

  return rows[0] ?? null;
}

export async function saveMercadoLivreToken(input: {
  workspaceId: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  scope: string | null;
  expiresAt: string;
}) {
  await ensurePlatformReady();

  const sql = getSql();
  const rows = (await sql`
    INSERT INTO meli_oauth_tokens (
      workspace_id,
      access_token,
      refresh_token,
      user_id,
      scope,
      expires_at,
      created_at,
      updated_at
    )
    VALUES (
      ${input.workspaceId},
      ${input.accessToken},
      ${input.refreshToken},
      ${input.userId},
      ${input.scope},
      ${input.expiresAt},
      NOW(),
      NOW()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      user_id = EXCLUDED.user_id,
      scope = EXCLUDED.scope,
      expires_at = EXCLUDED.expires_at,
      updated_at = NOW()
    RETURNING
      workspace_id,
      access_token,
      refresh_token,
      user_id,
      scope,
      expires_at,
      updated_at
  `) as MercadoLivreTokenRow[];

  return rows[0] ?? null;
}

async function initializePlatform() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      platform_role TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_mode TEXT NOT NULL DEFAULT '3d',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspace_memberships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_role TEXT NOT NULL,
      invited_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, user_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspace_preferences (
      workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_by_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS calculation_snapshots (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS calculation_snapshots_workspace_saved_at_idx
    ON calculation_snapshots (workspace_id, saved_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS workspace_audit_events (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      tone TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx
    ON user_sessions (token_hash)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx
    ON password_reset_tokens (user_id, created_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS meli_oauth_tokens (
      workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await ensureBootstrapAdmin(sql);
}

async function ensureBootstrapAdmin(sql: ReturnType<typeof getSql>) {
  const bootstrapConfig = resolveBootstrapAdminConfig();

  if (!bootstrapConfig) {
    return;
  }

  const userCountRows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM users
  `) as Array<{ count: number }>;
  const userCount = Number(userCountRows[0]?.count ?? 0);

  if (userCount > 0) {
    return;
  }

  const userId = randomUUID();
  const workspaceId = randomUUID();
  const passwordHash = await hashPassword(bootstrapConfig.password);
  const workspaceName = bootstrapConfig.workspaceName;
  const workspaceSlug = slugify(workspaceName);
  const preferences = normalizeAppPreferences({
    ...defaultAppPreferences,
    workspaceName,
    operatorName: bootstrapConfig.fullName,
    operatorEmail: bootstrapConfig.email,
    onboardingCompleted: true,
  });

  await sql`
    INSERT INTO users (
      id,
      email,
      password_hash,
      full_name,
      platform_role,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${userId},
      ${bootstrapConfig.email},
      ${passwordHash},
      ${bootstrapConfig.fullName},
      'super_admin',
      'active',
      NOW(),
      NOW()
    )
  `;

  await sql`
    INSERT INTO workspaces (
      id,
      name,
      slug,
      owner_user_id,
      business_mode,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${workspaceId},
      ${workspaceName},
      ${workspaceSlug},
      ${userId},
      '3d',
      'active',
      NOW(),
      NOW()
    )
  `;

  await sql`
    INSERT INTO workspace_memberships (
      id,
      workspace_id,
      user_id,
      workspace_role,
      invited_by_user_id,
      created_at
    )
    VALUES (
      ${randomUUID()},
      ${workspaceId},
      ${userId},
      'owner',
      ${userId},
      NOW()
    )
  `;

  await sql`
    INSERT INTO workspace_preferences (
      workspace_id,
      data,
      updated_by_user_id,
      updated_at
    )
    VALUES (
      ${workspaceId},
      CAST(${JSON.stringify(preferences)} AS JSONB),
      ${userId},
      NOW()
    )
  `;

  await sql`
    INSERT INTO workspace_audit_events (
      id,
      workspace_id,
      user_id,
      type,
      title,
      description,
      tone,
      occurred_at
    )
    VALUES (
      ${randomUUID()},
      ${workspaceId},
      ${userId},
      'bootstrap-admin-created',
      'Admin inicial criado',
      'Primeiro usuário super admin e workspace inicial provisionados automaticamente.',
      'success',
      NOW()
    )
  `;
}

async function getWorkspaceSeatUsageCount(workspaceId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM workspace_memberships
    WHERE workspace_id = ${workspaceId}
  `) as Array<{ count: number }>;

  return Math.max(1, Number(rows[0]?.count ?? 1));
}

async function syncWorkspaceSeatUsage(
  workspaceId: string,
  updatedByUserId: string | null,
) {
  const sql = getSql();
  const currentPreferences = await getWorkspacePreferences(workspaceId);
  const nextPreferences = normalizeAppPreferences({
    ...currentPreferences,
    subscription: {
      ...currentPreferences.subscription,
      seatsUsed: await getWorkspaceSeatUsageCount(workspaceId),
    },
  });

  await sql`
    INSERT INTO workspace_preferences (
      workspace_id,
      data,
      updated_by_user_id,
      updated_at
    )
    VALUES (
      ${workspaceId},
      CAST(${JSON.stringify(nextPreferences)} AS JSONB),
      ${updatedByUserId},
      NOW()
    )
    ON CONFLICT (workspace_id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = NOW()
  `;
}

async function buildInvitedUserPasswordHash() {
  return hashPassword(randomBytes(24).toString("hex"));
}

function mapWorkspaceMemberRow(row: WorkspaceMemberLookupRow): WorkspaceMemberRecord {
  return {
    membershipId: row.membership_id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    platformRole: normalizePlatformRole(row.platform_role),
    userStatus: row.user_status,
    workspaceRole: normalizeWorkspaceRole(row.workspace_role),
    invitedByUserId: row.invited_by_user_id,
    invitedByName: row.invited_by_name,
    joinedAt: row.membership_created_at,
    lastLoginAt: row.last_login_at,
    isWorkspaceOwner: row.workspace_owner_user_id === row.user_id,
  };
}

function mapPlatformUserRow(row: PlatformUserLookupRow): PlatformUserRecord {
  return {
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    platformRole: normalizePlatformRole(row.platform_role),
    userStatus: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    workspaceCount: Number(row.workspace_count ?? 0),
    primaryWorkspaceId: row.primary_workspace_id,
    primaryWorkspaceName: row.primary_workspace_name,
    primaryWorkspaceSlug: row.primary_workspace_slug,
    primaryWorkspaceRole: row.primary_workspace_role
      ? normalizeWorkspaceRole(row.primary_workspace_role)
      : null,
  };
}

function sanitizeMemberName(fullName: string, email: string) {
  const trimmedName = fullName.trim();

  if (trimmedName.length > 0) {
    return trimmedName;
  }

  return email.split("@")[0] || "Novo membro";
}

function normalizeCalculationInput(item: SavedCalculation): SavedCalculation {
  const normalizedItem = normalizeSavedCalculation(item);

  if (!normalizedItem) {
    throw new Error("Cálculo inválido para persistência.");
  }

  return normalizedItem;
}

function normalizeCalculationPayload(
  value: SavedCalculation | string,
): SavedCalculation | null {
  try {
    const parsedValue =
      typeof value === "string"
        ? (JSON.parse(value) as SavedCalculation)
        : value;

    return normalizeSavedCalculation(parsedValue);
  } catch {
    return null;
  }
}

function normalizePreferencesPayload(value: AppPreferences | string) {
  try {
    const parsedValue =
      typeof value === "string"
        ? (JSON.parse(value) as Partial<AppPreferences>)
        : value;

    return normalizeAppPreferences(parsedValue);
  } catch {
    return defaultAppPreferences;
  }
}

function normalizePlatformRole(role: unknown): PlatformRole {
  return role === "super_admin" ||
    role === "platform_admin" ||
    role === "support_agent" ||
    role === "developer"
    ? role
    : "user";
}

function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveBootstrapAdminConfig() {
  const email = normalizeOptionalEnv(process.env.BOOTSTRAP_ADMIN_EMAIL);
  const password = normalizeOptionalEnv(process.env.BOOTSTRAP_ADMIN_PASSWORD);
  const fullName =
    normalizeOptionalEnv(process.env.BOOTSTRAP_ADMIN_NAME) ??
    "Administrador DaBi";
  const workspaceName =
    normalizeOptionalEnv(process.env.BOOTSTRAP_WORKSPACE_NAME) ??
    "Dabi Tech 3D";

  if (email && password) {
    return {
      email: normalizeEmail(email),
      password,
      fullName,
      workspaceName,
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return {
      email: "admin@dabitech3d.com",
      password: "admin123",
      fullName,
      workspaceName,
    };
  }

  return null;
}

function normalizeOptionalEnv(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

async function createUniqueWorkspaceSlug(
  workspaceName: string,
  excludeWorkspaceId?: string,
) {
  const sql = getSql();
  const baseSlug = slugify(workspaceName);

  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const rows = (await sql`
      SELECT id
      FROM workspaces
      WHERE slug = ${candidate}
  AND (
    ${excludeWorkspaceId ?? null}::text IS NULL
    OR id <> ${excludeWorkspaceId ?? null}
  )
LIMIT 1
    `) as Array<{ id: string }>;

    if (!rows[0]) {
      return candidate;
    }

    const suffixText = `-${suffix}`;
    candidate = `${baseSlug.slice(0, 64 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
}

function slugify(value: string) {
  const asciiValue = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = asciiValue
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || `workspace-${randomUUID().slice(0, 8)}`;
}

function isUniqueConstraintViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && error.code === "23505";
}