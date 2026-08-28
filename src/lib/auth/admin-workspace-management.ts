export type AdminWorkspaceMemberRole = "owner" | "manager" | "operator";

export const inviteRoleOptions = ["manager", "operator"] as const;
export const editableMemberRoleOptions = ["manager", "operator"] as const;

export function isAdminWorkspaceMemberRole(
  value: unknown,
): value is AdminWorkspaceMemberRole {
  return value === "owner" || value === "manager" || value === "operator";
}

export function canEditMemberRole(role: string) {
  return role !== "owner";
}

export function canRemoveMember(role: string) {
  return role !== "owner";
}

export function canTransferOwnership(role: string) {
  return role === "manager" || role === "operator";
}

export function getWorkspaceManagementError(input: {
  action: "invite" | "role" | "transfer" | "remove" | "rename";
  status: number;
  message?: string;
}) {
  if (input.message?.includes("ownership")) {
    return "Transfira a propriedade antes de alterar ou remover o owner.";
  }

  if (input.status === 404) {
    return input.action === "rename"
      ? "Workspace nao encontrado. Atualize a pagina e tente novamente."
      : "Este membro nao existe mais. Atualize a lista.";
  }

  if (input.status === 409 && input.action === "invite") {
    return "O e-mail ja possui acesso, convite pendente ou o workspace atingiu o limite de assentos.";
  }

  if (input.status === 409 && input.action === "remove") {
    return "Este membro nao pode ser removido. Transfira a propriedade antes de remover o owner.";
  }

  if (input.status === 400 && input.action === "role") {
    return "Selecione uma role valida para o membro.";
  }

  return input.message || "Nao foi possivel concluir a acao administrativa.";
}
