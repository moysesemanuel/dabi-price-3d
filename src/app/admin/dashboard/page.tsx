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
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export default async function BillingAdminDashboardPage() {
  const session = await requireCurrentAuthSession();
  const snapshot = await createBillingAdminService().getSnapshot(session);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Dashboard"
        title="Painel operacional do billing"
        description="Visão consolidada da receita, estados de assinatura, qualidade operacional dos webhooks e backlog que ainda pede intervenção administrativa."
      />

      <AdminPageSection
        title="Indicadores principais"
        description="Leitura rápida dos números mais sensíveis para suporte e operação comercial."
      >
        <SummaryGrid summary={snapshot.summary} />
      </AdminPageSection>

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
