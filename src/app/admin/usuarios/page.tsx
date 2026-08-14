import { PlatformUsersPanel } from "@/components/admin/platform-users-panel";
import { AdminPageHeader } from "@/components/admin/billing-admin-ui";
import { getAdminUsersSnapshot } from "@/lib/auth/admin-users";
import { requireCurrentAuthSession } from "@/lib/auth/session";

export default async function BillingAdminUsersPage() {
  const session = await requireCurrentAuthSession();

  let initialSnapshot = null;
  let initialError: string | null = null;

  try {
    initialSnapshot = await getAdminUsersSnapshot(session);
  } catch (error) {
    initialError =
      error instanceof Error
        ? error.message
        : "Falha ao carregar usuarios da plataforma.";
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Usuarios"
        title="Cadastro global de usuarios"
        description="Painel administrativo para localizar usuarios, revisar status de acesso e executar correções de suporte sem depender da navegação do workspace."
      />

      <PlatformUsersPanel
        initialSnapshot={initialSnapshot}
        initialError={initialError}
      />
    </div>
  );
}
