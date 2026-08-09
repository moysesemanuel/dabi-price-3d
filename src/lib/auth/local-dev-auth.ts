import { randomBytes } from "node:crypto";
import type { AuthenticatedWorkspaceSession, PlatformRole } from "@/lib/server/platform";

type LocalDevUserStatus = "active" | "invited";
type LocalDevWorkspaceRole = "owner" | "manager" | "operator";

type LocalDevUserRecord = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  platformRole: PlatformRole;
  status: LocalDevUserStatus;
  workspaceRole: LocalDevWorkspaceRole;
  invitedByUserId: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

type LocalDevResetTokenRecord = {
  email: string;
  expiresAt: number;
};

export type LocalDevWorkspaceMember = {
  membershipId: string;
  workspaceId: string;
  userId: string;
  email: string;
  fullName: string;
  platformRole: PlatformRole;
  userStatus: LocalDevUserStatus;
  workspaceRole: LocalDevWorkspaceRole;
  invitedByUserId: string | null;
  invitedByName: string | null;
  joinedAt: string;
  lastLoginAt: string | null;
  isWorkspaceOwner: boolean;
};

export type LocalDevPlatformUser = {
  userId: string;
  email: string;
  fullName: string;
  platformRole: PlatformRole;
  userStatus: LocalDevUserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  workspaceCount: number;
  primaryWorkspaceId: string | null;
  primaryWorkspaceName: string | null;
  primaryWorkspaceSlug: string | null;
  primaryWorkspaceRole: LocalDevWorkspaceRole | null;
};

const LOCAL_DEV_RESET_TOKEN_TTL_MS = 1000 * 60 * 30;

const localDevUsers = new Map<string, LocalDevUserRecord>();
const localDevResetTokens = new Map<string, LocalDevResetTokenRecord>();

export function isLocalDevelopmentAuthEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function getLocalDevelopmentBootstrapConfig() {
  return {
    email:
      normalizeOptionalEnv(process.env.BOOTSTRAP_ADMIN_EMAIL)?.toLowerCase() ??
      "admin@dabitech3d.com",
    password:
      normalizeOptionalEnv(process.env.BOOTSTRAP_ADMIN_PASSWORD) ?? "admin123",
    fullName:
      normalizeOptionalEnv(process.env.BOOTSTRAP_ADMIN_NAME) ??
      "Administrador DaBi",
    workspaceName:
      normalizeOptionalEnv(process.env.BOOTSTRAP_WORKSPACE_NAME) ??
      "Dabi Tech 3D",
  };
}

export function resetLocalDevelopmentAuthStateForTests() {
  localDevUsers.clear();
  localDevResetTokens.clear();
}

export function verifyLocalDevelopmentCredentials(input: {
  email: string;
  password: string;
}) {
  if (!isLocalDevelopmentAuthEnabled()) {
    return false;
  }

  const user = getLocalDevelopmentUser(input.email);

  return Boolean(
    user && user.status === "active" && input.password === user.password,
  );
}

export function createLocalDevelopmentSession(input: { email: string }) {
  if (!isLocalDevelopmentAuthEnabled()) {
    return null;
  }

  const user = getLocalDevelopmentUser(input.email);

  if (!user || user.status !== "active") {
    return null;
  }

  user.lastLoginAt = new Date().toISOString();
  localDevUsers.set(user.email, user);
  const sessionToken = buildLocalDevelopmentSessionToken(user.email);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  return {
    sessionToken,
    expiresAt,
    session: buildLocalDevelopmentSession(user.email),
  };
}

export function resolveLocalDevelopmentSession(sessionToken: string) {
  if (!isLocalDevelopmentAuthEnabled()) {
    return null;
  }

  ensureLocalDevelopmentBootstrapState();
  const email = parseLocalDevelopmentSessionToken(sessionToken);

  return email ? buildLocalDevelopmentSession(email) : null;
}

export function deleteLocalDevelopmentSession() {}

