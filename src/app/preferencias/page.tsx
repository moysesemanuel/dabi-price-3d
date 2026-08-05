import { AppSidebar } from "@/components/app/app-sidebar";

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

          <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
              Mercado Livre
            </p>

            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
              Integração gerenciada no ERP
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
              A precificadora não é mais responsável por conectar contas,
              armazenar credenciais ou administrar OAuth de marketplace. O
              vínculo com Mercado Livre deve ser gerenciado no ERP, que segue
              como origem oficial de catálogo e publicação.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <StatusCard
                label="Responsável"
                value="ERP da operação"
              />
              <StatusCard
                label="Na precificadora"
                value="Somente contexto comercial"
              />
              <StatusCard
                label="Credenciais"
                value="Ocultas desta interface"
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/8 bg-[#fff3ea] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </p>
      <p className="mt-3 text-sm font-medium text-[#18120d]">{value}</p>
    </div>
  );
}
