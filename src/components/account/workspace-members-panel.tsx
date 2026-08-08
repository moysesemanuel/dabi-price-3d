"use client";

import { useMemo, useState } from "react";
import {
  canAssignWorkspaceRole,
  canRemoveWorkspaceMember,
  type ManagedWorkspaceRole,
} from "@/lib/auth/access-control";
import type { PlatformRole } from "@/lib/server/platform";
import { workspaceRoleMeta } from "@/lib/workspace/catalog";

type MembersApiSnapshot = {
  session: {
    user: {
      id: string;
      email: string;
      fullName: string;
      platformRole: PlatformRole;
      status: string;
    };
    workspace: {
      id: string;
      name: string;
      slug: string;
      role: string;
    };
    access: {
      label: string;
      description: string;
    };
  };
  permissions: {
    isSuperAdmin: boolean;
    workspaceRole: string;
    canManageMembers: boolean;
    canInviteManagers: boolean;
    canInviteOperators: boolean;
    canTransferOwnership: boolean;
    allowedInviteRoles: ManagedWorkspaceRole[];
  };
  summary: {
    totalMembers: number;
    activeMembers: number;
    invitedMembers: number;
    ownerCount: number;
    managerCount: number;
    operatorCount: number;
  };
  members: WorkspaceMemberView[];
};

type WorkspaceMemberView = {
  membershipId: string;
  workspaceId: string;
  userId: string;
  email: string;
  fullName: string;
  platformRole: string;
  userStatus: string;
  workspaceRole: string;
  invitedByUserId: string | null;
  invitedByName: string | null;
  joinedAt: string;
  lastLoginAt: string | null;
  isWorkspaceOwner: boolean;
};

const managedRoleOptions: ManagedWorkspaceRole[] = [
  "owner",
  "manager",
  "operator",
];