export function buildLocalDevelopmentSession(
  email?: string,
): AuthenticatedWorkspaceSession {
  const config = getLocalDevelopmentBootstrapConfig();
  const user =
    (email ? getLocalDevelopmentUser(email) : null) ??
    getLocalDevelopmentUser(config.email);

  if (!user) {
    throw new Error("Local development admin user is unavailable.");
  }

  return {
    sessionId: `local-dev-session:${user.id}`,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      platformRole: user.platformRole,
      status: user.status,
    },
    workspace: {
      id: "local-dev-workspace",
      name: config.workspaceName,
      slug: slugify(config.workspaceName),
      role: user.workspaceRole,
    },
  };
}

export function listLocalDevelopmentWorkspaceMembers() {
  ensureLocalDevelopmentBootstrapState();
  const users = Array.from(localDevUsers.values());
  const ownerUserId = resolveLocalDevelopmentOwnerUserId();

  return users
    .map((user) => ({
      membershipId: user.id,
      workspaceId: "local-dev-workspace",
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      platformRole: user.platformRole,
      userStatus: user.status,
      workspaceRole: user.workspaceRole,
      invitedByUserId: user.invitedByUserId,
      invitedByName: user.invitedByUserId
        ? findLocalDevelopmentUserById(user.invitedByUserId)?.fullName ?? null
        : null,
      joinedAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isWorkspaceOwner: user.id === ownerUserId,
    }))
    .sort((left, right) => compareWorkspaceRoles(left.workspaceRole, right.workspaceRole));
}

export function listLocalDevelopmentPlatformUsers() {
  ensureLocalDevelopmentBootstrapState();
  const config = getLocalDevelopmentBootstrapConfig();

  return Array.from(localDevUsers.values())
    .map((user) => ({
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      platformRole: user.platformRole,
      userStatus: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      workspaceCount: 1,
      primaryWorkspaceId: "local-dev-workspace",
      primaryWorkspaceName: config.workspaceName,
      primaryWorkspaceSlug: slugify(config.workspaceName),
      primaryWorkspaceRole: user.workspaceRole,
    }))
    .sort((left, right) => comparePlatformUsers(left, right));
}

export function findLocalDevelopmentWorkspaceMemberById(membershipId: string) {
  return (
    listLocalDevelopmentWorkspaceMembers().find(
      (member) => member.membershipId === membershipId,
    ) ?? null
  );
}

export function inviteLocalDevelopmentWorkspaceMember(input: {
  fullName: string;
  email: string;
  workspaceRole: LocalDevWorkspaceRole;
  invitedByUserId: string;
}) {
  ensureLocalDevelopmentBootstrapState();

  const normalizedEmail = normalizeEmail(input.email);

  if (localDevUsers.has(normalizedEmail)) {
    throw new Error("MEMBER_ALREADY_EXISTS");
  }

  const nextUser: LocalDevUserRecord = {
    id: randomBytes(12).toString("hex"),
    email: normalizedEmail,
    password: randomBytes(18).toString("base64url"),
    fullName: sanitizeMemberName(input.fullName, normalizedEmail),
    platformRole: "user",
    status: "invited",
    workspaceRole: input.workspaceRole,
    invitedByUserId: input.invitedByUserId,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };

  localDevUsers.set(nextUser.email, nextUser);

  return toLocalDevelopmentWorkspaceMember(nextUser);
}

export function updateLocalDevelopmentWorkspaceMemberRole(input: {
  membershipId: string;
  workspaceRole: LocalDevWorkspaceRole;
}) {
  ensureLocalDevelopmentBootstrapState();

  const user = findLocalDevelopmentUserById(input.membershipId);

  if (!user) {
    return null;
  }

  if (input.workspaceRole === "owner") {
    const currentOwner = findLocalDevelopmentUserById(resolveLocalDevelopmentOwnerUserId());

    if (currentOwner) {
      currentOwner.workspaceRole = "manager";
      localDevUsers.set(currentOwner.email, currentOwner);
    }
  }

  user.workspaceRole = input.workspaceRole;
  localDevUsers.set(user.email, user);

  return toLocalDevelopmentWorkspaceMember(user);
}

