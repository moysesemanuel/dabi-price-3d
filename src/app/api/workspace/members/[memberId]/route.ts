import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  removeWorkspaceMemberForSession,
  updateWorkspaceMemberProfileForSession,
  updateWorkspaceMemberRoleForSession,
} from "@/lib/auth/workspace-members";

type UpdateWorkspaceMemberPayload = {
  workspaceRole?: string;
};

type UpdateWorkspaceMemberProfilePayload = {
  fullName?: string;
  email?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const session = await requireCurrentAuthSession();
  const { memberId } = await context.params;
  let body: UpdateWorkspaceMemberPayload;

  try {
    body = (await request.json()) as UpdateWorkspaceMemberPayload;
  } catch {
    return Response.json({ error: "Payload invalido." }, { status: 400 });
  }

  const workspaceRole = body.workspaceRole?.trim() ?? "";

  if (!workspaceRole) {
    return Response.json(
      { error: "Informe o novo papel do membro." },
      { status: 400 },
    );
  }

  try {
    const member = await updateWorkspaceMemberRoleForSession({
      session,
      membershipId: memberId,
      workspaceRole,
    });

    if (!member) {
      return Response.json({ error: "Membro nao encontrado." }, { status: 404 });
    }

    return Response.json({ member });
  } catch (error) {
    return Response.json(
      { error: mapMembersMutationError(error) },
      { status: mapMembersMutationStatus(error) },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const session = await requireCurrentAuthSession();
  const { memberId } = await context.params;

  try {
    const member = await removeWorkspaceMemberForSession({
      session,
      membershipId: memberId,
    });

    if (!member) {
      return Response.json({ error: "Membro nao encontrado." }, { status: 404 });
    }

    return Response.json({ member });
  } catch (error) {
    return Response.json(
      { error: mapMembersMutationError(error) },
      { status: mapMembersMutationStatus(error) },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const session = await requireCurrentAuthSession();
  const { memberId } = await context.params;
  let body: UpdateWorkspaceMemberProfilePayload;

  try {
    body = (await request.json()) as UpdateWorkspaceMemberProfilePayload;
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
    const member = await updateWorkspaceMemberProfileForSession({
      session,
      membershipId: memberId,
      fullName,
      email,
    });

    if (!member) {
      return Response.json({ error: "Membro nao encontrado." }, { status: 404 });
    }

    return Response.json({ member });
  } catch (error) {
    return Response.json(
      { error: mapMembersMutationError(error) },
      { status: mapMembersMutationStatus(error) },
    );
  }
}

function mapMembersMutationError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha ao atualizar o membro.";
  }

  switch (error.message) {
    case "FORBIDDEN_ROLE_ASSIGNMENT":
      return "Seu nivel de acesso nao permite aplicar esse papel.";
    case "FORBIDDEN_PROFILE_EDIT":
      return "Apenas super admins podem editar os dados do usuario.";
    case "FORBIDDEN_MEMBER_REMOVAL":
      return "Seu nivel de acesso nao permite remover esse membro.";
    case "EMAIL_ALREADY_IN_USE":
      return "Esse e-mail ja esta em uso por outro usuario.";
    default:
      return "Falha ao atualizar o membro.";
  }
}

function mapMembersMutationStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  switch (error.message) {
    case "FORBIDDEN_ROLE_ASSIGNMENT":
    case "FORBIDDEN_PROFILE_EDIT":
    case "FORBIDDEN_MEMBER_REMOVAL":
      return 403;
    case "EMAIL_ALREADY_IN_USE":
      return 409;
    default:
      return 500;
  }
}
