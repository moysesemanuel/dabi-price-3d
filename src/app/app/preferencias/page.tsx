import { BackLink } from "@/components/app/back-link";
import { PreferencesPanel } from "@/components/preferences/preferences-panel";

export default function PreferencesPage() {
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

      <PreferencesPanel />
    </div>
  );
}
