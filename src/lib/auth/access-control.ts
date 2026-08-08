import type { AuthenticatedWorkspaceSession, PlatformRole } from "@/lib/server/platform";
import type { WorkspaceRole } from "@/lib/workspace/catalog";

export type ManagedWorkspaceRole = WorkspaceRole;

export function normalizeWorkspaceRole(role: unknown): ManagedWorkspaceRole {
  return role === "owner" || role === "manager" ? role : "operator";
}

export function isSuperAdminRole(role: PlatformRole | string) {
  return role === "super_admin";
}

export function isSuperAdminSession(
  session: Pick<AuthenticatedWorkspaceSession, "user">,
) {
  return isSuperAdminRole(session.user.platformRole);
}

export function getMemberManagementPermissions(
  session: Pick<AuthenticatedWorkspaceSession, "user" | "workspace">,
) {
  const workspaceRole = normalizeWorkspaceRole(session.workspace.role);
  const isSuperAdmin = isSuperAdminSession(session);

  return {
    isSuperAdmin,
    workspaceRole,
    canManageMembers:
      isSuperAdmin || workspaceRole === "owner" || workspaceRole === "manager",
    canInviteManagers: isSuperAdmin || workspaceRole === "owner",
    canInviteOperators:
      isSuperAdmin || workspaceRole === "owner" || workspaceRole === "manager",
    canTransferOwnership: isSuperAdmin || workspaceRole === "owner",
  };
}

export function getAllowedInviteRoles(
  session: Pick<AuthenticatedWorkspaceSession, "user" | "workspace">,
) {
  const permissions = getMemberManagementPermissions(session);
  const allowedRoles: ManagedWorkspaceRole[] = [];

  if (permissions.canInviteManagers) {
    allowedRoles.push("manager");
  }

  if (permissions.canInviteOperators) {
    allowedRoles.push("operator");
  }

  return allowedRoles;
}

export function canAssignWorkspaceRole(input: {
  actor: Pick<AuthenticatedWorkspaceSession, "user" | "workspace">;
  currentRole: ManagedWorkspaceRole;
  nextRole: ManagedWorkspaceRole;
  isCurrentUser: boolean;
}) {
  if (input.currentRole === "owner" && input.nextRole !== "owner") {
    return false;
  }

  if (isSuperAdminSession(input.actor)) {
    return true;
  }

  const actorRole = normalizeWorkspaceRole(input.actor.workspace.role);

  if (actorRole === "owner") {
    if (input.currentRole === "owner" && !input.isCurrentUser) {
      return false;
    }

    if (input.nextRole === "owner") {
      return input.currentRole === "manager" || input.currentRole === "operator";
    }

    return input.currentRole === "manager" || input.currentRole === "operator";
  }

  return false;
}

export function canRemoveWorkspaceMember(input: {
  actor: Pick<AuthenticatedWorkspaceSession, "user" | "workspace">;
  targetRole: ManagedWorkspaceRole;
  isCurrentUser: boolean;
}) {
  if (isSuperAdminSession(input.actor)) {
    return input.targetRole !== "owner" && !input.isCurrentUser;
  }

  const actorRole = normalizeWorkspaceRole(input.actor.workspace.role);

  if (actorRole === "owner") {
    return input.targetRole !== "owner" && !input.isCurrentUser;
  }

  if (actorRole === "manager") {
    return input.targetRole === "operator" && !input.isCurrentUser;
  }

  return false;
}

export function describeWorkspaceAccessLevel(input: {
  platformRole: PlatformRole | string;
  workspaceRole: WorkspaceRole | string;
}) {
  if (isSuperAdminRole(input.platformRole)) {
    return {
      label: "Super admin",
      description:
        "Acesso irrestrito à plataforma e às regras administrativas do workspace.",
    };
  }

  const workspaceRole = normalizeWorkspaceRole(input.workspaceRole);

  if (workspaceRole === "owner") {
    return {
      label: "Owner",
      description:
        "Controla governança do workspace, ownership e administração dos membros.",
    };
  }

  if (workspaceRole === "manager") {
    return {
      label: "Manager",
      description:
        "Coordena a operação e gerencia operadores, sem alterar ownership.",
    };
  }

  return {
    label: "Operator",
    description: "Usa a operação diária, sem permissões administrativas.",
  };
}
