import { AppSidebar } from "@/components/app/app-sidebar";
import { PreferencesPanel } from "@/components/preferences/preferences-panel";

export default function PreferencesPage() {
  return (
    <main className="app-shell min-h-screen text-[#18120d]">
      <div className="min-h-screen transition-[padding] duration-300 lg:pl-[var(--app-sidebar-width)]">
        <AppSidebar />

        <div className="mx-auto max-w-[1488px] p-8">
          <header className="mb-6 border-b border-black/8 pb-6">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#18120d] sm:text-4xl">
              Preferências
            </h1>

            <p className="mt-2 text-sm text-[#7c6858]">
              Parâmetros gerais e contexto operacional da precificadora.
            </p>
          </header>

          <PreferencesPanel />
        </div>
      </div>
    </main>
  );
}
