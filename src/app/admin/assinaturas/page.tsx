import {
  AdminPageHeader,
  AdminPageSection,
  EmptyAdminState,
  SubscriptionsTable,
} from "@/components/admin/billing-admin-ui";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export default async function BillingAdminSubscriptionsPage() {
  const session = await requireCurrentAuthSession();
  const snapshot = await createBillingAdminService().getSnapshot(session);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Assinaturas"
        title="Assinaturas, estados e exceções"
        description="Área para localizar contratos correntes, acessar detalhe operacional, timeline, invoices e ações administrativas de suporte."
      />

      <AdminPageSection
        title="Assinaturas recentes"
        description="Os contratos abaixo concentram status, período, provider e acesso administrativo ao detalhe."
      >
        {snapshot.subscriptions.length > 0 ? (
          <SubscriptionsTable subscriptions={snapshot.subscriptions} />
        ) : (
          <EmptyAdminState message="Nenhuma assinatura registrada ainda no billing." />
        )}
      </AdminPageSection>
    </div>
  );
}
