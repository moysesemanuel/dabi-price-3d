import { AppSidebar } from "@/components/app/app-sidebar";

export default function PreferencesPage() {
  return (
    <main className="app-shell min-h-screen text-white">
      <div className="min-h-screen lg:pl-[215px]">
        <AppSidebar />

        <div className="mx-auto max-w-[1488px] p-8">
          <header className="mb-6 border-b border-white/6 pb-6">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Preferências
            </h1>

            <p className="mt-2 text-sm text-[var(--muted)]">
              Espaço reservado para configurações futuras da precificadora.
            </p>
          </header>

          <section className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
            <p className="text-sm leading-7 text-[var(--muted)]">
              Aqui você poderá centralizar preferências como impressoras
              padrão, custos recorrentes, moeda inicial e parâmetros de
              marketplace.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
