import { BackLink } from "@/components/app/back-link";

export default function AccountPage() {
  return (
    <div className="app-page">
      <header className="app-header">
        <BackLink href="/app/precificacao" label="Voltar para a precificadora" />
        <p className="app-eyebrow">Conta</p>
        <h1 className="app-title">Acesso, usuário e segurança</h1>
        <p className="app-copy">
          Esta área prepara gestão de acesso, redefinição de senha, membros do
          workspace e futuras permissões de cliente.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="app-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
            Estado atual
          </p>
          <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
            Autenticação em implantação
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            O produto já tem as rotas públicas separadas para login e recuperação
            de acesso. A persistência de usuários entra na próxima fase.
          </p>
        </div>

        <div className="app-card-soft p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
            Próxima camada
          </p>
          <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
            Usuários, sessões e memberships
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
            Quando o banco entrar, esta área passa a concentrar acesso, segurança
            e papéis por workspace.
          </p>
        </div>
      </section>
    </div>
  );
}
