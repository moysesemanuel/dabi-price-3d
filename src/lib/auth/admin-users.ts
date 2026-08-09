import "server-only";

import { isSuperAdminSession } from "@/lib/auth/access-control";
import {
  listLocalDevelopmentPlatformUsers,
  removeLocalDevelopmentPlatformUser,
  updateLocalDevelopmentPlatformUserProfile,
  type LocalDevPlatformUser,
} from "@/lib/auth/local-dev-auth";
import {
  appendAuditEvent,
  deletePlatformUser,
  isPlatformPersistenceAvailable,
  listPlatformUsers,
  updatePlatformUserProfile,
  type AuthenticatedWorkspaceSession,
  type PlatformUserRecord,
} from "@/lib/server/platform";

export type AdminPlatformUser = PlatformUserRecord | LocalDevPlatformUser;

export type AdminUsersSnapshot = {
  session: {
    user: AuthenticatedWorkspaceSession["user"];
    workspace: AuthenticatedWorkspaceSession["workspace"];
  };
  summary: {
    totalUsers: number;
    activeUsers: number;
    invitedUsers: number;
    superAdmins: number;
  };
  users: AdminPlatformUser[];
};

export async function getAdminUsersSnapshot(
  session: AuthenticatedWorkspaceSession,
): Promise<AdminUsersSnapshot> {
  if (!isSuperAdminSession(session)) {
    throw new Error("FORBIDDEN_ADMIN_USERS");
  }

  const users = isPlatformPersistenceAvailable()
    ? await listPlatformUsers()
    : listLocalDevelopmentPlatformUsers();

  return {
    session: {
      user: session.user,
      workspace: session.workspace,
    },
    summary: buildAdminUsersSummary(users),
    users,
  };
}

export async function updatePlatformUserProfileForSession(input: {
  session: AuthenticatedWorkspaceSession;
  userId: string;
  fullName: string;
  email: string;
}) {
  if (!isSuperAdminSession(input.session)) {
    throw new Error("FORBIDDEN_ADMIN_USERS");
  }

  const updatedUser = isPlatformPersistenceAvailable()
    ? await updatePlatformUserProfile({
        userId: input.userId,
        fullName: input.fullName,
        email: input.email,
      })
    : updateLocalDevelopmentPlatformUserProfile({
        userId: input.userId,
        fullName: input.fullName,
        email: input.email,
      });

  if (!updatedUser) {
    return null;
  }

  if (isPlatformPersistenceAvailable()) {
    await appendAuditEvent({
      workspaceId: input.session.workspace.id,
      userId: input.session.user.id,
      type: "platform-user-profile-updated",
      title: "Cadastro de usuario atualizado",
      description: `${updatedUser.email} teve nome ou e-mail ajustado por super admin.`,
      tone: "neutral",
    });
  }

  return updatedUser;
}

export async function deletePlatformUserForSession(input: {
  session: AuthenticatedWorkspaceSession;
  userId: string;
}) {
  if (!isSuperAdminSession(input.session)) {
    throw new Error("FORBIDDEN_ADMIN_USERS");
  }

  if (input.userId === input.session.user.id) {
    throw new Error("CANNOT_DELETE_CURRENT_USER");
  }

  const removedUser = isPlatformPersistenceAvailable()
    ? await deletePlatformUser({
        userId: input.userId,
      })
    : removeLocalDevelopmentPlatformUser({
        userId: input.userId,
      });

  if (!removedUser) {
    return null;
  }

  if (isPlatformPersistenceAvailable()) {
    await appendAuditEvent({
      workspaceId: input.session.workspace.id,
      userId: input.session.user.id,
      type: "platform-user-deleted",
      title: "Usuario excluido",
      description: `${removedUser.email} foi removido da plataforma por super admin.`,
      tone: "warning",
    });
  }

  return removedUser;
}

function buildAdminUsersSummary(users: AdminPlatformUser[]) {
  return {
    totalUsers: users.length,
    activeUsers: users.filter((user) => user.userStatus === "active").length,
    invitedUsers: users.filter((user) => user.userStatus === "invited").length,
    superAdmins: users.filter((user) => user.platformRole === "super_admin").length,
  };
}
