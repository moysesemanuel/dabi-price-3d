import Link from "next/link";
import type { ReactNode } from "react";
import { BackLink } from "@/components/app/back-link";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  defaultAppPreferences,
  getWorkspacePlan,
  workspacePlans,
} from "@/lib/settings/app-preferences";

const planFeatureRows = [
  {
    label: "Precificações e exportação PDF",
    values: {
      starter: "Ilimitado",
      growth: "Ilimitado",
      scale: "Ilimitado",
    },
  },
  {
    label: "Orçamentos salvos",
    values: {
      starter: "Até 50",
      growth: "Até 200",
      scale: "Até 1000",
    },
  },
  {
    label: "Usuários incluídos",
    values: {
      starter: "1 usuário",
      growth: "3 usuários",
      scale: "10 usuários",
    },
  },
  {
    label: "Logo e identidade da empresa",
    values: {
      starter: "Incluído",
      growth: "Incluído",
      scale: "Incluído",
    },
  },
  {
    label: "Modelos de orçamento",
    values: {
      starter: "Base",
      growth: "Avançado",
      scale: "Completo",
    },
  },
  {
    label: "Integrações ERP e Mercado Livre",
    values: {
      starter: "Sob demanda",
      growth: "Disponível",
      scale: "Prioridade máxima",
    },
  },
  {
    label: "Suporte",
    values: {
      starter: "Base",
      growth: "Prioritário",
      scale: "Consultivo",
    },
  },
] as const;

const planFaq = [
  {
    question: "Já existe cobrança dentro do app?",
    answer:
      "Ainda não. Enquanto o checkout não entra, a página de planos serve para deixar o posicionamento comercial claro e orientar upgrades.",
  },
  {
    question: "Posso mudar o plano depois?",
    answer:
      "Sim. A estrutura já está preparada para refletir o plano atual da conta e suportar upgrades sem mexer no restante do workspace.",
  },
  {
    question: "O que muda na prática entre as faixas?",
    answer:
      "Hoje as diferenças mais objetivas são histórico salvo, quantidade de usuários e prioridade de integração e suporte. A página mostra isso de forma centralizada.",
  },
] as const;

export default async function PlansPage() {
  const session = await getCurrentAuthSession();
  const preferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : defaultAppPreferences;
  const currentPlan = getWorkspacePlan(preferences.subscription.planId);

  return (
    <div className="app-page space-y-6">
      <header className="app-header">
        <BackLink href="/app" label="Voltar para o início" />
        <p className="app-eyebrow">Planos</p>
        <h1 className="app-title">Plano atual e evolução da conta</h1>
        <p className="app-copy">
          Visualize a faixa contratada do workspace, compare o que muda em cada
          plano e deixe a área comercial do produto mais clara para o usuário.
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_340px]">
        <div className="app-card p-6 sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Plano em uso
          </p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {currentPlan.label}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                {currentPlan.description}
              </p>
            </div>
            <span className="rounded-full border border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-2 text-xs font-semibold text-[var(--accent)]">
              Plano atual
            </span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <PlanStat
              label="Valor mensal"
              value={`${currentPlan.monthlyPriceLabel}/mês`}
            />
            <PlanStat
              label="Orçamentos salvos"
              value={`Até ${currentPlan.historyLimit}`}
            />
            <PlanStat
              label="Equipe incluída"
              value={`${currentPlan.seatsIncluded} ${
                currentPlan.seatsIncluded === 1 ? "usuário" : "usuários"
              }`}
            />
          </div>
        </div>

        <aside className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Próximo passo comercial
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Evolua quando fizer sentido
          </h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
            Como ainda não existe checkout no produto, a mudança de faixa continua
            sendo orientada pelo contato comercial.
          </p>
          <div className="mt-5 grid gap-3">
            <Link href="/contato" className="app-button app-button-primary w-full">
              Falar sobre upgrade
            </Link>
            <Link
              href="/app/perfil-empresa"
              className="app-button app-button-secondary w-full"
            >
              Revisar perfil da empresa
            </Link>
          </div>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {workspacePlans.map((plan) => {
          const isCurrent = plan.id === currentPlan.id;

          return (
            <article
              key={plan.id}
              className={`rounded-[28px] border p-6 shadow-[0_18px_44px_rgba(57,37,118,0.06)] ${
                isCurrent
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  {plan.label}
                </p>
                {isCurrent ? (
                  <span className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white">
                    Atual
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {plan.description}
              </p>

              <div className="mt-5">
                <p className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  {plan.monthlyPriceLabel}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">por workspace / mês</p>
              </div>

              <div className="mt-5 space-y-3">
                <PlanBullet>Até {plan.historyLimit} orçamentos salvos</PlanBullet>
                <PlanBullet>
                  {plan.seatsIncluded}{" "}
                  {plan.seatsIncluded === 1 ? "usuário incluído" : "usuários incluídos"}
                </PlanBullet>
                <PlanBullet>{plan.supportLabel}</PlanBullet>
                <PlanBullet>
                  {plan.erpSyncEnabled
                    ? "Integrações ERP liberadas"
                    : "Integrações ERP sob avaliação"}
                </PlanBullet>
              </div>

              <div className="mt-6">
                {isCurrent ? (
                  <div className="app-button app-button-secondary w-full justify-center text-center">
                    Plano atual
                  </div>
                ) : (
                  <Link href="/contato" className="app-button app-button-primary w-full">
                    Conversar sobre este plano
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="app-card p-0 overflow-hidden">
        <div className="border-b border-[var(--panel-border)] px-6 py-5 sm:px-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Comparação rápida
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            O que muda de um plano para outro
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[rgba(255,255,255,0.7)] text-left">
                <th className="border-b border-[var(--panel-border)] px-6 py-4 font-semibold text-[var(--foreground)]">
                  Recurso
                </th>
                {workspacePlans.map((plan) => (
                  <th
                    key={plan.id}
                    className="border-b border-[var(--panel-border)] px-6 py-4 font-semibold text-[var(--foreground)]"
                  >
                    {plan.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planFeatureRows.map((row) => (
                <tr key={row.label} className="bg-[rgba(255,255,255,0.74)]">
                  <td className="border-b border-[var(--panel-border)] px-6 py-4 text-[var(--foreground)]">
                    {row.label}
                  </td>
                  {workspacePlans.map((plan) => (
                    <td
                      key={`${row.label}-${plan.id}`}
                      className={`border-b border-[var(--panel-border)] px-6 py-4 ${
                        plan.id === currentPlan.id
                          ? "font-semibold text-[var(--accent)]"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      {row.values[plan.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {planFaq.map((item) => (
          <article key={item.question} className="app-card p-6">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {item.question}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {item.answer}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function PlanBullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/14 text-[11px] font-semibold text-[var(--accent)]">
        ✓
      </span>
      <p className="text-sm leading-7 text-[var(--muted)]">{children}</p>
    </div>
  );
}
