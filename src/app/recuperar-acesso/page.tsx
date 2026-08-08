import { BackLink } from "@/components/app/back-link";
import { RecoverAccessFlow } from "@/components/auth/recover-access-flow";

export default async function RecoverAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="public-shell px-4 py-10 sm:px-6">
      <div className="public-panel mx-auto max-w-[720px] rounded-[40px] p-6 sm:p-8">
        <BackLink href="/login" label="Voltar ao login" />

        <p className="public-badge mt-8">Recuperação de acesso</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-[var(--foreground)] sm:text-5xl">
          Receba um link seguro para redefinir sua senha.
        </h1>
        <p className="public-copy text-base">
          Solicite a recuperação com o e-mail da conta. Ao abrir o link de
          redefinição, você poderá cadastrar uma nova senha imediatamente.
        </p>

        <RecoverAccessFlow token={params.token} />
      </div>
    </main>
  );
}
