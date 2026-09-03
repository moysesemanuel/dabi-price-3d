export type AdminUserActionPayload =
  | { action: "set_status"; status: "active" | "disabled" }
  | { action: "revoke_sessions" };

export function isAdminUserActionPayload(value: unknown): value is AdminUserActionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as { action?: unknown; status?: unknown };
  return (
    (payload.action === "set_status" &&
      (payload.status === "active" || payload.status === "disabled")) ||
    payload.action === "revoke_sessions"
  );
}

export function mapAdminUserMutationError(error: unknown) {
  if (!(error instanceof Error)) return "Falha ao atualizar usuario.";
  switch (error.message) {
    case "FORBIDDEN_ADMIN_USERS": return "A edicao administrativa de usuarios e exclusiva para super admin.";
    case "EMAIL_ALREADY_IN_USE": return "Esse e-mail ja esta em uso por outro usuario.";
    case "CANNOT_DELETE_CURRENT_USER": return "Sua propria conta nao pode ser excluida por essa tela.";
    case "CANNOT_DISABLE_CURRENT_USER": return "Sua propria conta nao pode ser desativada por essa tela.";
    case "LAST_SUPER_ADMIN_PROTECTED": return "A ultima conta super admin nao pode ser removida ou desativada.";
    case "ADMIN_USER_ACTION_REQUIRES_PERSISTENCE": return "Esta acao exige persistencia de producao.";
    case "OWNER_USER_DELETE_FORBIDDEN": return "Nao e permitido excluir um usuario owner de workspace.";
    default: return "Falha ao atualizar usuario.";
  }
}

export function mapAdminUserMutationStatus(error: unknown) {
  if (!(error instanceof Error)) return 500;
  switch (error.message) {
    case "FORBIDDEN_ADMIN_USERS": return 403;
    case "EMAIL_ALREADY_IN_USE": return 409;
    case "CANNOT_DELETE_CURRENT_USER":
    case "CANNOT_DISABLE_CURRENT_USER":
    case "OWNER_USER_DELETE_FORBIDDEN":
    case "LAST_SUPER_ADMIN_PROTECTED": return 409;
    default: return 500;
  }
}
