import { isManagedWorkspaceRole, isSuperAdminSession } from "@/lib/auth/access-control";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  appendAuditEvent,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from "@/lib/server/platform";

export async function PATCH(request: Request, context: { params: Promise<{ workspaceId: string; memberId: string }> }) {
  const session = await getCurrentAuthSession();
  if (!session) return Response.json({ error: "Nao autenticado." }, { status: 401 });
  if (!isSuperAdminSession(session)) return Response.json({ error: "Acao exclusiva para super admin." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { workspaceRole?: string } | null;
  if (!body?.workspaceRole || !isManagedWorkspaceRole(body.workspaceRole)) {
    return Response.json({ error: "Role invalida." }, { status: 400 });
  }

  try {
    const { workspaceId, memberId } = await context.params;
    const member = await updateWorkspaceMemberRole({
      workspaceId,
      membershipId: memberId,
      workspaceRole: body.workspaceRole,
      updatedByUserId: session.user.id,
    });
    if (!member) return Response.json({ error: "Membership nao encontrada." }, { status: 404 });
    await appendAuditEvent({
      workspaceId,
      userId: session.user.id,
      type: body.workspaceRole === "owner"
        ? "workspace-ownership-transferred-by-super-admin"
        : "workspace-membership-role-updated-by-super-admin",
      title: body.workspaceRole === "owner"
        ? "Ownership do workspace transferido"
        : "Role de membership atualizada",
      description: `Super admin definiu a role de ${member.email} como ${member.workspaceRole}.`,
      tone: "neutral",
    });
    return Response.json({ member });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED") {
      return Response.json({ error: "Transfira ownership antes de alterar ou remover o owner." }, { status: 409 });
    }
    return Response.json({ error: "Role invalida." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ workspaceId: string; memberId: string }> }) {
  const session = await getCurrentAuthSession();
  if (!session) return Response.json({ error: "Nao autenticado." }, { status: 401 });
  if (!isSuperAdminSession(session)) return Response.json({ error: "Acao exclusiva para super admin." }, { status: 403 });
  const { workspaceId, memberId } = await context.params;
  try {
    const member = await removeWorkspaceMember({ workspaceId, membershipId: memberId, removedByUserId: session.user.id });
    if (!member) return Response.json({ error: "Membership nao encontrada." }, { status: 404 });
    await appendAuditEvent({
      workspaceId,
      userId: session.user.id,
      type: "workspace-membership-removed-by-super-admin",
      title: "Membership removida",
      description: `Super admin removeu ${member.email} do workspace.`,
      tone: "warning",
    });
    return Response.json({ member });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED") {
      return Response.json({ error: "Transfira ownership antes de alterar ou remover o owner." }, { status: 409 });
    }
    return Response.json({ error: "Nao foi possivel remover a membership." }, { status: 400 });
  }
}
