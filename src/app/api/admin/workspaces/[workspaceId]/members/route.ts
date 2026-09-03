import { inviteWorkspaceMemberAsSuperAdmin } from "@/lib/auth/admin-workspaces";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";

export async function POST(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const session = await getCurrentAuthSession();
  if (!session) return Response.json({ error: "Nao autenticado." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { fullName?: string; email?: string; workspaceRole?: string } | null;
  if (!body?.fullName?.trim() || !body.email?.includes("@") || !body.workspaceRole) return Response.json({ error: "Dados do convite invalidos." }, { status: 400 });
  try {
    const { workspaceId } = await context.params;
    const workspace = (await createBillingAdminService().getSnapshot(session)).workspaces.find((item) => item.workspaceId === workspaceId);
    if (!workspace) return Response.json({ error: "Workspace nao encontrado." }, { status: 404 });
    const result = await inviteWorkspaceMemberAsSuperAdmin({
      session,
      workspace: { id: workspace.workspaceId, name: workspace.workspaceName, slug: workspace.workspaceSlug },
      fullName: body.fullName,
      email: body.email,
      workspaceRole: body.workspaceRole,
      baseUrl: new URL(request.url).origin,
    });
    return Response.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = message === "FORBIDDEN_ADMIN_WORKSPACES" || message === "FORBIDDEN_ROLE_ASSIGNMENT" ? 403 : message === "MEMBER_ALREADY_EXISTS" || message === "SEAT_LIMIT_REACHED" ? 409 : 400;
    return Response.json({ error: "Falha ao convidar membro." }, { status });
  }
}
