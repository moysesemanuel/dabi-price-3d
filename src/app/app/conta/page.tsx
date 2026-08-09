import Link from "next/link";
import { BackLink } from "@/components/app/back-link";
import { describeWorkspaceAccessLevel } from "@/lib/auth/access-control";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  defaultAppPreferences,
  getWorkspacePlan,
  workspaceRoleMeta,
} from "@/lib/settings/app-preferences";

export default async function AccountPage() {
  const session = await getCurrentAuthSession();
  const preferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : defaultAppPreferences;
  const plan = getWorkspacePlan(preferences.subscription.planId);
  const access = session
    ? describeWorkspaceAccessLevel({
        platformRole: session.user.platformRole,
        workspaceRole: session.workspace.role,
      })
    : null;

  return (
    <div className="app-page space-y-6">
      <header className="app-header">
        <BackLink href="/app" label="Voltar para o início" />
        <p className="app-eyebrow">Conta</p>
        <h1 className="app-title">Acesso e contexto da sua conta</h1>
        <p className="app-copy">
          Resumo do acesso atual, plano em uso e atalhos para as telas que afetam
          a operação do workspace.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Sessão atual
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {session?.user.fullName ?? "Usuário autenticado"}
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {session?.user.email ?? "Sem e-mail carregado"}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <AccountStat
              label="Nível de acesso"
              value={access?.label ?? "Sem sessão"}
              note={access?.description ?? "Faça login para carregar o contexto."}
            />
            <AccountStat
              label="Papel no workspace"
              value={
                session
                  ? workspaceRoleMeta[
                      session.workspace.role as keyof typeof workspaceRoleMeta
                    ]?.label ?? session.workspace.role
                  : "Indefinido"
              }
              note="Separado do papel de plataforma."
            />
            <AccountStat
              label="Workspace"
              value={session?.workspace.name ?? preferences.workspaceName}
              note={session?.workspace.slug ?? "Slug indisponível"}
            />
            <AccountStat
              label="Plano"
              value={plan.label}
              note={`${plan.monthlyPriceLabel}/mês`}
            />
          </div>
        </div>

        <aside className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Próximos destinos
          </p>
          <div className="mt-4 grid gap-3">
            <ActionLink
              href="/app/planos"
              title="Planos"
              description="Compare o plano atual com as outras faixas da plataforma."
            />
            <ActionLink
              href="/app/perfil-empresa"
              title="Perfil da empresa"
              description="Ajuste nome, contato e identidade operacional."
            />
            <ActionLink
              href="/app/equipe"
              title="Equipe"
              description="Gerencie membros, convites e distribuição de papéis."
            />
            <ActionLink
              href="/app/preferencias"
              title="Preferências"
              description="Revise política comercial, margens e integrações."
            />
          </div>
        </aside>
      </section>
    </div>
  );
}

function AccountStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{note}</p>
    </div>
  );
}

function ActionLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4 transition hover:border-[var(--accent)]"
    >
      <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
