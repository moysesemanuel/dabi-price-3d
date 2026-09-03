export function canChangeAdminUserStatus(input: {
  userId: string;
  currentUserId: string;
  platformRole: string;
  userStatus: string;
  activeSuperAdmins: number;
}) {
  if (input.userId === input.currentUserId && input.userStatus === "active") {
    return false;
  }

  return !(
    input.platformRole === "super_admin" &&
    input.userStatus === "active" &&
    input.activeSuperAdmins <= 1
  );
}

export function getAdminUserManagementError(input: {
  action: "status" | "sessions";
  status: number;
  message?: string;
}) {
  if (input.status === 404) return "Usuario nao encontrado. Atualize a pagina.";
  if (input.status === 409 && input.message?.includes("ultima conta super admin")) {
    return "A ultima conta super admin nao pode ser desativada.";
  }
  if (input.status === 403) {
    return "Esta acao e exclusiva para super admin.";
  }
  return input.message || `Nao foi possivel concluir a acao de ${input.action}.`;
}