export function updateLocalDevelopmentWorkspaceMemberProfile(input: {
  membershipId: string;
  fullName: string;
  email: string;
}) {
  ensureLocalDevelopmentBootstrapState();

  const user = findLocalDevelopmentUserById(input.membershipId);

  if (!user) {
    return null;
  }

  const normalizedEmail = normalizeEmail(input.email);
  const nextFullName = sanitizeMemberName(input.fullName, normalizedEmail);
  const existingUser = getLocalDevelopmentUser(normalizedEmail);

  if (existingUser && existingUser.id !== user.id) {
    throw new Error("EMAIL_ALREADY_IN_USE");
  }

  const previousEmail = user.email;

  if (user.email !== normalizedEmail) {
    localDevUsers.delete(user.email);
  }

  user.email = normalizedEmail;
  user.fullName = nextFullName;
  localDevUsers.set(user.email, user);

  for (const resetToken of localDevResetTokens.values()) {
    if (resetToken.email === previousEmail) {
      resetToken.email = user.email;
    }
  }

  return toLocalDevelopmentWorkspaceMember(user);
}

export function updateLocalDevelopmentPlatformUserProfile(input: {
  userId: string;
  fullName: string;
  email: string;
}) {
  const updatedMember = updateLocalDevelopmentWorkspaceMemberProfile({
    membershipId: input.userId,
    fullName: input.fullName,
    email: input.email,
  });

  if (!updatedMember) {
    return null;
  }

  return toLocalDevelopmentPlatformUser(
    findLocalDevelopmentUserById(updatedMember.userId) ?? null,
  );
}

export function removeLocalDevelopmentPlatformUser(input: { userId: string }) {
  ensureLocalDevelopmentBootstrapState();

  const user = findLocalDevelopmentUserById(input.userId);

  if (!user) {
    return null;
  }

  if (user.workspaceRole === "owner") {
    throw new Error("OWNER_USER_DELETE_FORBIDDEN");
  }

  localDevUsers.delete(user.email);

  for (const [token, resetToken] of localDevResetTokens.entries()) {
    if (resetToken.email === user.email) {
      localDevResetTokens.delete(token);
    }
  }

  return toLocalDevelopmentPlatformUser(user);
}

export function removeLocalDevelopmentWorkspaceMember(input: {
  membershipId: string;
}) {
  ensureLocalDevelopmentBootstrapState();

  const user = findLocalDevelopmentUserById(input.membershipId);

  if (!user) {
    return null;
  }

  localDevUsers.delete(user.email);

  for (const [token, resetToken] of localDevResetTokens.entries()) {
    if (resetToken.email === user.email) {
      localDevResetTokens.delete(token);
    }
  }

  return toLocalDevelopmentWorkspaceMember(user);
}

export function createLocalDevelopmentPasswordResetToken(input: { email: string }) {
  if (!isLocalDevelopmentAuthEnabled()) {
    return null;
  }

  const user = getLocalDevelopmentUser(input.email);

  if (!user) {
    return null;
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + LOCAL_DEV_RESET_TOKEN_TTL_MS;

  localDevResetTokens.set(token, {
    email: user.email,
    expiresAt,
  });

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    email: user.email,
  };
}

export function verifyLocalDevelopmentPasswordResetToken(token: string) {
  if (!isLocalDevelopmentAuthEnabled()) {
    return null;
  }

  const record = localDevResetTokens.get(token);

  if (!record) {
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    localDevResetTokens.delete(token);
    return null;
  }

  const user = getLocalDevelopmentUser(record.email);

  if (!user) {
    localDevResetTokens.delete(token);
    return null;
  }

  return {
    email: user.email,
    expiresAt: new Date(record.expiresAt).toISOString(),
    status: user.status,
  };
}

export function consumeLocalDevelopmentPasswordResetToken(input: {
  token: string;
  password: string;
}) {
  const verifiedToken = verifyLocalDevelopmentPasswordResetToken(input.token);

  if (!verifiedToken) {
    return null;
  }

  const user = getLocalDevelopmentUser(verifiedToken.email);

  if (!user) {
    return null;
  }

  user.password = input.password;
  user.status = "active";
  localDevUsers.set(user.email, user);
  localDevResetTokens.delete(input.token);

  return {
    email: user.email,
    status: verifiedToken.status,
  };
}