export function WorkspaceMembersPanel({
  initialSnapshot,
  initialError,
}: {
  initialSnapshot: MembersApiSnapshot | null;
  initialError: string | null;
}) {
  const [snapshot, setSnapshot] = useState<MembersApiSnapshot | null>(initialSnapshot);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ManagedWorkspaceRole>(
    initialSnapshot?.permissions.allowedInviteRoles[0] ?? "operator",
  );
  const [inviteState, setInviteState] = useState<"idle" | "submitting">("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<{
    message: string;
    inviteUrl: string | null;
    expiresAt: string | null;
    emailDelivered: boolean;
  } | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, ManagedWorkspaceRole>>(
    () => buildRoleDrafts(initialSnapshot),
  );
  const [pendingMembershipId, setPendingMembershipId] = useState<string | null>(null);

  const currentMembership = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return (
      snapshot.members.find(
        (member) => member.userId === snapshot.session.user.id,
      ) ?? null
    );
  }, [snapshot]);

  function applySnapshot(nextSnapshot: MembersApiSnapshot) {
    setSnapshot(nextSnapshot);
    setInviteRole(nextSnapshot.permissions.allowedInviteRoles[0] ?? "operator");
    setRoleDrafts(buildRoleDrafts(nextSnapshot));
  }

  async function loadMembers() {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/workspace/members", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | MembersApiSnapshot
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          isErrorPayload(payload)
            ? payload.error ?? "Falha ao carregar membros."
            : "Falha ao carregar membros.",
        );
      }

      if (!payload || isErrorPayload(payload)) {
        throw new Error(payload?.error ?? "Falha ao carregar membros.");
      }

      applySnapshot(payload);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Falha ao carregar membros.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInviteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setInviteState("submitting");
    setInviteError(null);
    setInviteFeedback(null);

    try {
      const response = await fetch("/api/workspace/members", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: inviteName,
          email: inviteEmail,
          workspaceRole: inviteRole,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            inviteUrl?: string | null;
            expiresAt?: string | null;
            emailDelivered?: boolean;
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao convidar membro.");
      }

      setInviteFeedback({
        message: "Convite criado com sucesso.",
        inviteUrl: payload?.inviteUrl ?? null,
        expiresAt: payload?.expiresAt ?? null,
        emailDelivered: payload?.emailDelivered === true,
      });
      setInviteName("");
      setInviteEmail("");
      await loadMembers();
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "Falha ao convidar membro.",
      );
    } finally {
      setInviteState("idle");
    }
  }

  async function handleRoleSave(member: WorkspaceMemberView) {
    const nextRole = roleDrafts[member.membershipId];

    if (!nextRole || nextRole === member.workspaceRole) {
      return;
    }

    setPendingMembershipId(member.membershipId);

    try {
      const response = await fetch(
        `/api/workspace/members/${member.membershipId}`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            workspaceRole: nextRole,
          }),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao atualizar papel.");
      }

      await loadMembers();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Falha ao atualizar papel.",
      );
    } finally {
      setPendingMembershipId(null);
    }
  }

  async function handleRemoveMember(member: WorkspaceMemberView) {
    const shouldRemove = window.confirm(
      `Remover o acesso de ${member.email} deste workspace?`,
    );

    if (!shouldRemove) {
      return;
    }

    setPendingMembershipId(member.membershipId);

    try {
      const response = await fetch(
        `/api/workspace/members/${member.membershipId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Falha ao remover membro.");
      }

      await loadMembers();
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Falha ao remover membro.",
      );
    } finally {
      setPendingMembershipId(null);
    }
  }

  if (isLoading) {
    return (
      <section className="app-card p-6">
        <p className="text-sm text-[var(--muted)]">Carregando membros do workspace...</p>
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
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Nivel atual
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
              {snapshot.session.access.label}
            </span>
            <span className="rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-3 py-1 text-xs text-[var(--muted)]">
              {snapshot.session.user.email}
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            {snapshot.session.access.description}
          </p>
          {currentMembership ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatChip
                label="Papel no workspace"
                value={workspaceRoleMeta[
                  currentMembership.workspaceRole as ManagedWorkspaceRole
                ].label}
              />
              <StatChip
                label="Status da conta"
                value={memberStatusLabel[currentMembership.userStatus] ?? "Ativo"}
              />
              <StatChip
                label="Platform role"
                value={formatPlatformRole(snapshot.session.user.platformRole)}
              />
            </div>
          ) : null}
        </div>

        <div className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Resumo
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StatChip label="Membros" value={String(snapshot.summary.totalMembers)} />
            <StatChip label="Ativos" value={String(snapshot.summary.activeMembers)} />
            <StatChip
              label="Convites pendentes"
              value={String(snapshot.summary.invitedMembers)}
            />
            <StatChip
              label="Managers"
              value={String(snapshot.summary.managerCount)}
            />
          </div>
        </div>
      </section>

      <section className="app-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              Convites
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Convidar e organizar o time
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              Owners gerenciam governance, managers cuidam da operacao e operators
              usam a precificadora sem acesso administrativo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadMembers()}
            className="app-button app-button-secondary"
          >
            Atualizar lista
          </button>
        </div>

        {snapshot.permissions.canManageMembers ? (
          <form className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_220px_auto]" onSubmit={handleInviteSubmit}>
            <Field
              label="Nome"
              placeholder="Nome do membro"
              value={inviteName}
              onChange={setInviteName}
            />
            <Field
              label="E-mail"
              placeholder="pessoa@empresa.com"
              type="email"
              value={inviteEmail}
              onChange={setInviteEmail}
            />
            <SelectField
              label="Papel"
              value={inviteRole}
              onChange={(value) => setInviteRole(value as ManagedWorkspaceRole)}
              options={snapshot.permissions.allowedInviteRoles.map((role) => ({
                value: role,
                label: workspaceRoleMeta[role].label,
              }))}
            />
            <div className="flex items-end">
              <button
                type="submit"
                disabled={inviteState === "submitting"}
                className="app-button app-button-primary w-full"
              >
                {inviteState === "submitting" ? "Convidando..." : "Convidar"}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
            Seu papel atual nao permite convidar ou alterar membros do workspace.
          </div>
        )}

        {inviteError ? (
          <FeedbackPanel tone="danger" className="mt-5">
            {inviteError}
          </FeedbackPanel>
        ) : null}

        {inviteFeedback ? (
          <FeedbackPanel tone="success" className="mt-5">
            <p>{inviteFeedback.message}</p>
            {inviteFeedback.emailDelivered ? (
              <p className="mt-2">O convite ja foi enviado por e-mail.</p>
            ) : null}
            {inviteFeedback.inviteUrl ? (
              <div className="mt-4 rounded-[18px] border border-[var(--panel-border)] bg-white/80 px-4 py-3 text-sm text-[var(--foreground)]">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Link do convite
                </p>
                <a
                  href={inviteFeedback.inviteUrl}
                  className="mt-2 block break-all text-[var(--accent)] underline decoration-[color:var(--accent)]/40 underline-offset-4"
                >
                  {inviteFeedback.inviteUrl}
                </a>
                {inviteFeedback.expiresAt ? (
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Expira em {formatDateTime(inviteFeedback.expiresAt)}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </FeedbackPanel>
        ) : null}
      </section>

      {loadError && snapshot ? (
        <FeedbackPanel tone="danger">{loadError}</FeedbackPanel>
      ) : null}

      <section className="space-y-4">
        {snapshot.members.map((member) => {
          const draftRole =
            roleDrafts[member.membershipId] ??
            (member.workspaceRole as ManagedWorkspaceRole);
          const availableRoles = getAvailableRoles(snapshot, member);
          const canRemove = canRemoveWorkspaceMember({
            actor: snapshot.session,
            targetRole: member.workspaceRole as ManagedWorkspaceRole,
            isCurrentUser: member.userId === snapshot.session.user.id,
          });
          const isPending = pendingMembershipId === member.membershipId;

          return (
            <article key={member.membershipId} className="app-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                      {member.fullName}
                    </h3>
                    <Badge>{workspaceRoleMeta[member.workspaceRole as ManagedWorkspaceRole].label}</Badge>
                    {member.isWorkspaceOwner ? <Badge tone="accent">Owner atual</Badge> : null}
                    {member.userId === snapshot.session.user.id ? (
                      <Badge tone="muted">Voce</Badge>
                    ) : null}
                    {member.platformRole !== "user" ? (
                      <Badge tone="muted">{formatPlatformRole(member.platformRole)}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{member.email}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge tone={member.userStatus === "invited" ? "warning" : "muted"}>
                    {memberStatusLabel[member.userStatus] ?? "Ativo"}
                  </Badge>
                  {member.lastLoginAt ? (
                    <Badge tone="muted">
                      Ultimo acesso {formatDateTime(member.lastLoginAt)}
                    </Badge>
                  ) : (
                    <Badge tone="warning">Sem login ainda</Badge>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <InfoBlock
                  label="Entrou em"
                  value={formatDateTime(member.joinedAt)}
                />
                <InfoBlock
                  label="Convidado por"
                  value={member.invitedByName ?? "Provisionamento inicial"}
                />
                <InfoBlock
                  label="Escopo"
                  value={member.isWorkspaceOwner ? "Governanca total" : accessScopeLabel[member.workspaceRole]}
                />
              </div>

              {availableRoles.length > 0 || canRemove ? (
                <div className="mt-6 flex flex-col gap-3 border-t border-[var(--panel-border)] pt-5 lg:flex-row lg:items-end lg:justify-between">
                  {availableRoles.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-[220px_auto]">
                      <SelectField
                        label="Trocar papel"
                        value={draftRole}
                        onChange={(value) =>
                          setRoleDrafts((current) => ({
                            ...current,
                            [member.membershipId]: value as ManagedWorkspaceRole,
                          }))
                        }
                        options={availableRoles.map((role) => ({
                          value: role,
                          label: workspaceRoleMeta[role].label,
                        }))}
                      />
                      <div className="flex items-end">
                        <button
                          type="button"
                          disabled={isPending || draftRole === member.workspaceRole}
                          onClick={() => void handleRoleSave(member)}
                          className="app-button app-button-primary w-full sm:w-auto"
                        >
                          {isPending ? "Salvando..." : "Salvar papel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Esse membro nao pode ser promovido ou rebaixado pelo seu nivel de acesso atual.
                    </p>
                  )}

                  {canRemove ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => void handleRemoveMember(member)}
                      className="app-button rounded-full border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/8 px-4 py-3 text-[var(--danger)] transition hover:border-[color:var(--danger)]/50 hover:bg-[color:var(--danger)]/12"
                    >
                      {isPending ? "Removendo..." : "Remover acesso"}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </div>
  );
}

function buildRoleDrafts(snapshot: MembersApiSnapshot | null) {
  if (!snapshot) {
    return {};
  }

  return Object.fromEntries(
    snapshot.members.map((member) => [
      member.membershipId,
      member.workspaceRole as ManagedWorkspaceRole,
    ]),
  );
}

function isErrorPayload(
  payload: MembersApiSnapshot | { error?: string } | null,
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
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="clay-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/18"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="clay-input mt-2 w-full rounded-2xl px-4 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color:var(--accent)]/18"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-sm text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "warning" | "muted";
}) {
  const className =
    tone === "accent"
      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
      : tone === "warning"
        ? "border-[color:var(--warning)]/25 bg-[color:var(--warning)]/10 text-[var(--warning)]"
        : tone === "muted"
          ? "border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] text-[var(--muted)]"
          : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.9)] text-[var(--foreground)]";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${className}`}
    >
      {children}
    </span>
  );
}

