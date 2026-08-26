import { isSuperAdminSession, normalizeWorkspaceRole } from "@/lib/auth/access-control";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  appendAuditEvent,
  findWorkspaceMemberById,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from "@/lib/server/platform";

export async function PATCH(request: Request, context: { params: Promise<{ workspaceId: string; memberId: string }> }) {
  const session = await getCurrentAuthSession();
  if (!session) return Response.json({ error: "Nao autenticado." }, { status: 401 });
  if (!isSuperAdminSession(session)) return Response.json({ error: "Acao exclusiva para super admin." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { workspaceRole?: string } | null;
  if (!body?.workspaceRole) return Response.json({ error: "Role invalida." }, { status: 400 });

  try {
    const { workspaceId, memberId } = await context.params;
    const previous = await findWorkspaceMemberById({ workspaceId, membershipId: memberId });
    if (!previous) return Response.json({ error: "Membership nao encontrada." }, { status: 404 });
    const member = await updateWorkspaceMemberRole({
      workspaceId,
      membershipId: memberId,
      workspaceRole: normalizeWorkspaceRole(body.workspaceRole),
      updatedByUserId: session.user.id,
    });
    await appendAuditEvent({
      workspaceId,
      userId: session.user.id,
      type: "workspace-membership-role-updated-by-super-admin",
      title: "Role de membership atualizada",
      description: `Super admin alterou a role de ${previous.email} de ${previous.workspaceRole} para ${member?.workspaceRole ?? body.workspaceRole}.`,
      tone: "neutral",
    });
    return Response.json({ member });
  } catch {
    return Response.json({ error: "Role invalida." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ workspaceId: string; memberId: string }> }) {
  const session = await getCurrentAuthSession();
  if (!session) return Response.json({ error: "Nao autenticado." }, { status: 401 });
  if (!isSuperAdminSession(session)) return Response.json({ error: "Acao exclusiva para super admin." }, { status: 403 });
  const { workspaceId, memberId } = await context.params;
  const target = await findWorkspaceMemberById({ workspaceId, membershipId: memberId });
  if (!target) return Response.json({ error: "Membership nao encontrada." }, { status: 404 });
  if (target.isWorkspaceOwner) return Response.json({ error: "Transfira ownership antes de remover o owner." }, { status: 409 });
  const member = await removeWorkspaceMember({ workspaceId, membershipId: memberId, removedByUserId: session.user.id });
  await appendAuditEvent({
    workspaceId,
    userId: session.user.id,
    type: "workspace-membership-removed-by-super-admin",
    title: "Membership removida",
    description: `Super admin removeu ${target.email} do workspace.`,
    tone: "warning",
  });
  return Response.json({ member });
}
