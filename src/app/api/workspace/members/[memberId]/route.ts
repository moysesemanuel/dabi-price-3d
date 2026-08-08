import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  removeWorkspaceMemberForSession,
  updateWorkspaceMemberRoleForSession,
} from "@/lib/auth/workspace-members";

type UpdateWorkspaceMemberPayload = {
  workspaceRole?: string;
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

function mapMembersMutationError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha ao atualizar o membro.";
  }

  switch (error.message) {
    case "FORBIDDEN_ROLE_ASSIGNMENT":
      return "Seu nivel de acesso nao permite aplicar esse papel.";
    case "FORBIDDEN_MEMBER_REMOVAL":
      return "Seu nivel de acesso nao permite remover esse membro.";
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
    case "FORBIDDEN_MEMBER_REMOVAL":
      return 403;
    default:
      return 500;
  }
}
