import { getAdminUsersSnapshot } from "@/lib/auth/admin-users";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export async function GET() {
  const session = await requireCurrentAuthSession();

  try {
    const snapshot = await getAdminUsersSnapshot(session);
    return Response.json(snapshot);
  } catch (error) {
    return Response.json(
      { error: mapAdminUsersError(error) },
      { status: mapAdminUsersStatus(error) },
    );
  }
}

function mapAdminUsersError(error: unknown) {
  if (error instanceof Error && error.message === "FORBIDDEN_ADMIN_USERS") {
    return "A listagem administrativa de usuarios e exclusiva para super admin.";
  }

  return "Falha ao carregar usuarios da plataforma.";
}

function mapAdminUsersStatus(error: unknown) {
  if (error instanceof Error && error.message === "FORBIDDEN_ADMIN_USERS") {
    return 403;
  }

  return 500;
}
