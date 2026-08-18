import {
  AdminPageHeader,
  AdminPageSection,
  AuditEventsTable,
  EmptyAdminState,
  FindingsList,
  WebhookEventsTable,
} from "@/components/admin/billing-admin-ui";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export default async function BillingAdminEventsPage() {
  const session = await requireCurrentAuthSession();
  const snapshot = await createBillingAdminService().getSnapshot(session);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Eventos"
        title="Webhooks, auditoria e divergências"
        description="Monitoramento do fluxo operacional do billing: eventos recebidos, erros de processamento, trilha de auditoria e backlog de reconciliação."
      />

      <AdminPageSection
        title="Webhooks registrados"
        description="Linha do tempo dos últimos eventos recebidos do provider."
      >
        {snapshot.webhookEvents.length > 0 ? (
          <WebhookEventsTable webhookEvents={snapshot.webhookEvents} />
        ) : (
          <EmptyAdminState message="Nenhum evento de webhook registrado ainda." />
        )}
      </AdminPageSection>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <AdminPageSection
          title="Auditoria de billing"
          description="Ações do sistema, do webhook e do suporte administrativo."
        >
          {snapshot.auditEvents.length > 0 ? (
            <AuditEventsTable auditEvents={snapshot.auditEvents} />
          ) : (
            <EmptyAdminState message="Sem eventos de auditoria até agora." />
          )}
        </AdminPageSection>

        <AdminPageSection
          title="Itens abertos"
          description="Falhas e inconsistências que ainda exigem análise ou intervenção."
        >
          <FindingsList findings={snapshot.findings} />
        </AdminPageSection>
      </div>
    </div>
  );
}
