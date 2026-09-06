import {
  AdminPageHeader,
  AdminPageSection,
} from "@/components/admin/billing-admin-ui";
import { CompanyIdentityPanel } from "@/components/admin/company-identity-panel";
import { getCompanyIdentity } from "@/lib/legal/company-identity-server";
import {
  isPlatformPersistenceAvailable,
  listCompanyIdentityChanges,
} from "@/lib/server/platform";

export default async function AdminSettingsPage() {
  const companyIdentity = await getCompanyIdentity();
  const identityHistory = isPlatformPersistenceAvailable()
    ? await listCompanyIdentityChanges().catch(() => [])
    : [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Configurações"
        title="Dados da empresa"
        description="Identificação que aparece nos documentos legais e nas páginas públicas. Diferente das telas de operação, aqui a mudança é rara e cada alteração fica registrada."
      />

      <AdminPageSection
        title="Identidade da empresa"
        description="Razão social, CNPJ, endereço e canais exibidos nos Termos, na Política de Privacidade e no rodapé."
      >
        <CompanyIdentityPanel
          initialIdentity={companyIdentity}
          history={identityHistory}
        />
      </AdminPageSection>
    </div>
  );
}