function FeedbackPanel({
  children,
  tone,
  className = "",
}: {
  children: React.ReactNode;
  tone: "success" | "danger";
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] px-4 py-4 text-sm leading-7 ${
        tone === "success"
          ? "border border-[#8fc4a4]/40 bg-[#f4fff7] text-[#256341]"
          : "border border-[#d45f5f]/30 bg-[#fff5f5] text-[#a53b3b]"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function getAvailableRoles(
  snapshot: MembersApiSnapshot,
  member: WorkspaceMemberView,
) {
  return managedRoleOptions.filter((role) =>
    canAssignWorkspaceRole({
      actor: snapshot.session,
      currentRole: member.workspaceRole as ManagedWorkspaceRole,
      nextRole: role,
      isCurrentUser: member.userId === snapshot.session.user.id,
    }),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPlatformRole(value: string) {
  if (value === "super_admin") {
    return "Super admin";
  }

  if (value === "platform_admin") {
    return "Platform admin";
  }

  if (value === "support_agent") {
    return "Support";
  }

  if (value === "developer") {
    return "Developer";
  }

  return "Usuario";
}

const memberStatusLabel: Record<string, string> = {
  active: "Ativo",
  invited: "Convite pendente",
  disabled: "Desativado",
};

const accessScopeLabel: Record<string, string> = {
  owner: "Governanca e configuracao",
  manager: "Operacao e gestao do time",
  operator: "Uso operacional",
};
