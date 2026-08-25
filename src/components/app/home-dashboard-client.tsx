"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import {
  buildConfectioneryFinanceSnapshot,
  buildConfectioneryPreviewOrders,
  type ConfectioneryPreviewOrder,
} from "@/lib/confectionery/preview";
import type { SavedCalculation } from "@/lib/history/calculation-history";
import {
  hydrateCalculationHistory,
  loadCalculationHistory,
  readCalculationHistory,
  subscribeCalculationHistory,
} from "@/lib/history/calculation-history";
import {
  is3DCalculation,
  isConfectioneryCalculation,
} from "@/lib/history/workspace-calculations";
import { formatCurrency, formatPercent } from "@/lib/pricing/formatters";
import type { AppPreferences } from "@/lib/settings/app-preferences";
import type { WorkspaceSubscription } from "@/lib/workspace/catalog";
import {
  businessTypeMeta,
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
  isSuperAdmin,
  initialPreferences,
  initialHistory,
  initialCommercialSubscription,
}: {
  initialFullName: string | null;
  isSuperAdmin: boolean;
  initialPreferences: AppPreferences;
  initialHistory: SavedCalculation[];
  initialCommercialSubscription: WorkspaceSubscription;
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

  const workspacePlan = getWorkspacePlan(initialCommercialSubscription.planId);
  const firstName =
    initialFullName?.trim().split(/\s+/).filter(Boolean)[0] || "operador";
  const activeBusinessMeta = preferences.businessType
    ? businessTypeMeta[preferences.businessType]
    : null;
  const scopedHistory =
    preferences.businessType === "confectionery"
      ? history.filter((item) => isConfectioneryCalculation(item))
      : history.filter((item) => is3DCalculation(item));
  const firstSteps = buildFirstSteps({
    preferences,
    historyCount: scopedHistory.length,
  });
  const commercialSnapshot = buildWorkspaceCommercialSnapshot({
    preferences,
    subscription: initialCommercialSubscription,
    history: scopedHistory,
    auditLog: [],
  });

  if (preferences.businessType === "confectionery") {
    return (
      <ConfectioneryHomeDashboard
        firstName={firstName}
        history={scopedHistory}
        preferences={preferences}
        firstSteps={firstSteps}
        workspacePlanLabel={isSuperAdmin ? "Conta administrativa" : workspacePlan.label}
      />
    );
  }

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
            orçamentos salvos em um fluxo mais claro para quem usa a precificadora
            no dia a dia{activeBusinessMeta ? ` no ramo de ${activeBusinessMeta.label.toLowerCase()}` : ""}.
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
              value={String(scopedHistory.length)}
              note={
                isSuperAdmin
                  ? "Histórico ilimitado para esta conta"
                  : `Limite atual ${commercialSnapshot.historyLimit}`
              }
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
            {isSuperAdmin ? "Acesso da conta" : "Plano atual"}
          </p>
          <div className="mt-4 rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] p-5">
            <p className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {isSuperAdmin ? "Conta administrativa" : workspacePlan.label}
            </p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {isSuperAdmin
                ? "Acesso completo à plataforma"
                : `${workspacePlan.monthlyPriceLabel}/mês · ${workspacePlan.supportLabel}`}
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
              {isSuperAdmin
                ? "Esta conta não possui plano comercial, paywall ou limites de recursos."
                : "Seu plano inclui recursos de equipe, histórico salvo e integrações conforme a faixa contratada."}
            </p>
            {!isSuperAdmin ? (
              <Link
                href="/app/assinatura"
                className="app-button app-button-secondary mt-5 w-full"
              >
                Ver assinatura
              </Link>
            ) : null}
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
              <MiniStat
                label="Ramo principal"
                value={activeBusinessMeta?.label ?? "Pendente"}
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
                description="Estruture o orçamento conforme o ramo principal da conta."
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

function ConfectioneryHomeDashboard({
  firstName,
  history,
  preferences,
  firstSteps,
  workspacePlanLabel,
}: {
  firstName: string;
  history: SavedCalculation[];
  preferences: AppPreferences;
  firstSteps: ReturnType<typeof buildFirstSteps>;
  workspacePlanLabel: string;
}) {
  const orders = buildConfectioneryPreviewOrders(history);
  const finance = buildConfectioneryFinanceSnapshot(orders);
  const scheduledOrders = orders.filter((order) => order.status === "scheduled");
  const inProgressOrders = orders.filter((order) => order.status === "in_progress");
  const doneOrders = orders.filter((order) => order.status === "done");
  const completedSteps = firstSteps.filter((step) => step.done).length;
  const totalPendingAmount = orders.reduce(
    (total, order) => total + order.remainingAmount,
    0,
  );

  return (
    <div className="app-page space-y-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="app-card overflow-hidden p-0">
          <div className="border-b border-[var(--panel-border)] bg-[linear-gradient(135deg,rgba(233,247,239,0.95)_0%,rgba(255,244,248,0.96)_100%)] px-6 py-6 sm:px-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-[#b9ddc9] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f9079]">
                Template confeitaria
              </span>
              <span className="rounded-full border border-[#f1c5d4] bg-[#fff5f8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#cf7395]">
                Operação do dia
              </span>
            </div>
            <h1 className="mt-5 text-[clamp(2.1rem,4vw,3.4rem)] font-semibold tracking-[-0.07em] text-[var(--foreground)]">
              Olá, {firstName}
            </h1>
            <p className="mt-3 max-w-[760px] text-sm leading-8 text-[var(--muted)]">
              A confeitaria já pode trabalhar com uma visão mais operacional:
              agenda, produção, recebimento e fluxo financeiro na mesma camada do
              workspace.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/app/precificacao" className="app-button app-button-primary">
                Abrir calculadora
              </Link>
              <Link href="/app/receitas" className="app-button app-button-secondary">
                Ver receitas
              </Link>
              <Link href="/app/agenda" className="app-button app-button-secondary">
                Abrir agenda
              </Link>
              <Link href="/app/financeiro" className="app-button app-button-secondary">
                Ver financeiro
              </Link>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
            <ConfectioneryLane
              title="Produções agendadas"
              count={scheduledOrders.length}
              tone="rose"
              items={scheduledOrders}
              currency={preferences.defaultDisplayCurrency}
            />
            <ConfectioneryLane
              title="Em produção"
              count={inProgressOrders.length}
              tone="mint"
              items={inProgressOrders}
              currency={preferences.defaultDisplayCurrency}
            />
            <ConfectioneryLane
              title="Concluídos"
              count={doneOrders.length}
              tone="sky"
              items={doneOrders}
              currency={preferences.defaultDisplayCurrency}
            />
          </div>
        </div>

        <aside className="space-y-4">
          <section className="app-card p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#7ca08f]">
                  Hoje
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  {formatCurrency(finance.revenue, preferences.defaultDisplayCurrency)}
                </p>
              </div>
              <span className="rounded-full border border-[#f6cfdb] bg-[#fff3f7] px-3 py-2 text-xs font-semibold text-[#d26f92]">
                {workspacePlanLabel}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <SummaryPill
                label="Pedidos do dia"
                value={`${orders.length} ativos`}
                tone="mint"
              />
              <SummaryPill
                label="Saldo pendente"
                value={formatCurrency(
                  totalPendingAmount,
                  preferences.defaultDisplayCurrency,
                )}
                tone="rose"
              />
              <SummaryPill
                label="Configuração"
                value={`${completedSteps}/${firstSteps.length} passos`}
                tone="sky"
              />
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">Progresso do dia</span>
                <span className="font-semibold text-[#d26f92]">
                  {Math.round((doneOrders.length / Math.max(orders.length, 1)) * 100)}%
                </span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-[#eef7f2]">
                <div
                  className="h-3 rounded-full bg-[linear-gradient(90deg,#76c8a3_0%,#ef7aa6_100%)]"
                  style={{
                    width: `${Math.max(
                      18,
                      Math.round((doneOrders.length / Math.max(orders.length, 1)) * 100),
                    )}%`,
                  }}
                />
              </div>
            </div>
          </section>

          <section className="app-card-soft p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Acessos rápidos
            </p>
            <div className="mt-4 grid gap-3">
              <ConfectioneryQuickLink
                href="/app/agenda"
                title="Agenda"
                description="Pedidos por dia, retirada e entrega."
              />
              <ConfectioneryQuickLink
                href="/app/financeiro"
                title="Financeiro"
                description="Receitas, despesas e categorias do mês."
              />
              <ConfectioneryQuickLink
                href="/app/perfil-empresa"
                title="Meu perfil"
                description="Marca, contato e dados da operação."
              />
            </div>
          </section>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
        <article className="app-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                Próximos passos
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                Fechar a operação base
              </h2>
            </div>
            <span className="rounded-full border border-[var(--panel-border)] bg-white/80 px-4 py-2 text-xs font-semibold text-[var(--muted)]">
              {completedSteps} de {firstSteps.length} concluídos
            </span>
          </div>

          <div className="mt-6 grid gap-4">
            {firstSteps.slice(0, 4).map((step) => (
              <article
                key={step.id}
                className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                          step.done
                            ? "bg-[#e8f6ee] text-[#4f8a68]"
                            : "bg-[#fff1f6] text-[#cf7395]"
                        }`}
                      >
                        {step.done ? "✓" : "•"}
                      </span>
                      <h3 className="text-base font-semibold text-[var(--foreground)]">
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
        </article>

        <article className="app-card p-6 sm:p-7">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Receita vs despesas
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            Leitura rápida do mês
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <FinanceStatCard
              label="Receitas"
              value={formatCurrency(finance.revenue, preferences.defaultDisplayCurrency)}
              tone="mint"
            />
            <FinanceStatCard
              label="Despesas"
              value={formatCurrency(finance.expenses, preferences.defaultDisplayCurrency)}
              tone="rose"
            />
          </div>

          <div className="mt-6 space-y-4">
            <FinanceProgressRow
              label="Receitas"
              percentage={finance.revenueShare}
              tone="mint"
            />
            <FinanceProgressRow
              label="Despesas"
              percentage={finance.expenseShare}
              tone="rose"
            />
          </div>

          <div className="mt-6 grid gap-3">
            {finance.categories.map((category) => (
              <CategoryRow
                key={category.label}
                label={category.label}
                amount={formatCurrency(
                  category.amount,
                  preferences.defaultDisplayCurrency,
                )}
                percentage={category.percentage}
                tone={category.tone}
              />
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function ConfectioneryLane({
  title,
  count,
  tone,
  items,
  currency,
}: {
  title: string;
  count: number;
  tone: "rose" | "mint" | "sky";
  items: ConfectioneryPreviewOrder[];
  currency: AppPreferences["defaultDisplayCurrency"];
}) {
  return (
    <section
      className={`rounded-[28px] border p-4 ${
        tone === "rose"
          ? "border-[#f5c7d7] bg-[#fff8fb]"
          : tone === "mint"
            ? "border-[#cfe9db] bg-[#f6fcf8]"
            : "border-[#cfe2f5] bg-[#f7fbff]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-[var(--foreground)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{count} pedido(s)</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            tone === "rose"
              ? "bg-[#ffe4ee] text-[#cf7395]"
              : tone === "mint"
                ? "bg-[#e4f5ec] text-[#5f9079]"
                : "bg-[#e7f1fb] text-[#6492bc]"
          }`}
        >
          {tone === "rose" ? "Fila" : tone === "mint" ? "Ativo" : "Ok"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <ConfectioneryOrderCard
            key={item.id}
            order={item}
            currency={currency}
            compact
          />
        ))}
      </div>
    </section>
  );
}

function ConfectioneryOrderCard({
  order,
  currency,
  compact = false,
}: {
  order: ConfectioneryPreviewOrder;
  currency: AppPreferences["defaultDisplayCurrency"];
  compact?: boolean;
}) {
  return (
    <article className="rounded-[24px] border border-white/80 bg-white/88 p-4 shadow-[0_10px_26px_rgba(136,181,158,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-[var(--foreground)]">
            {order.productName}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">{order.clientName}</p>
        </div>
        <StatusBadge status={order.status} label={order.statusLabel} />
      </div>

      <div className="mt-4 space-y-2 text-sm text-[var(--muted)]">
        <p>{order.scheduledLabel}</p>
        <p>Tempo médio: {order.productionDurationLabel}</p>
        <p>Quantidade: {order.quantityLabel}</p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          <span>{order.progressLabel}</span>
          <span>{order.progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-[#eff7f2]">
          <div
            className={`h-2 rounded-full ${
              order.status === "scheduled"
                ? "bg-[#ef7aa6]"
                : order.status === "in_progress"
                  ? "bg-[#67c195]"
                  : "bg-[#6fa8d8]"
            }`}
            style={{ width: `${order.progressPercent}%` }}
          />
        </div>
      </div>

      <div
        className={`mt-4 grid gap-3 ${
          compact ? "grid-cols-1" : "grid-cols-2"
        }`}
      >
        <InfoMetric
          label="Total"
          value={formatCurrency(order.totalValue, currency)}
          tone="default"
        />
        <InfoMetric
          label="Saldo"
          value={formatCurrency(order.remainingAmount, currency)}
          tone={order.remainingAmount > 0 ? "rose" : "mint"}
        />
      </div>
    </article>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: ConfectioneryPreviewOrder["status"];
  label: string;
}) {
  const className =
    status === "scheduled"
      ? "border-[#f5c7d7] bg-[#fff1f6] text-[#cf7395]"
      : status === "in_progress"
        ? "border-[#cfe9db] bg-[#ebf8f1] text-[#5f9079]"
        : "border-[#cfe2f5] bg-[#eef6fd] text-[#6492bc]";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "rose" | "sky";
}) {
  const className =
    tone === "mint"
      ? "border-[#cfe9db] bg-[#f4fbf7] text-[#5f9079]"
      : tone === "rose"
        ? "border-[#f5c7d7] bg-[#fff5f8] text-[#cf7395]"
        : "border-[#cfe2f5] bg-[#f7fbff] text-[#6492bc]";

  return (
    <div className={`rounded-[22px] border px-4 py-3 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ConfectioneryQuickLink({
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
      className="rounded-[24px] border border-[var(--panel-border)] bg-white/82 px-4 py-4 transition hover:border-[#f1c5d4] hover:bg-[#fff7fa]"
    >
      <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </Link>
  );
}

function FinanceStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "rose";
}) {
  return (
    <div
      className={`rounded-[24px] border px-4 py-4 ${
        tone === "mint"
          ? "border-[#cfe9db] bg-[#f4fbf7]"
          : "border-[#f5c7d7] bg-[#fff5f8]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-[-0.05em] ${
          tone === "mint" ? "text-[#3f936b]" : "text-[#d25581]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FinanceProgressRow({
  label,
  percentage,
  tone,
}: {
  label: string;
  percentage: number;
  tone: "mint" | "rose";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-[var(--foreground)]">{label}</span>
        <span className="font-semibold text-[var(--muted)]">
          {percentage.toFixed(1).replace(".", ",")}%
        </span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-[#edf5f0]">
        <div
          className={`h-3 rounded-full ${tone === "mint" ? "bg-[#37bd8d]" : "bg-[#ef5b88]"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function CategoryRow({
  label,
  amount,
  percentage,
  tone,
}: {
  label: string;
  amount: string;
  percentage: number;
  tone: "mint" | "rose" | "amber" | "sky" | "violet";
}) {
  const dotClassName =
    tone === "mint"
      ? "bg-[#37bd8d]"
      : tone === "rose"
        ? "bg-[#ef5b88]"
        : tone === "amber"
          ? "bg-[#f3b35b]"
          : tone === "sky"
            ? "bg-[#42a0dd]"
            : "bg-[#9a67e8]";

  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] border border-[var(--panel-border)] bg-white/78 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`inline-flex size-3 rounded-full ${dotClassName}`} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {label}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">{amount}</p>
        </div>
      </div>
      <span className="text-sm font-semibold text-[var(--muted)]">
        {percentage.toFixed(1).replace(".", ",")}%
      </span>
    </div>
  );
}

function InfoMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "mint" | "rose";
}) {
  return (
    <div
      className={`rounded-[18px] border px-3 py-3 ${
        tone === "mint"
          ? "border-[#cfe9db] bg-[#f2faf6]"
          : tone === "rose"
            ? "border-[#f5c7d7] bg-[#fff4f8]"
            : "border-[var(--panel-border)] bg-[#fcfffd]"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</p>
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
      id: "business-type",
      title: "Defina o ramo principal",
      description:
        "Escolha se a conta é de impressão 3D, confeitaria, artesanato ou produto normal.",
      href: "/app/precificacao",
      cta: "Escolher",
      done: input.preferences.businessType !== null,
    },
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
