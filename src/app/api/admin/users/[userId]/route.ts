import {
  deletePlatformUserForSession,
  revokePlatformUserSessionsForSession,
  updatePlatformUserStatusForSession,
  updatePlatformUserProfileForSession,
} from "@/lib/auth/admin-users";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  isAdminUserActionPayload,
  mapAdminUserMutationError,
  mapAdminUserMutationStatus,
} from "@/lib/auth/admin-user-route-contract";

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
    if (!isAdminUserActionPayload(body)) {
      return Response.json({ error: "Acao invalida." }, { status: 400 });
    }

    if (body.action === "set_status") {

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
