import { isSuperAdminSession } from "@/lib/auth/access-control";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  appendAuditEvent,
  listWorkspaceMembers,
  updateWorkspaceName,
} from "@/lib/server/platform";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getCurrentAuthSession();
  if (!session) return Response.json({ error: "Nao autenticado." }, { status: 401 });
  if (!isSuperAdminSession(session)) return Response.json({ error: "Acao exclusiva para super admin." }, { status: 403 });

  const { workspaceId } = await context.params;
  return Response.json({ memberships: await listWorkspaceMembers(workspaceId) });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getCurrentAuthSession();
  if (!session) return Response.json({ error: "Nao autenticado." }, { status: 401 });
  if (!isSuperAdminSession(session)) return Response.json({ error: "Acao exclusiva para super admin." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  if (!body?.name?.trim()) return Response.json({ error: "Informe o nome do workspace." }, { status: 400 });

  try {
    const { workspaceId } = await context.params;
    const workspace = await updateWorkspaceName({ workspaceId, name: body.name });
    if (!workspace) return Response.json({ error: "Workspace nao encontrado." }, { status: 404 });

    await appendAuditEvent({
      workspaceId,
      userId: session.user.id,
      type: "workspace-name-updated-by-super-admin",
      title: "Nome do workspace atualizado",
      description: `Super admin alterou o nome do workspace para ${workspace.name}.`,
      tone: "neutral",
    });
    return Response.json({ workspace });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error && error.message === "WORKSPACE_NAME_REQUIRED" ? "Informe o nome do workspace." : "Falha ao atualizar workspace." },
      { status: 400 },
    );
  }
}