function ensureLocalDevelopmentBootstrapState() {
  if (!isLocalDevelopmentAuthEnabled()) {
    return;
  }

  const config = getLocalDevelopmentBootstrapConfig();
  const currentAdmin = localDevUsers.get(config.email);

  if (currentAdmin) {
    currentAdmin.fullName = config.fullName;
    currentAdmin.platformRole = "super_admin";
    currentAdmin.status = "active";
    localDevUsers.set(config.email, currentAdmin);
    return;
  }

  localDevUsers.set(config.email, {
    id: "local-dev-admin",
    email: config.email,
    password: config.password,
    fullName: config.fullName,
    platformRole: "super_admin",
    status: "active",
    workspaceRole: "owner",
    invitedByUserId: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  });
}

function getLocalDevelopmentUser(email: string) {
  ensureLocalDevelopmentBootstrapState();
  return localDevUsers.get(normalizeEmail(email)) ?? null;
}

function findLocalDevelopmentUserById(userId: string) {
  ensureLocalDevelopmentBootstrapState();

  for (const user of localDevUsers.values()) {
    if (user.id === userId) {
      return user;
    }
  }

  return null;
}

function resolveLocalDevelopmentOwnerUserId() {
  ensureLocalDevelopmentBootstrapState();
  const owner =
    Array.from(localDevUsers.values()).find((user) => user.workspaceRole === "owner") ??
    getLocalDevelopmentUser(getLocalDevelopmentBootstrapConfig().email);

  if (!owner) {
    throw new Error("Local development owner is unavailable.");
  }

  return owner.id;
}

function toLocalDevelopmentWorkspaceMember(
  user: LocalDevUserRecord,
): LocalDevWorkspaceMember {
  return {
    membershipId: user.id,
    workspaceId: "local-dev-workspace",
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    platformRole: user.platformRole,
    userStatus: user.status,
    workspaceRole: user.workspaceRole,
    invitedByUserId: user.invitedByUserId,
    invitedByName: user.invitedByUserId
      ? findLocalDevelopmentUserById(user.invitedByUserId)?.fullName ?? null
      : null,
    joinedAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    isWorkspaceOwner: user.id === resolveLocalDevelopmentOwnerUserId(),
  };
}

function toLocalDevelopmentPlatformUser(
  user: LocalDevUserRecord | null,
): LocalDevPlatformUser | null {
  if (!user) {
    return null;
  }

  const config = getLocalDevelopmentBootstrapConfig();

  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    platformRole: user.platformRole,
    userStatus: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    workspaceCount: 1,
    primaryWorkspaceId: "local-dev-workspace",
    primaryWorkspaceName: config.workspaceName,
    primaryWorkspaceSlug: slugify(config.workspaceName),
    primaryWorkspaceRole: user.workspaceRole,
  };
}

function compareWorkspaceRoles(
  left: LocalDevWorkspaceRole,
  right: LocalDevWorkspaceRole,
) {
  return roleRank[left] - roleRank[right];
}

const roleRank: Record<LocalDevWorkspaceRole, number> = {
  owner: 0,
  manager: 1,
  operator: 2,
};

const platformRoleRank: Record<PlatformRole, number> = {
  super_admin: 0,
  platform_admin: 1,
  support_agent: 2,
  developer: 3,
  user: 4,
};

function comparePlatformUsers(left: LocalDevPlatformUser, right: LocalDevPlatformUser) {
  return (
    platformRoleRank[left.platformRole] - platformRoleRank[right.platformRole] ||
    Date.parse(left.createdAt) - Date.parse(right.createdAt)
  );
}

function sanitizeMemberName(fullName: string, email: string) {
  const trimmedName = fullName.trim();

  if (trimmedName.length > 0) {
    return trimmedName;
  }

  return email.split("@")[0] || "Novo membro";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildLocalDevelopmentSessionToken(email: string) {
  return `local-dev-session:${Buffer.from(normalizeEmail(email)).toString("base64url")}`;
}

function parseLocalDevelopmentSessionToken(token: string) {
  if (!token.startsWith("local-dev-session:")) {
    return null;
  }

  try {
    const encodedEmail = token.slice("local-dev-session:".length);
    const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
    const user = getLocalDevelopmentUser(email);

    return user && user.status === "active" ? user.email : null;
  } catch {
    return null;
  }
}

function normalizeOptionalEnv(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function slugify(value: string) {
  const asciiValue = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return asciiValue.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "local-dev-workspace";
}
