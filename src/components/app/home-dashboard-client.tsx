"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import type { SavedCalculation } from "@/lib/history/calculation-history";
import {
  hydrateCalculationHistory,
  loadCalculationHistory,
  readCalculationHistory,
  subscribeCalculationHistory,
} from "@/lib/history/calculation-history";
import { formatCurrency, formatPercent } from "@/lib/pricing/formatters";
import type { AppPreferences } from "@/lib/settings/app-preferences";
import {
  getWorkspacePlan,
  hydrateAppPreferences,
  isCompanyProfileComplete,
  loadAppPreferences,
  readAppPreferences,
  subscribeAppPreferences,
} from "@/lib/settings/app-preferences";
import { buildWorkspaceCommercialSnapshot } from "@/lib/workspace/commercial-insights";

export function HomeDashboardClient({
  initialFullName,
  initialPreferences,
  initialHistory,
}: {
  initialFullName: string | null;
  initialPreferences: AppPreferences;
  initialHistory: SavedCalculation[];
}) {
  const preferences = useSyncExternalStore(
    subscribeAppPreferences,
    readAppPreferences,
    () => initialPreferences,
  );
  const history = useSyncExternalStore(
    subscribeCalculationHistory,
    readCalculationHistory,
    () => initialHistory,
  );

  useEffect(() => {
    hydrateAppPreferences(initialPreferences);
    hydrateCalculationHistory(initialHistory);

    void loadAppPreferences().catch(() => undefined);
    void loadCalculationHistory().catch(() => undefined);
  }, [initialHistory, initialPreferences]);

  const workspacePlan = getWorkspacePlan(preferences.subscription.planId);
  const commercialSnapshot = buildWorkspaceCommercialSnapshot({
    preferences,
    history,
    auditLog: [],
  });
  const firstName =
    initialFullName?.trim().split(/\s+/).filter(Boolean)[0] || "operador";
  const firstSteps = buildFirstSteps({
    preferences,
    historyCount: history.length,
  });

  return (
    <div className="app-page space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="app-card p-6 sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Início
          </p>
          <h1 className="app-title mt-4">Olá, {firstName}</h1>
          <p className="app-copy mt-4 max-w-[720px]">
            Organize sua operação, avance na identidade da empresa e mantenha os
            orçamentos salvos em um fluxo mais claro para quem usa a
            precificadora no dia a dia.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/app/precificacao" className="app-button app-button-primary">
              Nova precificação
            </Link>
            <Link href="/app/orcamentos" className="app-button app-button-secondary">
              Ver orçamentos
            </Link>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <HeroStat
              label="Configuração"
              value={`${firstSteps.filter((step) => step.done).length}/${firstSteps.length}`}
              note="etapas principais concluídas"
            />
            <HeroStat
              label="Orçamentos salvos"
              value={String(commercialSnapshot.historyCount)}
              note={`Limite atual ${commercialSnapshot.historyLimit}`}
            />
            <HeroStat
              label="Canais usados"
              value={String(commercialSnapshot.channelsUsedCount)}
              note="onde você já simulou orçamentos"
            />
          </div>
        </div>

        <aside className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Plano atual
          </p>
          <div className="mt-4 rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] p-5">
            <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {workspacePlan.label}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {workspacePlan.monthlyPriceLabel}/mês · {workspacePlan.supportLabel}
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              Seu plano inclui recursos de equipe, histórico salvo e integrações
              conforme a faixa contratada.
            </p>
            <Link
              href="/app/planos"
              className="app-button app-button-secondary mt-5 w-full"
            >
              Ver planos
            </Link>
          </div>
        </aside>
      </section>

      <section className="app-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              Primeiros passos
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              O que falta para a operação ficar redonda
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              A ideia aqui é transformar a primeira experiência em um fluxo claro de
              configuração, sem misturar o usuário com detalhes técnicos do ambiente.
            </p>
          </div>
          <span className="rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] px-4 py-2 text-xs font-semibold text-[var(--muted)]">
            {firstSteps.filter((step) => step.done).length} de {firstSteps.length} concluídos
          </span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {firstSteps.map((step) => (
            <article
              key={step.id}
              className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        step.done
                          ? "bg-[color:var(--success)]/14 text-[color:var(--success)]"
                          : "bg-[var(--accent-soft)] text-[var(--accent)]"
                      }`}
                    >
                      {step.done ? "✓" : "•"}
                    </span>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {step.description}
                  </p>
                </div>
                <Link href={step.href} className="app-button app-button-secondary">
                  {step.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="app-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                Orçamentos recentes
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                Últimos orçamentos salvos
              </h2>
            </div>
            <Link href="/app/orcamentos" className="app-button app-button-secondary">
              Abrir lista
            </Link>
          </div>

          {history.length === 0 ? (
            <div className="app-card-soft mt-6 p-8 text-center">
              <p className="text-lg font-semibold text-[var(--foreground)]">
                Nenhum orçamento salvo ainda.
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Salve a primeira precificação para começar seu histórico de
                orçamentos.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-[24px] border border-[var(--panel-border)]">
              <div className="divide-y divide-[var(--panel-border)]">
                {history.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 bg-[rgba(255,255,255,0.72)] px-5 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[var(--foreground)]">
                        {item.productName}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {item.salesChannelLabel} · {formatSavedDate(item.savedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-[var(--foreground)]">
                        {formatCurrency(item.summary.salePrice, item.displayCurrency)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Margem {formatPercent(item.summary.marginPercentage)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <section className="app-card p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
              Visão rápida
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              Resumo da sua conta
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MiniStat
                label="Margem média"
                value={formatPercent(commercialSnapshot.averageMarginPercentage)}
              />
              <MiniStat
                label="Orçamentos com lucro"
                value={`${commercialSnapshot.profitableItemsCount}/${commercialSnapshot.historyCount}`}
              />
              <MiniStat
                label="Equipe"
                value={formatWorkspaceMemberCount(commercialSnapshot.seatsUsed)}
              />
              <MiniStat
                label="Logo da empresa"
                value={preferences.companyLogoUrl ? "Enviada" : "Pendente"}
              />
            </div>
          </section>

          <section className="app-card-soft p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Atalhos
            </p>
            <div className="mt-4 grid gap-3">
              <QuickLinkCard
                href="/app/perfil-empresa"
                title="Configurar empresa"
                description="Centralize nome, responsável e contato operacional."
              />
              <QuickLinkCard
                href="/app/modelos-orcamento"
                title="Modelos de orçamento"
                description="Estruture como o orçamento será apresentado ao cliente."
              />
              <QuickLinkCard
                href="/app/equipe"
                title="Equipe"
                description="Convide membros e distribua papéis do workspace."
              />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function HeroStat({
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
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">{note}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function QuickLinkCard({
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

function formatSavedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatWorkspaceMemberCount(value: number) {
  return `${value} ${value === 1 ? "pessoa" : "pessoas"}`;
}

function buildFirstSteps(input: {
  preferences: AppPreferences;
  historyCount: number;
}) {
  const hasLogo = input.preferences.companyLogoUrl.length > 0;
  const pricingPolicyConfigured =
    input.preferences.pricingDefaults.profitMarginPercentage > 0 &&
    input.preferences.pricingDefaults.healthyMarginTargetPercentage > 0 &&
    input.preferences.pricingDefaults.laborCostPerHour > 0 &&
    input.preferences.pricingDefaults.kwhPrice > 0;

  return [
    {
      id: "profile",
      title: "Complete os dados da empresa",
      description:
        "Defina o nome da operação, responsável e contato que sustentam o restante do produto.",
      href: "/app/perfil-empresa",
      cta: "Configurar",
      done: isCompanyProfileComplete(input.preferences),
    },
    {
      id: "logo",
      title: "Adicione a logo da empresa",
      description:
        "Suba a identidade visual da empresa para começar a dar cara própria aos próximos orçamentos.",
      href: "/app/perfil-empresa",
      cta: "Enviar logo",
      done: hasLogo,
    },
    {
      id: "first-pricing",
      title: "Monte sua primeira precificação",
      description:
        "Faça um cálculo real e salve o resultado para começar seu histórico de orçamentos.",
      href: "/app/precificacao",
      cta: "Precificar",
      done: input.historyCount > 0,
    },
    {
      id: "policy",
      title: "Revise a política comercial",
      description:
        "Revise margens, perdas, mão de obra e demais premissas usadas pela precificadora.",
      href: "/app/preferencias",
      cta: "Revisar",
      done: pricingPolicyConfigured,
    },
  ];
}
