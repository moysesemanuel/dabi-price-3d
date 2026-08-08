import Link from "next/link";
import { BackLink } from "@/components/app/back-link";

export default function LoginPage() {
  return (
    <main className="public-shell px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center">
        <section className="max-w-[620px]">
          <BackLink href="/" label="Voltar para a home" />

          <div className="public-pill mt-8">
            <Link
              href="/"
              className="text-xl font-semibold tracking-[-0.06em] text-[var(--foreground)]"
            >
              Dabi<span className="text-[var(--accent)]"> Price</span>
            </Link>
          </div>

          <p className="public-badge mt-8">Acesso à plataforma</p>
          <h1 className="public-title max-w-[700px]">
            Entre para continuar a operação do seu workspace.
          </h1>
          <p className="public-copy max-w-[620px]">
            Esta tela já prepara a plataforma para autenticação real. Enquanto a
            camada de usuários ainda entra em produção, o acesso ao workspace
            atual segue aberto pelo botão abaixo.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/app/precificacao"
              className="app-button app-button-primary"
            >
              Entrar no ambiente atual
            </Link>
            <Link
              href="/recuperar-acesso"
              className="app-button app-button-secondary"
            >
              Recuperar acesso
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

          <form className="mt-8 space-y-4">
            <Field label="E-mail" type="email" placeholder="voce@empresa.com" />
            <Field label="Senha" type="password" placeholder="Sua senha" />

            <button
              type="button"
              className="app-button app-button-primary w-full rounded-2xl px-5 py-3"
            >
              Continuar
            </button>
          </form>

          <div className="mt-5 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4 text-sm leading-7 text-[var(--muted)]">
            Autenticação persistida, banco de usuários e recuperação completa de
            senha entram na próxima fase da plataforma.
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  placeholder,
}: {
  label: string;
  type: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        className="clay-input mt-2 w-full rounded-2xl px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[#6c56ff] focus:ring-2 focus:ring-[#6c56ff]/20"
      />
    </label>
  );
}
