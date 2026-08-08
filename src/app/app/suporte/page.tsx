import { BackLink } from "@/components/app/back-link";

const supportCards = [
  {
    title: "Abrir chamado",
    description:
      "Canal interno do cliente para dúvidas, comportamento inesperado e apoio operacional.",
  },
  {
    title: "Status da operação",
    description:
      "Espaço para centralizar falhas de integração, instabilidade e alertas do workspace.",
  },
  {
    title: "Histórico de atendimento",
    description:
      "Base para futura rastreabilidade de contato entre cliente, operação e suporte da plataforma.",
  },
];

export default function SupportPage() {
  return (
    <div className="app-page">
      <header className="app-header">
        <BackLink href="/app/precificacao" label="Voltar para a precificadora" />
        <p className="app-eyebrow">Suporte</p>
        <h1 className="app-title">Central de contato do workspace</h1>
        <p className="app-copy">
          Você pediu que contato, resposta a erro, recuperação e orientação
          aparecessem dentro da área do usuário. Aqui está o espaço natural para
          isso no produto autenticado.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        {supportCards.map((card) => (
          <article key={card.title} className="app-card p-6">
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {card.title}
            </p>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
              {card.description}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
