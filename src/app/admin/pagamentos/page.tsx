import {
  AdminPageHeader,
  AdminPageSection,
  EmptyAdminState,
  InvoicesTable,
} from "@/components/admin/billing-admin-ui";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export default async function BillingAdminPaymentsPage() {
  const session = await requireCurrentAuthSession();
  const snapshot = await createBillingAdminService().getSnapshot(session);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Pagamentos"
        title="Invoices, cobrança e liquidação"
        description="Visão operacional dos pagamentos emitidos pelo billing, com leitura de tipo, status, método de pagamento e valor."
      />

      <AdminPageSection
        title="Invoices recentes"
        description="Lista operacional das invoices mais recentes emitidas pelo sistema."
      >
        {snapshot.invoices.length > 0 ? (
          <InvoicesTable invoices={snapshot.invoices} />
        ) : (
          <EmptyAdminState message="Nenhuma invoice registrada até o momento." />
        )}
      </AdminPageSection>
    </div>
  );
}
