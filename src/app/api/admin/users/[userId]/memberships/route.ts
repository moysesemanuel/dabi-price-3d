import { getAdminUserMembershipsForSession } from "@/lib/auth/admin-users";
import { getCurrentAuthSession } from "@/lib/auth/session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getCurrentAuthSession();
  if (!session) return Response.json({ error: "Nao autenticado." }, { status: 401 });

  try {
    const { userId } = await context.params;
    const memberships = await getAdminUserMembershipsForSession({ session, userId });
    if (!memberships) {
      return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }
    return Response.json({ memberships });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error && error.message === "FORBIDDEN_ADMIN_USERS" ? "Acao exclusiva para super admin." : "Falha ao carregar memberships." },
      { status: error instanceof Error && error.message === "FORBIDDEN_ADMIN_USERS" ? 403 : 500 },
    );
  }
}
