import { BackLink } from "@/components/app/back-link";
import { CompanyProfilePanel } from "@/components/company/company-profile-panel";
import { isSuperAdminRole } from "@/lib/auth/access-control";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import { defaultAppPreferences } from "@/lib/settings/app-preferences";

export default async function CompanyProfilePage() {
  const session = await getCurrentAuthSession();
  const initialPreferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : defaultAppPreferences;
  const canEditBusinessType = session
    ? isSuperAdminRole(session.user.platformRole)
    : false;

  return (
    <div className="app-page">
      <header className="app-header">
        <BackLink href="/app" label="Voltar para o início" />
        <p className="app-eyebrow">Perfil da empresa</p>
        <h1 className="app-title">Identidade comercial da empresa</h1>
        <p className="app-copy">
          Centralize logo, contato, localização, pagamentos e presença online para
          o restante do produto conversar com a mesma identidade.
        </p>
      </header>

      <CompanyProfilePanel
        initialPreferences={initialPreferences}
        canEditBusinessType={canEditBusinessType}
      />
    </div>
  );
}
