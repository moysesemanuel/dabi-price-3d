"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  AdminPlatformUser,
  AdminUsersSnapshot,
} from "@/lib/auth/admin-users";

type PlatformUsersPanelProps = {
  initialSnapshot: AdminUsersSnapshot | null;
  initialError: string | null;
};

export function PlatformUsersPanel({
  initialSnapshot,
  initialError,
}: PlatformUsersPanelProps) {
  const [snapshot, setSnapshot] = useState<AdminUsersSnapshot | null>(initialSnapshot);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(initialSnapshot === null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { fullName: string; email: string }>
  >(() => buildDrafts(initialSnapshot));

  const filteredUsers = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return snapshot.users;
    }

    return snapshot.users.filter((user) => {
      const haystack = [
        user.fullName,
        user.email,
        user.primaryWorkspaceName ?? "",
        user.primaryWorkspaceRole ?? "",
        user.platformRole,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [searchQuery, snapshot]);

  const editingUser =
    editingUserId && snapshot
      ? snapshot.users.find((user) => user.userId === editingUserId) ?? null
      : null;

  function applySnapshot(nextSnapshot: AdminUsersSnapshot) {
    setSnapshot(nextSnapshot);
    setDrafts(buildDrafts(nextSnapshot));
  }

  async function fetchUsersSnapshot() {
    const response = await fetch("/api/admin/users", {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | AdminUsersSnapshot
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new Error(
        isErrorPayload(payload)
          ? payload.error ?? "Falha ao carregar usuarios."
          : "Falha ao carregar usuarios.",
      );
    }

    if (!payload || isErrorPayload(payload)) {
      throw new Error(payload?.error ?? "Falha ao carregar usuarios.");
    }

    return payload;
  }

  async function loadUsers() {
    setIsLoading(true);
    setLoadError(null);

    try {
      applySnapshot(await fetchUsersSnapshot());
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Falha ao carregar usuarios.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (initialSnapshot) {
      return;
    }

    let isActive = true;

    void fetchUsersSnapshot()
      .then((payload) => {
        if (!isActive) {
          return;
        }

        applySnapshot(payload);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setLoadError(
          error instanceof Error ? error.message : "Falha ao carregar usuarios.",
        );
      })
      .finally(() => {
        if (!isActive) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [initialSnapshot]);

  async function handleProfileSave(userId: string) {
    const user = snapshot?.users.find((item) => item.userId === userId) ?? null;
    const draft = drafts[userId];

    if (!user || !draft) {
      return;
    }

    if (
      draft.fullName.trim() === user.fullName &&
      draft.email.trim().toLowerCase() === user.email.toLowerCase()
    ) {
      setEditingUserId(null);
      return;
    }

    setPendingUserId(userId);
    setLoadError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: draft.fullName,
          email: draft.email,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao atualizar usuario.");
      }

      setEditingUserId(null);
      await loadUsers();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Falha ao atualizar usuario.",
      );
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleDeleteUser(user: AdminPlatformUser) {
    const shouldDelete = window.confirm(
      `Excluir ${user.email} da plataforma? Essa acao nao pode ser desfeita.`,
    );

    if (!shouldDelete) {
      return;
    }

    setPendingUserId(user.userId);
    setLoadError(null);
    setActiveMenuUserId(null);

    try {
      const response = await fetch(`/api/admin/users/${user.userId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao excluir usuario.");
      }

      if (editingUserId === user.userId) {
        setEditingUserId(null);
      }

      await loadUsers();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Falha ao excluir usuario.",
      );
    } finally {
      setPendingUserId(null);
    }
  }

  async function handleUserAction(
    user: AdminPlatformUser,
    action: "set_status" | "revoke_sessions",
  ) {
    const nextStatus = user.userStatus === "active" ? "disabled" : "active";
    const message =
      action === "revoke_sessions"
        ? `Revogar todas as sessoes de ${user.email}?`
        : `${nextStatus === "disabled" ? "Desativar" : "Ativar"} ${user.email}?`;

    if (!window.confirm(message)) {
      return;
    }

    setPendingUserId(user.userId);
    setLoadError(null);
    setActiveMenuUserId(null);

    try {
      const response = await fetch(`/api/admin/users/${user.userId}`, {
        method: "PATCH",
        headers: { Accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(
          action === "set_status"
            ? { action, status: nextStatus }
            : { action },
        ),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha na acao administrativa.");
      }

      await loadUsers();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Falha na acao administrativa.");
    } finally {
      setPendingUserId(null);
    }
  }

  if (isLoading && !snapshot) {
    return (
      <section className="app-card p-6">
        <p className="text-sm text-[var(--muted)]">Carregando usuarios...</p>
      </section>
    );
  }

  if (loadError && !snapshot) {
    return (
      <section className="app-card p-6">
        <p className="text-sm text-[var(--danger)]">{loadError}</p>
      </section>
    );
  }

  if (!snapshot) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Controle administrativo
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Cadastro global de usuarios
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Listagem exclusiva para super admin. Aqui voce localiza usuarios da
            plataforma e escolhe entre editar ou excluir cada cadastro.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Badge tone="accent">Somente super admin</Badge>
            <Badge tone="muted">{snapshot.session.user.email}</Badge>
          </div>
        </div>

        <div className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Resumo
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StatChip label="Usuarios" value={String(snapshot.summary.totalUsers)} />
            <StatChip label="Ativos" value={String(snapshot.summary.activeUsers)} />
            <StatChip
              label="Convites"
              value={String(snapshot.summary.invitedUsers)}
            />
            <StatChip
              label="Super admins"
              value={String(snapshot.summary.superAdmins)}
            />
          </div>
        </div>
      </section>

      <section className="app-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Field
            label="Buscar usuario"
            placeholder="Nome, e-mail, workspace ou papel"
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="app-button app-button-secondary"
          >
            {isLoading ? "Atualizando..." : "Atualizar lista"}
          </button>
        </div>

        {loadError ? (
          <div className="mt-5 rounded-[22px] border border-[color:var(--danger)]/18 bg-[color:var(--danger)]/8 px-4 py-4 text-sm text-[var(--danger)]">
            {loadError}
          </div>
        ) : null}
      </section>

      <section className="app-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] px-6 py-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Listagem
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {filteredUsers.length} registro{filteredUsers.length === 1 ? "" : "s"}
              {searchQuery.trim() ? " no filtro atual." : " carregado(s)."}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-[var(--panel-soft)] text-left">
                <HeaderCell>Nome</HeaderCell>
                <HeaderCell>E-mail</HeaderCell>
                <HeaderCell>Status</HeaderCell>
                <HeaderCell>Plataforma</HeaderCell>
                <HeaderCell>Workspace</HeaderCell>
                <HeaderCell>Ultimo acesso</HeaderCell>
                <HeaderCell align="right">Acoes</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-sm text-[var(--muted)]"
                  >
                    Nenhum usuario encontrado para esse filtro.
                  </td>
                </tr>
              ) : null}

              {filteredUsers.map((user) => {
                const isPending = pendingUserId === user.userId;
                const isOwnUser = user.userId === snapshot.session.user.id;
                const isOwnerUser = user.primaryWorkspaceRole === "owner";

                return (
                  <tr
                    key={user.userId}
                    className="border-t border-[var(--panel-border)] bg-white/82"
                  >
                    <BodyCell>
                      <div>
                        <p className="font-medium text-[var(--foreground)]">
                          {user.fullName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          Criado em {formatDateTime(user.createdAt)}
                        </p>
                      </div>
                    </BodyCell>
                    <BodyCell>{user.email}</BodyCell>
                    <BodyCell>
                      <StatusPill status={user.userStatus} />
                    </BodyCell>
                    <BodyCell>{formatPlatformRole(user.platformRole)}</BodyCell>
                    <BodyCell>
                      <div>
                        <p>{user.primaryWorkspaceName ?? "Sem workspace"}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatWorkspaceRole(user.primaryWorkspaceRole)}
                        </p>
                      </div>
                    </BodyCell>
                    <BodyCell>
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Sem login"}
                    </BodyCell>
                    <BodyCell align="right">
                      <div className="relative inline-flex">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            setActiveMenuUserId((current) =>
                              current === user.userId ? null : user.userId,
                            )
                          }
                          className="inline-flex size-10 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-white text-lg text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          aria-label={`Abrir acoes de ${user.fullName}`}
                        >
                          ⋯
                        </button>

                        {activeMenuUserId === user.userId ? (
                          <div className="absolute right-0 top-12 z-20 min-w-[160px] rounded-[20px] border border-[var(--panel-border)] bg-white p-2 shadow-[0_18px_48px_rgba(57,37,118,0.12)]">
                            <Link href={`/admin/usuarios/${user.userId}`} className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--panel-soft)]">
                              Abrir detalhe
                            </Link>
                            <ActionButton
                              onClick={() => {
                                setActiveMenuUserId(null);
                                setEditingUserId(user.userId);
                              }}
                            >
                              Editar
                            </ActionButton>
                            <ActionButton
                              disabled={isPending || isOwnUser}
                              onClick={() => void handleUserAction(user, "set_status")}
                            >
                              {user.userStatus === "active" ? "Desativar" : "Ativar"}
                            </ActionButton>
                            <ActionButton
                              disabled={isPending}
                              onClick={() => void handleUserAction(user, "revoke_sessions")}
                            >
                              Revogar sessoes
                            </ActionButton>
                            <ActionButton
                              disabled={isPending || isOwnUser || isOwnerUser}
                              onClick={() => void handleDeleteUser(user)}
                            >
                              Excluir
                            </ActionButton>
                            {isOwnUser ? (
                              <p className="px-3 pt-2 text-xs text-[var(--muted)]">
                                Sua conta nao pode ser excluida.
                              </p>
                            ) : null}
                            {!isOwnUser && isOwnerUser ? (
                              <p className="px-3 pt-2 text-xs text-[var(--muted)]">
                                Owner de workspace nao pode ser excluido.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </BodyCell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editingUser ? (
        <section className="app-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                Edicao
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Editar {editingUser.fullName}
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Ajuste os dados cadastrais e salve quando terminar.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingUserId(null)}
              className="app-button app-button-secondary"
            >
              Fechar
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Field
              label="Nome"
              placeholder="Nome completo"
              value={drafts[editingUser.userId]?.fullName ?? editingUser.fullName}
              onChange={(value) =>
                setDrafts((current) => ({
                  ...current,
                  [editingUser.userId]: {
                    ...current[editingUser.userId],
                    fullName: value,
                  },
                }))
              }
            />
            <Field
              label="E-mail"
              placeholder="pessoa@empresa.com"
              type="email"
              value={drafts[editingUser.userId]?.email ?? editingUser.email}
              onChange={(value) =>
                setDrafts((current) => ({
                  ...current,
                  [editingUser.userId]: {
                    ...current[editingUser.userId],
                    email: value,
                  },
                }))
              }
            />
            <div className="flex items-end">
              <button
                type="button"
                disabled={pendingUserId === editingUser.userId}
                onClick={() => void handleProfileSave(editingUser.userId)}
                className="app-button app-button-primary w-full lg:w-auto"
              >
                {pendingUserId === editingUser.userId ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function buildDrafts(snapshot: AdminUsersSnapshot | null) {
  if (!snapshot) {
    return {};
  }

  return Object.fromEntries(
    snapshot.users.map((user) => [
      user.userId,
      {
        fullName: user.fullName,
        email: user.email,
      },
    ]),
  );
}

function isErrorPayload(
  payload: AdminUsersSnapshot | { error?: string } | null,
): payload is { error?: string } {
  return payload !== null && "error" in payload;
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block min-w-[240px] flex-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-[18px] border border-[var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/20"
      />
    </label>
  );
}

function HeaderCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-6 py-4 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function BodyCell({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-6 py-4 text-sm text-[var(--foreground)] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center rounded-[14px] px-3 py-2 text-left text-sm text-[var(--foreground)] transition hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "invited"
      ? "border-[color:var(--warning)]/24 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
      : "border-[var(--panel-border)] bg-white text-[var(--muted)]";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${tone}`}
    >
      {status === "invited" ? "Convite" : "Ativo"}
    </span>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-white/72 px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "muted" | "accent";
}) {
  const className =
    tone === "accent"
      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
      : tone === "muted"
        ? "border-[var(--panel-border)] bg-white/78 text-[var(--muted)]"
        : "border-[var(--panel-border)] bg-[var(--panel-soft)] text-[var(--foreground)]";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${className}`}
    >
      {children}
    </span>
  );
}

function formatPlatformRole(value: string) {
  if (value === "super_admin") {
    return "Super admin";
  }

  if (value === "platform_admin") {
    return "Platform admin";
  }

  if (value === "support_agent") {
    return "Support agent";
  }

  if (value === "developer") {
    return "Developer";
  }

  return "User";
}

function formatWorkspaceRole(value: string | null) {
  if (value === "owner") {
    return "Owner";
  }

  if (value === "manager") {
    return "Manager";
  }

  if (value === "operator") {
    return "Operator";
  }

  return "Sem workspace";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
