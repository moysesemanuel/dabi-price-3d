import { BackLink } from "@/components/app/back-link";

export default function ContactPage() {
  return (
    <main className="public-shell px-4 py-10 sm:px-6">
      <div className="public-panel mx-auto max-w-[1100px] rounded-[40px] p-6 sm:p-8">
        <BackLink href="/" label="Voltar para a home" />

        <p className="public-badge mt-8">Contato</p>
        <h1 className="public-title max-w-[760px] text-4xl sm:text-5xl">
          Canal comercial e operacional da plataforma.
        </h1>
        <p className="public-copy max-w-[760px] text-base">
          Esta página já estabelece um ponto público para contato antes mesmo da
          área autenticada completa de suporte. Na próxima fase, ela pode
          disparar leads, tickets e onboarding comercial.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <InfoCard
            label="Comercial"
            title="Solicitar demonstração"
            description="Use este canal para conversar sobre implantação, planos e uso da plataforma."
          />
          <InfoCard
            label="Operacional"
            title="Suporte ao workspace"
            description="Clientes autenticados também terão central própria em /app/suporte."
          />
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="app-card-soft p-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">
        {title}
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}
