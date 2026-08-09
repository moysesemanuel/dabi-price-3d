import Image from "next/image";
import Link from "next/link";
import horizontalLogo from "@/app/dabi-price-horizontal.svg";
import { BackLink } from "@/components/app/back-link";
import { LoginForm } from "@/components/auth/login-form";
import { getPersistenceModeMeta } from "@/lib/server/persistence-mode";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const persistenceMode = getPersistenceModeMeta();

  return (
    <main className="public-shell px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
        <section className="max-w-[620px]">
          <BackLink href="/" label="Voltar para a home" />

          <div className="public-pill mt-8">
            <Link href="/" className="inline-flex" aria-label="Dabi Price">
              <Image
                src={horizontalLogo}
                alt="Dabi Price"
                width={176}
                height={42}
                unoptimized
                className="h-8 w-auto"
              />
            </Link>
          </div>

          <p className="public-badge mt-8">Acesso à plataforma</p>
          <h1 className="public-title max-w-[700px]">
            Entre para continuar a operação do seu workspace.
          </h1>
          <p className="public-copy max-w-[620px]">
            {persistenceMode.mode === "database"
              ? "Entre com seu usuario para abrir o workspace persistido, com sessao, historico e preferencias salvas no banco."
              : "Entre com seu usuario para continuar no modo local de desenvolvimento, sem persistencia compartilhada entre maquinas."}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/recuperar-acesso"
              className="app-button app-button-primary"
            >
              Recuperar acesso
            </Link>
            <Link href="/" className="app-button app-button-secondary">
              Voltar para a home
            </Link>
          </div>
        </section>

        <section className="public-panel rounded-[36px] p-6 sm:p-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
              Login
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
              Acesso por e-mail
            </h2>
          </div>

          <LoginForm nextPath={params.next} />

          <div
            className={`mt-5 flex flex-wrap items-center gap-3 text-sm ${
              persistenceMode.mode === "database"
                ? "text-[var(--muted)]"
                : "text-[color:var(--warning)]"
            }`}
          >
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                persistenceMode.mode === "database"
                  ? "border-[var(--panel-border)] bg-[var(--panel-soft)] text-[var(--muted)]"
                  : "border-[color:var(--warning)]/24 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
              }`}
              title={persistenceMode.description}
            >
              {persistenceMode.mode === "database" ? "Banco" : "Local"}
            </span>
            {persistenceMode.mode === "local" ? (
              <p>
                Sem variaveis de bootstrap, o primeiro acesso administrativo usa
                `admin@dabitech3d.com` / `admin123`.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
