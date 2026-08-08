import { BackLink } from "@/components/app/back-link";

const guides = [
  "Como formar um preço saudável sem copiar concorrente.",
  "Quando a taxa e o frete tornam um canal inviável.",
  "Diferença entre pró-labore, proteção operacional e lucro da empresa.",
  "Como usar benchmark comercial sem tratar mercado como verdade de custo.",
];

export default function HelpPage() {
  return (
    <div className="app-page">
      <header className="app-header">
        <BackLink href="/app/precificacao" label="Voltar para a precificadora" />
        <p className="app-eyebrow">Ajuda</p>
        <h1 className="app-title">Orientação de uso da plataforma</h1>
        <p className="app-copy">
          Esta área prepara a central de ajuda do produto. Ela concentra
          onboarding, leitura conceitual da precificação e limites assumidos pela
          ferramenta.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {guides.map((guide) => (
          <article key={guide} className="app-card p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Guia
            </p>
            <p className="mt-3 text-base font-semibold text-[var(--foreground)]">
              {guide}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
