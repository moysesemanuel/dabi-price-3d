import { Suspense } from "react";
import { BackLink } from "@/components/app/back-link";
import { PreferencesPanel } from "@/components/preferences/preferences-panel";
import { getMercadoLivreConnectionStatus } from "@/lib/marketplaces/mercado-livre-auth";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import { defaultAppPreferences, type AppPreferences } from "@/lib/settings/app-preferences";

export default async function PreferencesPage() {
  let mercadoLivreStatus = null;
  let initialPreferences: AppPreferences = defaultAppPreferences;

  try {
    mercadoLivreStatus = await getMercadoLivreConnectionStatus();
  } catch (error) {
    console.error(
      "[preferences] failed to load Mercado Livre status for page render",
      error,
    );
  }

  if (isPlatformPersistenceAvailable()) {
    const session = await getCurrentAuthSession();

    if (session) {
      try {
        initialPreferences = await getWorkspacePreferences(session.workspace.id);
      } catch (error) {
        console.error(
          "[preferences] failed to load workspace preferences for page render",
          error,
        );
      }
    }
  }

  return (
    <div className="app-page">
      <header className="app-header">
        <BackLink href="/app/precificacao" label="Voltar para a precificadora" />
        <p className="app-eyebrow">Preferências</p>
        <h1 className="app-title">Parâmetros da operação</h1>

        <p className="app-copy">
          Parâmetros gerais e contexto operacional da precificadora.
        </p>
      </header>

      <Suspense fallback={null}>
        <PreferencesPanel
          initialMercadoLivreStatus={mercadoLivreStatus}
          initialPreferences={initialPreferences}
        />
      </Suspense>
    </div>
  );
}
