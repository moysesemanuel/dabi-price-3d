import {
  deletePlatformUserForSession,
  revokePlatformUserSessionsForSession,
  updatePlatformUserStatusForSession,
  updatePlatformUserProfileForSession,
} from "@/lib/auth/admin-users";
import { getCurrentAuthSession } from "@/lib/auth/session";

type UpdatePlatformUserPayload = {
  fullName?: string;
  email?: string;
};

type AdminUserActionPayload = {
  action?: "set_status" | "revoke_sessions";
  status?: "active" | "disabled";
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const { userId } = await context.params;
  let body: UpdatePlatformUserPayload;

  try {
    body = (await request.json()) as UpdatePlatformUserPayload;
  } catch {
    return Response.json({ error: "Payload invalido." }, { status: 400 });
  }

  const fullName = body.fullName?.trim() ?? "";
  const email = body.email?.trim() ?? "";

  if (!fullName) {
    return Response.json(
      { error: "Informe o nome do usuario." },
      { status: 400 },
    );
  }

  if (!email || !email.includes("@")) {
    return Response.json(
      { error: "Informe um e-mail valido para o usuario." },
      { status: 400 },
    );
  }

  try {
    const user = await updatePlatformUserProfileForSession({
      session,
      userId,
      fullName,
      email,
    });

    if (!user) {
      return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    return Response.json({ user });
  } catch (error) {
    return Response.json(
      { error: mapAdminUserMutationError(error) },
      { status: mapAdminUserMutationStatus(error) },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const { userId } = await context.params;

  try {
    const user = await deletePlatformUserForSession({
      session,
      userId,
    });

    if (!user) {
      return Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    return Response.json({ user });
  } catch (error) {
    return Response.json(
      { error: mapAdminUserMutationError(error) },
      { status: mapAdminUserMutationStatus(error) },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const { userId } = await context.params;
  let body: AdminUserActionPayload;

  try {
    body = (await request.json()) as AdminUserActionPayload;
  } catch {
    return Response.json({ error: "Payload invalido." }, { status: 400 });
  }

  try {
    if (body.action === "set_status") {
      if (body.status !== "active" && body.status !== "disabled") {
        return Response.json({ error: "Status invalido." }, { status: 400 });
      }

      const user = await updatePlatformUserStatusForSession({
        session,
        userId,
        status: body.status,
      });

      return user
        ? Response.json({ user })
        : Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    if (body.action === "revoke_sessions") {
      const result = await revokePlatformUserSessionsForSession({ session, userId });

      return result
        ? Response.json(result)
        : Response.json({ error: "Usuario nao encontrado." }, { status: 404 });
    }

    return Response.json({ error: "Acao invalida." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: mapAdminUserMutationError(error) },
      { status: mapAdminUserMutationStatus(error) },
    );
  }
}

function mapAdminUserMutationError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha ao atualizar usuario.";
  }

  switch (error.message) {
    case "FORBIDDEN_ADMIN_USERS":
      return "A edicao administrativa de usuarios e exclusiva para super admin.";
    case "EMAIL_ALREADY_IN_USE":
      return "Esse e-mail ja esta em uso por outro usuario.";
    case "CANNOT_DELETE_CURRENT_USER":
      return "Sua propria conta nao pode ser excluida por essa tela.";
    case "CANNOT_DISABLE_CURRENT_USER":
      return "Sua propria conta nao pode ser desativada por essa tela.";
    case "LAST_SUPER_ADMIN_PROTECTED":
      return "A ultima conta super admin nao pode ser removida ou desativada.";
    case "ADMIN_USER_ACTION_REQUIRES_PERSISTENCE":
      return "Esta acao exige persistencia de producao.";
    case "OWNER_USER_DELETE_FORBIDDEN":
      return "Nao e permitido excluir um usuario owner de workspace.";
    default:
      return "Falha ao atualizar usuario.";
  }
}

function mapAdminUserMutationStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  switch (error.message) {
    case "FORBIDDEN_ADMIN_USERS":
      return 403;
    case "EMAIL_ALREADY_IN_USE":
      return 409;
    case "CANNOT_DELETE_CURRENT_USER":
    case "CANNOT_DISABLE_CURRENT_USER":
    case "OWNER_USER_DELETE_FORBIDDEN":
    case "LAST_SUPER_ADMIN_PROTECTED":
      return 409;
    default:
      return 500;
  }
}
