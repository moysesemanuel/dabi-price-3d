import {
  AdminPageHeader,
  AdminPageSection,
  AuditEventsTable,
  EmptyAdminState,
  FindingsList,
  InvoicesTable,
  SummaryGrid,
  WebhookEventsTable,
} from "@/components/admin/billing-admin-ui";
import { AdminDashboardAnalyticsCharts } from "@/components/admin/dashboard/admin-dashboard-analytics-charts";
import { AdminDashboardPeriodFilter } from "@/components/admin/dashboard/admin-dashboard-period-filter";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getAdminDashboardAnalyticsForSession } from "@/lib/billing/admin-dashboard-analytics-service";
import { resolveAdminDashboardPeriod } from "@/lib/billing/admin-dashboard-chart-data";

export default async function BillingAdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ period?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const period = resolveAdminDashboardPeriod(params.period);
  const session = await requireCurrentAuthSession();
  const [snapshot, analyticsResult] = await Promise.all([
    createBillingAdminService().getSnapshot(session),
    getAdminDashboardAnalyticsForSession({ session, preset: period })
      .then((analytics) => ({ analytics, error: null as string | null }))
      .catch(() => ({ analytics: null, error: "Os gráficos não puderam ser carregados agora. Os indicadores operacionais continuam disponíveis." })),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Dashboard"
        title="Painel operacional do billing"
        description="Visão consolidada da receita, estados de assinatura, qualidade operacional dos webhooks e backlog que ainda pede intervenção administrativa."
      />

      <AdminPageSection title="Indicadores principais" description="Leitura rápida dos números mais sensíveis para suporte e operação comercial.">
        <SummaryGrid summary={snapshot.summary} />
      </AdminPageSection>

      <section className="space-y-4" aria-labelledby="analytics-heading">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <h2 id="analytics-heading" className="text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">Análise do período</h2>
            <p className="text-sm leading-6 text-[var(--muted)]">Séries consolidadas pelo calendário de São Paulo.</p>
          </div>
          <AdminDashboardPeriodFilter period={period} />
        </div>
        {analyticsResult.analytics ? <AdminDashboardAnalyticsCharts analytics={analyticsResult.analytics} /> : (
          <div className="rounded-2xl border border-[var(--danger)] bg-[var(--panel-soft)] p-5 text-sm leading-6 text-[var(--foreground)]" role="alert">{analyticsResult.error}</div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <AdminPageSection
          title="Eventos de webhook"
          description="Últimos eventos registrados para inspeção rápida do pipeline de cobrança."
        >
          {snapshot.webhookEvents.length > 0 ? (
            <WebhookEventsTable webhookEvents={snapshot.webhookEvents.slice(0, 8)} />
          ) : (
            <EmptyAdminState message="Nenhum webhook registrado ainda neste ambiente." />
          )}
        </AdminPageSection>

        <AdminPageSection
          title="Divergências abertas"
          description="Itens que ainda precisam de reconciliação ou análise manual do suporte."
        >
          <FindingsList findings={snapshot.findings} />
        </AdminPageSection>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AdminPageSection
          title="Pagamentos recentes"
          description="Amostra curta das invoices mais recentes para leitura operacional."
        >
          {snapshot.invoices.length > 0 ? (
            <InvoicesTable invoices={snapshot.invoices.slice(0, 8)} />
          ) : (
            <EmptyAdminState message="Nenhuma invoice registrada ainda." />
          )}
        </AdminPageSection>

        <AdminPageSection
          title="Timeline administrativa"
          description="Últimos eventos de auditoria gerados pelas ações do billing."
        >
          {snapshot.auditEvents.length > 0 ? (
            <AuditEventsTable auditEvents={snapshot.auditEvents.slice(0, 8)} />
          ) : (
            <EmptyAdminState message="Nenhuma trilha de auditoria disponível." />
          )}
        </AdminPageSection>
      </div>
    </div>
  );
}
