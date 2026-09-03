import "server-only";

import { isSuperAdminSession } from "@/lib/auth/access-control";
import {
  inviteWorkspaceMemberForSession,
  updateWorkspaceMemberRoleForSession,
} from "@/lib/auth/workspace-members";
import { listWorkspaceMembers, type AuthenticatedWorkspaceSession } from "@/lib/server/platform";

function targetWorkspaceSession(session: AuthenticatedWorkspaceSession, workspace: { id: string; name: string; slug: string }) {
  if (!isSuperAdminSession(session)) throw new Error("FORBIDDEN_ADMIN_WORKSPACES");
  return { ...session, workspace: { ...workspace, role: "owner" } };
}

export async function inviteWorkspaceMemberAsSuperAdmin(input: {
  session: AuthenticatedWorkspaceSession;
  workspace: { id: string; name: string; slug: string };
  fullName: string;
  email: string;
  workspaceRole: string;
  baseUrl: string;
}) {
  return inviteWorkspaceMemberForSession({
    ...input,
    session: targetWorkspaceSession(input.session, input.workspace),
  });
}

export async function transferWorkspaceOwnershipAsSuperAdmin(input: {
  session: AuthenticatedWorkspaceSession;
  workspace: { id: string; name: string; slug: string };
  membershipId: string;
}) {
  return updateWorkspaceMemberRoleForSession({
    session: targetWorkspaceSession(input.session, input.workspace),
    membershipId: input.membershipId,
    workspaceRole: "owner",
  });
}

export async function getAdminWorkspaceMembers(input: { session: AuthenticatedWorkspaceSession; workspaceId: string }) {
  if (!isSuperAdminSession(input.session)) throw new Error("FORBIDDEN_ADMIN_WORKSPACES");
  return listWorkspaceMembers(input.workspaceId);
}
