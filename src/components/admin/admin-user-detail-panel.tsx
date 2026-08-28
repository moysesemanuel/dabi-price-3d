"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  canChangeAdminUserStatus,
  getAdminUserManagementError,
} from "@/lib/auth/admin-user-management";

type AdminUser = {
  userId: string;
  fullName: string;
  email: string;
  platformRole: string;
  userStatus: string;
  createdAt: string;
  lastLoginAt: string | null;
};

type Membership = {
  membershipId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceRole: string;
  userStatus: string;
};

export function AdminUserDetailPanel({
  user,
  memberships,
  currentUserId,
  activeSuperAdmins,
}: {
  user: AdminUser;
  memberships: Membership[];
  currentUserId: string;
  activeSuperAdmins: number;
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(user);
  const [pendingAction, setPendingAction] = useState<"status" | "sessions" | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const canToggleStatus = canChangeAdminUserStatus({
    userId: currentUser.userId,
    currentUserId,
    platformRole: currentUser.platformRole,
    userStatus: currentUser.userStatus,
    activeSuperAdmins,
  });

  async function runAction(action: "status" | "sessions") {
    const nextStatus = currentUser.userStatus === "active" ? "disabled" : "active";
    setPendingAction(action);
    setFeedback(null);
    try {
      const response = await fetch(`/api/admin/users/${currentUser.userId}`, {
        method: "PATCH",
        headers: { Accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(
          action === "status"
            ? { action: "set_status", status: nextStatus }
            : { action: "revoke_sessions" },
        ),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; user?: AdminUser; revokedSessions?: number }
        | null;
      if (!response.ok) {
        throw new Error(
          getAdminUserManagementError({ action, status: response.status, message: payload?.error }),
        );
      }
      if (payload?.user) setCurrentUser(payload.user);
      setFeedback({
        tone: "success",
        message:
          action === "sessions"
            ? `${payload?.revokedSessions ?? 0} sessoes revogadas.`
            : "Status do usuario atualizado.",
      });
      router.refresh();
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Falha na acao administrativa." });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">Usuario da plataforma</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{currentUser.fullName}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{currentUser.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-sm">{currentUser.platformRole}</span>
            <span className="rounded-full border border-[var(--panel-border)] px-3 py-1.5 text-sm">{currentUser.userStatus}</span>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-[var(--muted)]">Criado em</dt><dd className="mt-1">{formatDate(currentUser.createdAt)}</dd></div>
          <div><dt className="text-[var(--muted)]">Ultimo acesso</dt><dd className="mt-1">{currentUser.lastLoginAt ? formatDate(currentUser.lastLoginAt) : "Sem login"}</dd></div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={!canToggleStatus || pendingAction !== null} onClick={() => void runAction("status")} className="app-button app-button-secondary">
            {pendingAction === "status" ? "Salvando..." : currentUser.userStatus === "active" ? "Desativar usuario" : "Ativar usuario"}
          </button>
          <button type="button" disabled={pendingAction !== null} onClick={() => void runAction("sessions")} className="app-button app-button-secondary">
            {pendingAction === "sessions" ? "Revogando..." : "Revogar sessoes"}
          </button>
        </div>
        {!canToggleStatus && currentUser.platformRole === "super_admin" ? <p className="mt-3 text-sm text-[var(--muted)]">A ultima conta super admin ativa nao pode ser desativada.</p> : null}
        {feedback ? <p className={`mt-4 text-sm ${feedback.tone === "success" ? "text-emerald-700" : "text-[var(--danger)]"}`}>{feedback.message}</p> : null}
      </section>

      <section className="app-card overflow-hidden p-0">
        <div className="border-b border-[var(--panel-border)] px-6 py-4"><h2 className="text-xl font-semibold">Workspaces e memberships</h2></div>
        <div className="overflow-x-auto"><table className="min-w-[640px] w-full text-left text-sm"><thead className="bg-[var(--panel-soft)] text-xs uppercase tracking-[0.14em] text-[var(--muted)]"><tr><th className="px-6 py-3 font-medium">Workspace</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Acao</th></tr></thead><tbody>{memberships.length ? memberships.map((membership) => <tr key={membership.membershipId} className="border-t border-[var(--panel-border)]"><td className="px-6 py-4"><p className="font-medium">{membership.workspaceName}</p><p className="mt-1 font-mono text-xs text-[var(--muted)]">{membership.workspaceId}</p></td><td className="px-4 py-4">{membership.workspaceRole}</td><td className="px-4 py-4">{membership.userStatus}</td><td className="px-4 py-4"><Link href={`/admin/workspaces/${membership.workspaceId}`} className="font-medium text-[var(--accent)]">Abrir workspace</Link></td></tr>) : <tr><td colSpan={4} className="px-6 py-8 text-[var(--muted)]">Este usuario nao possui memberships.</td></tr>}</tbody></table></div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
