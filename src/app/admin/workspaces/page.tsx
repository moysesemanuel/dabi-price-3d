import {
  AdminPageHeader,
  AdminPageSection,
  EmptyAdminState,
  WorkspacesTable,
} from "@/components/admin/billing-admin-ui";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export default async function BillingAdminWorkspacesPage() {
  const session = await requireCurrentAuthSession();
  const snapshot = await createBillingAdminService().getSnapshot(session);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Workspaces"
        title="Workspaces e estado comercial"
        description="Leitura do parque ativo com owner, assinatura corrente, período de acesso e volume operacional disponível no workspace."
      />

      <AdminPageSection
        title="Mapa dos workspaces"
        description="Lista recente dos workspaces com o retrato atual do billing corrente."
      >
        {snapshot.workspaces.length > 0 ? (
          <WorkspacesTable workspaces={snapshot.workspaces} />
        ) : (
          <EmptyAdminState message="Nenhum workspace encontrado para leitura administrativa." />
        )}
      </AdminPageSection>
    </div>
  );
}
