import { Suspense } from "react";
import { BackLink } from "@/components/app/back-link";
import { PreferencesPanel } from "@/components/preferences/preferences-panel";
import { getMercadoLivreConnectionStatus } from "@/lib/marketplaces/mercado-livre-auth";

export default async function PreferencesPage() {
  let mercadoLivreStatus = null;

  try {
    mercadoLivreStatus = await getMercadoLivreConnectionStatus();
  } catch (error) {
    console.error(
      "[preferences] failed to load Mercado Livre status for page render",
      error,
    );
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
        <PreferencesPanel initialMercadoLivreStatus={mercadoLivreStatus} />
      </Suspense>
    </div>
  );
}
