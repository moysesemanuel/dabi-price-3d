import Link from "next/link";
import { AppSidebar } from "@/components/app/app-sidebar";
import { getMercadoLivreConnectionStatus } from "@/lib/marketplaces/mercado-livre-auth";

type PreferencesPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PreferencesPage({
  searchParams,
}: PreferencesPageProps) {
  const [connectionStatus, resolvedSearchParams] = await Promise.all([
    getMercadoLivreConnectionStatus(),
    searchParams,
  ]);

  const meliStatus = getSingleSearchParam(resolvedSearchParams.meli);
  const reason = getSingleSearchParam(resolvedSearchParams.reason);

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
              Gerencie integrações e parâmetros da operação.
            </p>
          </header>

          <div className="space-y-4">
            {meliStatus === "connected" ? (
              <StatusBanner
                tone="success"
                title="Mercado Livre conectado"
                description="A conta foi autorizada e os tokens ficaram salvos com renovação automática."
              />
            ) : null}

            {meliStatus === "error" ? (
              <StatusBanner
                tone="danger"
                title="Falha ao conectar Mercado Livre"
                description={reason ?? "Verifique a configuração e tente novamente."}
              />
            ) : null}

            <section className="rounded-[26px] border border-[#e9ddd4] bg-white p-6 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
                    Mercado Livre
                  </p>

                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#18120d]">
                    Conexão com Mercado Livre
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[#7c6858]">
                    Conecte sua conta para consultar categorias, taxas e dados
                    do canal com mais agilidade.
                  </p>
                </div>

                <Link
                  href="/api/auth/meli/start"
                  className="rounded-2xl border border-[#ff6a00] bg-[#ff6a00] px-4 py-3 text-sm font-medium text-white transition hover:brightness-110"
                >
                  {connectionStatus.connected
                    ? "Reconectar conta"
                    : "Conectar Mercado Livre"}
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <StatusCard
                  label="Conexão"
                  value={
                    connectionStatus.mode === "persistent"
                      ? "Automática"
                      : connectionStatus.mode === "legacy-env"
                        ? "Manual"
                        : "Não configurada"
                  }
                />
                <StatusCard
                  label="Conta"
                  value={connectionStatus.userId ?? "Não conectada"}
                />
                <StatusCard
                  label="Expiração"
                  value={formatOptionalDate(connectionStatus.expiresAt)}
                />
              </div>

              <div className="mt-6 rounded-[22px] border border-black/8 bg-[#fff3ea] p-5">
                <p className="text-sm font-medium text-[#18120d]">
                  Configuração necessária
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <EnvChip name="DATABASE_URL" />
                  <EnvChip name="MELI_CLIENT_ID" />
                  <EnvChip name="MELI_CLIENT_SECRET" />
                  <EnvChip name="MELI_REDIRECT_URI" />
                </div>

                <p className="mt-4 text-xs leading-6 text-[#7c6858]">
                  Use como redirect URI
                  {" "}
                  <span className="font-mono text-[#18120d]">
                    https://SEU-DOMINIO/api/auth/meli/callback
                  </span>
                  .
                </p>
              </div>
            </section>
          </div>
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

function EnvChip({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-black/8 bg-white px-3 py-3 font-mono text-xs text-[#18120d]">
      {name}
    </div>
  );
}

function StatusBanner({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: "success" | "danger";
}) {
  const toneClassName =
    tone === "success"
      ? "border-black/8 bg-white text-[#18120d]"
      : "border-[#ff6a00] bg-[#ff6a00] text-white";

  return (
    <div className={`rounded-[22px] border p-4 ${toneClassName}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-2 text-sm opacity-90">{description}</p>
    </div>
  );
}

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatOptionalDate(value: string | null) {
  if (!value) {
    return "Controlado automaticamente";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
