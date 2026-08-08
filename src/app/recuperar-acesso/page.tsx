import { BackLink } from "@/components/app/back-link";

export default function RecoverAccessPage() {
  return (
    <main className="public-shell px-4 py-10 sm:px-6">
      <div className="public-panel mx-auto max-w-[720px] rounded-[40px] p-6 sm:p-8">
        <BackLink href="/login" label="Voltar ao login" />

        <p className="public-badge mt-8">Recuperação de acesso</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-[var(--foreground)] sm:text-5xl">
          Receba um link seguro para redefinir sua senha.
        </h1>
        <p className="public-copy text-base">
          Esta rota já separa a jornada pública de acesso. O envio de e-mail e a
          persistência do token serão ligados quando a camada de autenticação for
          concluída.
        </p>

        <form className="mt-8 space-y-4">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              E-mail da conta
            </span>
            <input
              type="email"
              placeholder="voce@empresa.com"
              className="clay-input mt-2 w-full rounded-2xl px-4 py-3 text-base text-[var(--foreground)] outline-none transition focus:border-[#6c56ff] focus:ring-2 focus:ring-[#6c56ff]/20"
            />
          </label>

          <button
            type="button"
            className="app-button app-button-primary w-full rounded-2xl px-5 py-3"
          >
            Enviar instruções
          </button>
        </form>
      </div>
    </main>
  );
}
