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
    <main className="app-shell min-h-screen text-white">
      <div className="min-h-screen lg:pl-[215px]">
        <AppSidebar />

        <div className="mx-auto max-w-[1488px] p-8">
          <header className="mb-6 border-b border-white/6 pb-6">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Preferências
            </h1>

            <p className="mt-2 text-sm text-[var(--muted)]">
              Centralize integrações e parâmetros sensíveis da precificadora.
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
                description={reason ?? "Revise as variáveis e tente novamente."}
              />
            ) : null}

            <section className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                    Mercado Livre
                  </p>

                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                    Integração de produção
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                    Esta conexão usa OAuth persistente com refresh automático.
                    Em produção, o app salva o refresh token em banco para
                    renovar o access token sem intervenção manual.
                  </p>
                </div>

                <Link
                  href="/api/auth/meli/start"
                  className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-soft)] px-4 py-3 text-sm font-medium text-[var(--accent)] transition hover:border-[var(--accent)]/40"
                >
                  {connectionStatus.connected
                    ? "Reconectar conta"
                    : "Conectar Mercado Livre"}
                </Link>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <StatusCard
                  label="Modo"
                  value={
                    connectionStatus.mode === "persistent"
                      ? "OAuth + banco"
                      : connectionStatus.mode === "legacy-env"
                        ? "Token manual"
                        : "Não configurado"
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

              <div className="mt-6 rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-5">
                <p className="text-sm font-medium text-white">
                  Variáveis obrigatórias na Vercel
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <EnvChip name="DATABASE_URL" />
                  <EnvChip name="MELI_CLIENT_ID" />
                  <EnvChip name="MELI_CLIENT_SECRET" />
                  <EnvChip name="MELI_REDIRECT_URI" />
                </div>

                <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
                  Use como redirect URI o endpoint
                  {" "}
                  <span className="font-mono text-white">
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
    <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

function EnvChip({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-white/8 px-3 py-3 font-mono text-xs text-white">
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
      ? "border-[#11b8f5]/25 bg-[#11b8f5]/10 text-[#8fe3f6]"
      : "border-[#dc2828]/25 bg-[#dc2828]/10 text-[#ffb3b3]";

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
