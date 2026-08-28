"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  canEditMemberRole,
  canRemoveMember,
  canTransferOwnership,
  editableMemberRoleOptions,
  getWorkspaceManagementError,
  inviteRoleOptions,
  type AdminWorkspaceMemberRole,
} from "@/lib/auth/admin-workspace-management";

type WorkspaceMember = {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  userStatus: string;
  workspaceRole: string;
  isWorkspaceOwner: boolean;
};

type Feedback = { tone: "success" | "error"; message: string } | null;

export function AdminWorkspaceManagementPanel({
  workspaceId,
  initialName,
  initialMembers,
}: {
  workspaceId: string;
  initialName: string;
  initialMembers: WorkspaceMember[];
}) {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState(initialName);
  const [members, setMembers] = useState(initialMembers);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialName);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"manager" | "operator">("operator");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, "manager" | "operator">>(
    () => Object.fromEntries(initialMembers.filter((member) => canEditMemberRole(member.workspaceRole)).map((member) => [member.membershipId, member.workspaceRole === "manager" ? "manager" : "operator"])),
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function refreshAfterSuccess(message: string) {
    setFeedback({ tone: "success", message });
    router.refresh();
  }

  async function requestJson<T>(
    path: string,
    options: RequestInit,
    action: "invite" | "role" | "transfer" | "remove" | "rename",
  ) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        "content-type": "application/json",
        ...options.headers,
      },
    });
    const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;
    if (!response.ok) {
      const message = (payload as { error?: string } | null)?.error;
      throw new Error(getWorkspaceManagementError({ action, status: response.status, message }));
    }
    return payload as T;
  }

  async function renameWorkspace() {
    const name = nameDraft.trim();
    if (!name) {
      setFeedback({ tone: "error", message: "Informe um nome valido para o workspace." });
      return;
    }

    setPendingAction("rename");
    setFeedback(null);
    try {
      const payload = await requestJson<{ workspace: { name: string } }>(
        `/api/admin/workspaces/${workspaceId}`,
        { method: "PUT", body: JSON.stringify({ name }) },
        "rename",
      );
      setWorkspaceName(payload.workspace.name);
      setNameDraft(payload.workspace.name);
      setIsEditingName(false);
      refreshAfterSuccess("Nome do workspace atualizado.");
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Falha ao atualizar workspace." });
    } finally {
      setPendingAction(null);
    }
  }

  async function inviteMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteName.trim() || !inviteEmail.includes("@")) {
      setFeedback({ tone: "error", message: "Informe nome e e-mail validos para o convite." });
      return;
    }

    setPendingAction("invite");
    setFeedback(null);
    try {
      const payload = await requestJson<{ member: WorkspaceMember }>(
        `/api/admin/workspaces/${workspaceId}/members`,
        {
          method: "POST",
          body: JSON.stringify({ fullName: inviteName, email: inviteEmail, workspaceRole: inviteRole }),
        },
        "invite",
      );
      setMembers((current) => [...current, payload.member]);
      setRoleDrafts((current) => ({ ...current, [payload.member.membershipId]: inviteRole }));
      setInviteName("");
      setInviteEmail("");
      setIsInviteOpen(false);
      refreshAfterSuccess("Convite criado com sucesso.");
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Falha ao convidar membro." });
    } finally {
      setPendingAction(null);
    }
  }

  async function updateRole(member: WorkspaceMember) {
    const workspaceRole = roleDrafts[member.membershipId];
    if (!workspaceRole || !editableMemberRoleOptions.includes(workspaceRole) || workspaceRole === member.workspaceRole) return;

    setPendingAction(`role:${member.membershipId}`);
    setFeedback(null);
    try {
      const payload = await requestJson<{ member: WorkspaceMember }>(
        `/api/admin/workspaces/${workspaceId}/members/${member.membershipId}`,
        { method: "PATCH", body: JSON.stringify({ workspaceRole }) },
        "role",
      );
      setMembers((current) => current.map((item) => item.membershipId === member.membershipId ? payload.member : item));
      refreshAfterSuccess(`Role de ${member.fullName} atualizada.`);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Falha ao alterar role." });
    } finally {
      setPendingAction(null);
    }
  }

  async function transferOwnership(member: WorkspaceMember) {
    if (!canTransferOwnership(member.workspaceRole)) return;
    if (!window.confirm(`Transferir a propriedade para ${member.fullName}? Este membro passara a ser o proprietario do workspace.`)) return;

    setPendingAction(`transfer:${member.membershipId}`);
    setFeedback(null);
    try {
      const payload = await requestJson<{ member: WorkspaceMember }>(
        `/api/admin/workspaces/${workspaceId}/members/${member.membershipId}`,
        { method: "PATCH", body: JSON.stringify({ workspaceRole: "owner" }) },
        "transfer",
      );
      setMembers((current) => current.map((item) => {
        if (item.membershipId === member.membershipId) return { ...payload.member, isWorkspaceOwner: true };
        if (item.isWorkspaceOwner) return { ...item, workspaceRole: "manager", isWorkspaceOwner: false };
        return item;
      }));
      setRoleDrafts((current) => ({ ...current, [member.membershipId]: "manager" }));
      refreshAfterSuccess(`Propriedade transferida de ${ownerName(members)} para ${member.fullName}.`);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Falha ao transferir propriedade." });
    } finally {
      setPendingAction(null);
    }
  }

  async function removeMember(member: WorkspaceMember) {
    if (!canRemoveMember(member.workspaceRole)) return;
    if (!window.confirm(`Remover ${member.fullName} deste workspace?`)) return;

    setPendingAction(`remove:${member.membershipId}`);
    setFeedback(null);
    try {
      await requestJson(
        `/api/admin/workspaces/${workspaceId}/members/${member.membershipId}`,
        { method: "DELETE" },
        "remove",
      );
      setMembers((current) => current.filter((item) => item.membershipId !== member.membershipId));
      refreshAfterSuccess(`${member.fullName} foi removido do workspace.`);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Falha ao remover membro." });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">Workspace</p>
            {isEditingName ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xl font-semibold text-[var(--foreground)]" aria-label="Nome do workspace" />
                <button type="button" onClick={() => void renameWorkspace()} disabled={pendingAction === "rename"} className="app-button app-button-primary">{pendingAction === "rename" ? "Salvando..." : "Salvar"}</button>
                <button type="button" onClick={() => { setNameDraft(workspaceName); setIsEditingName(false); }} disabled={pendingAction === "rename"} className="app-button app-button-secondary">Cancelar</button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-[-0.04em]">{workspaceName}</h1><button type="button" onClick={() => setIsEditingName(true)} className="app-button app-button-secondary">Editar</button></div>
            )}
          </div>
          <button type="button" onClick={() => setIsInviteOpen((current) => !current)} className="app-button app-button-primary">{isInviteOpen ? "Fechar convite" : "Convidar membro"}</button>
        </div>

        {feedback ? <p className={`mt-5 rounded-xl border px-4 py-3 text-sm ${feedback.tone === "success" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-[color:var(--danger)]/30 bg-[color:var(--danger)]/10 text-[var(--danger)]"}`}>{feedback.message}</p> : null}

        {isInviteOpen ? (
          <form onSubmit={(event) => void inviteMember(event)} className="mt-5 grid gap-3 rounded-xl border border-[var(--panel-border)] p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_auto]">
            <input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="Nome completo" className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm" />
            <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} type="email" placeholder="pessoa@empresa.com" className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm" />
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "manager" | "operator")} className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-sm">
              {inviteRoleOptions.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select>
            <button type="submit" disabled={pendingAction === "invite"} className="app-button app-button-primary">{pendingAction === "invite" ? "Convidando..." : "Enviar convite"}</button>
          </form>
        ) : null}
      </section>

      <section className="app-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] px-6 py-4">
          <div><h2 className="text-xl font-semibold">Membros</h2><p className="mt-1 text-sm text-[var(--muted)]">O owner e protegido: use a transferencia explicita antes de qualquer alteracao.</p></div>
          <span className="text-sm text-[var(--muted)]">{members.length} membro{members.length === 1 ? "" : "s"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-[var(--panel-soft)] text-xs uppercase tracking-[0.14em] text-[var(--muted)]"><tr><th className="px-6 py-3 font-medium">Membro</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Acoes</th></tr></thead>
            <tbody>
              {members.map((member) => {
                const isOwner = member.isWorkspaceOwner || member.workspaceRole === "owner";
                const isPending = pendingAction?.endsWith(member.membershipId) === true;
                const draft = roleDrafts[member.membershipId] ?? "operator";
                return <tr key={member.membershipId} className="border-t border-[var(--panel-border)]"><td className="px-6 py-4"><p className="font-medium">{member.fullName}</p><p className="mt-1 text-xs text-[var(--muted)]">{member.email}</p></td><td className="px-4 py-4"><StatusLabel status={member.userStatus} /></td><td className="px-4 py-4">{isOwner ? <span className="inline-flex rounded-full border border-[var(--accent)]/35 px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">Owner</span> : <div className="flex items-center gap-2"><select value={draft} disabled={isPending} onChange={(event) => setRoleDrafts((current) => ({ ...current, [member.membershipId]: event.target.value as "manager" | "operator" }))} className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1.5"><option value="manager">Manager</option><option value="operator">Operator</option></select><button type="button" disabled={isPending || draft === member.workspaceRole} onClick={() => void updateRole(member)} className="text-xs font-medium text-[var(--accent)] disabled:opacity-50">Salvar</button></div>}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{!isOwner && canTransferOwnership(member.workspaceRole) ? <button type="button" disabled={isPending} onClick={() => void transferOwnership(member)} className="app-button app-button-secondary text-xs">Transferir propriedade</button> : null}{!isOwner && canRemoveMember(member.workspaceRole) ? <button type="button" disabled={isPending} onClick={() => void removeMember(member)} className="app-button border border-[color:var(--danger)]/35 bg-transparent text-xs text-[var(--danger)]">Remover</button> : null}{isOwner ? <span className="text-xs text-[var(--muted)]">Protegido</span> : null}</div></td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ownerName(members: WorkspaceMember[]) {
  return members.find((member) => member.isWorkspaceOwner || member.workspaceRole === "owner")?.fullName ?? "o owner atual";
}

function roleLabel(role: AdminWorkspaceMemberRole) {
  return role === "manager" ? "Manager" : "Operator";
}

function StatusLabel({ status }: { status: string }) {
  return <span className="inline-flex rounded-full border border-[var(--panel-border)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]">{status}</span>;
}
