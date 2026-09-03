import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  getWorkspaceMembersSnapshot,
  inviteWorkspaceMemberForSession,
} from "@/lib/auth/workspace-members";

type InviteWorkspaceMemberPayload = {
  fullName?: string;
  email?: string;
  workspaceRole?: string;
};

export async function GET() {
  const session = await requireCurrentAuthSession();
  const snapshot = await getWorkspaceMembersSnapshot(session);

  return Response.json(snapshot);
}

export async function POST(request: Request) {
  const session = await requireCurrentAuthSession();
  let body: InviteWorkspaceMemberPayload;

  try {
    body = (await request.json()) as InviteWorkspaceMemberPayload;
  } catch {
    return Response.json({ error: "Payload invalido." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const fullName = body.fullName?.trim() ?? "";
  const workspaceRole = body.workspaceRole?.trim() ?? "";

  if (!email || !email.includes("@")) {
    return Response.json(
      { error: "Informe um e-mail valido para o convite." },
      { status: 400 },
    );
  }

  if (!workspaceRole) {
    return Response.json(
      { error: "Informe o papel do membro." },
      { status: 400 },
    );
  }

  try {
    const result = await inviteWorkspaceMemberForSession({
      session,
      fullName,
      email,
      workspaceRole,
      baseUrl: request.url,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: mapMembersApiError(error) },
      { status: mapMembersApiStatus(error) },
    );
  }
}

function mapMembersApiError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Falha ao convidar membro.";
  }

  switch (error.message) {
    case "MEMBER_ALREADY_EXISTS":
      return "Esse e-mail ja faz parte do workspace.";
    case "USER_DISABLED":
      return "Esse usuario esta desativado e nao pode receber novo convite.";
    case "MULTI_WORKSPACE_NOT_SUPPORTED":
      return "Esse usuario ja pertence a outro workspace. A troca entre multiplos workspaces ainda nao esta disponivel.";
    case "FORBIDDEN_ROLE_ASSIGNMENT":
      return "Seu nivel de acesso nao permite convidar esse papel.";
    case "INVITE_TOKEN_ISSUE_FAILED":
      return "Nao foi possivel emitir o link de ativacao do convite.";
    case "SEAT_LIMIT_REACHED":
      return "O limite de usuarios do plano atual foi atingido.";
    default:
      return "Falha ao convidar membro.";
  }
}

function mapMembersApiStatus(error: unknown) {
  if (!(error instanceof Error)) {
    return 500;
  }

  switch (error.message) {
    case "MEMBER_ALREADY_EXISTS":
    case "MULTI_WORKSPACE_NOT_SUPPORTED":
    case "SEAT_LIMIT_REACHED":
      return 409;
    case "USER_DISABLED":
    case "FORBIDDEN_ROLE_ASSIGNMENT":
      return 403;
    case "INVITE_TOKEN_ISSUE_FAILED":
      return 500;
    default:
      return 500;
  }
}
