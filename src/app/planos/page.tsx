import type { Metadata } from "next";
import Link from "next/link";
import horizontalLogo from "@/app/dabi-price-horizontal.svg";
import Image from "next/image";
import { workspacePlans } from "@/lib/settings/app-preferences";

const planFeatureRows = [
  {
    label: "Precificações e exportação PDF",
    values: {
      starter: "Ilimitado",
      growth: "Ilimitado",
      scale: "Ilimitado",
    },
  },
  {
    label: "Orçamentos salvos",
    values: {
      starter: "Até 50",
      growth: "Até 200",
      scale: "Até 1000",
    },
  },
  {
    label: "Usuários incluídos",
    values: {
      starter: "1 usuário",
      growth: "3 usuários",
      scale: "10 usuários",
    },
  },
  {
    label: "Logo e identidade da empresa",
    values: {
      starter: "Incluído",
      growth: "Incluído",
      scale: "Incluído",
    },
  },
  {
    label: "Modelos de orçamento",
    values: {
      starter: "Base",
      growth: "Avançado",
      scale: "Completo",
    },
  },
  {
    label: "Integrações ERP e Mercado Livre",
    values: {
      starter: "Sob demanda",
      growth: "Disponível",
      scale: "Prioridade máxima",
    },
  },
  {
    label: "Suporte",
    values: {
      starter: "Base",
      growth: "Prioritário",
      scale: "Consultivo",
    },
  },
] as const;

const planHighlights: Record<
  (typeof workspacePlans)[number]["id"],
  readonly string[]
> = {
  starter: [
    "Operação enxuta com controle essencial",
    "Até 50 orçamentos salvos",
    "1 usuário incluído",
    "Logo da empresa e identidade básica",
  ],
  growth: [
    "Plano equilibrado para recorrência e catálogo",
    "Até 200 orçamentos salvos",
    "3 usuários incluídos",
    "ERP e integrações liberadas",
  ],
  scale: [
    "Estrutura para time, volume e governança",
    "Até 1000 orçamentos salvos",
    "10 usuários incluídos",
    "Suporte consultivo e prioridade máxima",
  ],
};

const faqItems = [
  {
    question: "Como funciona a contratação do acesso?",
    answer:
      "Você escolhe o plano ideal para a operação e avança para a assinatura do Mercado Pago quando ela estiver liberada para essa faixa. Planos sob medida continuam com atendimento comercial.",
  },
  {
    question: "O acesso ao projeto muda conforme o plano?",
    answer:
      "Sim. A estrutura de permissões e limites já considera plano contratado, histórico salvo, usuários incluídos e nível de suporte.",
  },
  {
    question: "Posso começar em um plano e mudar depois?",
    answer:
      "Sim. A evolução de faixa já faz parte da estrutura do produto e pode acompanhar o crescimento da operação.",
  },
  {
    question: "A página já substitui o checkout?",
    answer:
      "Ela organiza a decisão comercial e entrega o fluxo certo: escolher o plano, abrir a assinatura do Mercado Pago quando houver autoatendimento, ou cair no contato consultivo quando o plano exigir análise.",
  },
] as const;

export const metadata: Metadata = {
  title: "Planos | Dabi Price",
  description:
    "Página pública de planos da Dabi Price para escolha comercial antes do acesso à plataforma.",
};

export default async function PublicPlansPage({
  searchParams,
}: {
  searchParams?: Promise<{
    origin?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const origin = params.origin ?? "site";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fffefc_0%,#f6fbf7_36%,#fff6fa_100%)] text-[#274338]">
      <section className="border-b border-[#dcebe3] bg-[radial-gradient(circle_at_top_left,rgba(207,234,219,0.78),transparent_30%),radial-gradient(circle_at_90%_8%,rgba(247,203,221,0.42),transparent_20%),linear-gradient(180deg,#fffefd_0%,#f8fcfa_100%)]">
        <div className="mx-auto max-w-[1180px] px-4 pb-14 pt-6 sm:px-6 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
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

            <nav className="hidden items-center gap-7 text-sm text-[#6c897b] md:flex">
              <a href="#planos" className="transition hover:text-[#274338]">
                Planos
              </a>
              <a href="#comparacao" className="transition hover:text-[#274338]">
                Comparação
              </a>
              <a href="#duvidas" className="transition hover:text-[#274338]">
                Perguntas
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-[#d6e8de] bg-white/92 px-4 py-2 text-sm font-medium text-[#274338] transition hover:border-[#f68ab0] hover:text-[#b85178]"
              >
                Entrar
              </Link>
              <Link
                href="/contato"
                className="rounded-full bg-[#24473c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d3a31]"
              >
                Falar com consultor
              </Link>
            </div>
          </header>

          <div className="mx-auto max-w-[860px] pt-14 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#7ca893]">
              01 — Planos
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-[0.94] tracking-[-0.08em] text-[#24473c] sm:text-6xl">
              Escolha o plano certo antes de liberar o acesso ao projeto.
            </h1>
            <p className="mx-auto mt-5 max-w-[720px] text-base leading-8 text-[#6c897b]">
              A pessoa que vem da landing precisa cair aqui, escolher a faixa
              certa e só depois seguir para contratação. Assim o acesso à
              plataforma nasce já alinhado ao plano pago.
            </p>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#dcebe3] bg-white/86 p-1">
              <span className="rounded-full bg-[#24473c] px-5 py-2 text-sm font-semibold text-white">
                Mensal
              </span>
              <span className="rounded-full px-5 py-2 text-sm font-semibold text-[#7e9689]">
                Anual em implantação
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="planos" className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {workspacePlans.map((plan) => {
            const isHighlighted = plan.id === "growth";

            return (
              <article
                key={plan.id}
                className={`rounded-[30px] border px-6 py-6 shadow-[0_18px_44px_rgba(99,144,126,0.08)] ${isHighlighted
                  ? "border-[#f2d6e3] bg-[#fff8fb]"
                  : "border-[#dcebe3] bg-white/94"
                  }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold tracking-[-0.05em] text-[#274338]">
                      {plan.label}
                    </p>
                    <p className="mt-3 text-sm leading-7 text-[#6c897b]">
                      {plan.description}
                    </p>
                  </div>
                  {isHighlighted ? (
                    <span className="rounded-full bg-[#f68ab0] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                      Mais escolhido
                    </span>
                  ) : null}
                </div>

                <div className="mt-6">
                  <p className="text-4xl font-semibold tracking-[-0.07em] text-[#24473c]">
                    {plan.monthlyPriceLabel}
                  </p>
                  <p className="mt-2 text-sm text-[#7e9689]">por workspace / mês</p>
                </div>

                <div className="mt-6 space-y-3">
                  {planHighlights[plan.id].map((item) => (
                    <PlanBullet key={item}>{item}</PlanBullet>
                  ))}
                </div>

                <div className="mt-8 grid gap-3">
                  {plan.id === "scale" ? (
                    <Link
                      href={{
                        pathname: "/contato",
                        query: {
                          plan: plan.id,
                          origin,
                        },
                      }}
                      className={`inline-flex items-center justify-center rounded-[16px] px-5 py-3 text-sm font-semibold transition ${isHighlighted
                        ? "bg-[#24473c] text-white hover:bg-[#1d3a31]"
                        : "border border-[#dcebe3] bg-white text-[#274338] hover:bg-[#f8fcfa]"
                        }`}
                    >
                      Falar sobre o DaBi Equipe
                    </Link>
                  ) : (
                    <Link
                      href={{
                        pathname: "/cadastro",
                        query: {
                          plan: plan.id,
                        },
                      }}
                      className={`inline-flex items-center justify-center rounded-[16px] px-5 py-3 text-sm font-semibold transition ${isHighlighted
                        ? "bg-[#24473c] text-white hover:bg-[#1d3a31]"
                        : "border border-[#dcebe3] bg-white text-[#274338] hover:bg-[#f8fcfa]"
                        }`}
                    >
                      Começar com {plan.label}
                    </Link>
                  )}
                  <Link
                    href={{
                      pathname: "/contato",
                      query: {
                        plan: plan.id,
                        origin,
                        intent: "consultor",
                      },
                    }}
                    className="inline-flex items-center justify-center rounded-[16px] border border-[#f2d6e3] bg-[#fff5f9] px-5 py-3 text-sm font-semibold text-[#c8618b] transition hover:bg-[#fff0f6]"
                  >
                    Falar com consultor
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 rounded-[28px] border border-[#f2d6e3] bg-[#fff5f9] px-5 py-4 text-center text-sm text-[#7d6872]">
          Quando a URL do plano estiver configurada, o CTA abre a assinatura do
          Mercado Pago. Nos demais casos, o fluxo continua pelo contato
          consultivo sem quebrar a navegação pública.
        </div>
      </section>

      <section
        id="comparacao"
        className="border-y border-[#dcebe3] bg-[linear-gradient(180deg,#f7fcf9_0%,#fff7fa_100%)]"
      >
        <div className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7ca893]">
              02 — Comparação
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-[#24473c]">
              Só o essencial para escolher com clareza.
            </h2>
            <p className="mt-4 text-base leading-8 text-[#6c897b]">
              A ideia aqui não é complicar. É deixar visível o que muda em
              volume, equipe, integração e suporte.
            </p>
          </div>

          <div className="mt-10 overflow-hidden rounded-[30px] border border-[#dcebe3] bg-white/94 shadow-[0_18px_44px_rgba(99,144,126,0.08)]">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-[#f8fcfa] text-left">
                    <th className="border-b border-[#dcebe3] px-6 py-4 font-semibold text-[#274338]">
                      Recurso
                    </th>
                    {workspacePlans.map((plan) => (
                      <th
                        key={plan.id}
                        className={`border-b px-6 py-4 font-semibold ${plan.id === "growth"
                          ? "border-[#f2d6e3] bg-[#fff8fb] text-[#c8618b]"
                          : "border-[#dcebe3] text-[#274338]"
                          }`}
                      >
                        {plan.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {planFeatureRows.map((row) => (
                    <tr key={row.label} className="bg-white/84">
                      <td className="border-b border-[#dcebe3] px-6 py-4 text-[#274338]">
                        {row.label}
                      </td>
                      {workspacePlans.map((plan) => (
                        <td
                          key={`${row.label}-${plan.id}`}
                          className={`border-b px-6 py-4 ${plan.id === "growth"
                            ? "border-[#f2d6e3] font-semibold text-[#b85178]"
                            : "border-[#dcebe3] text-[#6c897b]"
                            }`}
                        >
                          {row.values[plan.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="duvidas" className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7ca893]">
            03 — Perguntas frequentes
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-[#24473c]">
            Ficou alguma dúvida?
          </h2>
          <p className="mt-4 text-base leading-8 text-[#6c897b]">
            Só o essencial para você decidir com tranquilidade.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {faqItems.map((item) => (
            <article
              key={item.question}
              className="rounded-[28px] border border-[#dcebe3] bg-white/94 px-6 py-6 shadow-[0_18px_40px_rgba(99,144,126,0.08)]"
            >
              <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#274338]">
                {item.question}
              </h3>
              <p className="mt-3 text-sm leading-7 text-[#6c897b]">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-[1180px] rounded-[34px] bg-[linear-gradient(135deg,#cf6f94,#b7557f)] px-6 py-10 text-center text-white shadow-[0_24px_60px_rgba(183,85,127,0.24)]">
          <h2 className="mx-auto max-w-[820px] text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">
            Transforme a operação da sua marca com o plano certo desde a entrada.
          </h2>
          <p className="mx-auto mt-4 max-w-[700px] text-base leading-8 text-[#ffeaf2]">
            A landing educa. A página pública de planos converte. E o acesso ao
            projeto só deve nascer depois da contratação da faixa correta.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={{
                pathname: "/cadastro",
                query: {
                  plan: "growth",
                },
              }}
              className="inline-flex items-center justify-center rounded-[16px] bg-white px-6 py-4 text-sm font-semibold text-[#cf6f94] transition hover:bg-[#fff7fa]"
            >
              Começar com DaBi Pro
              <span className="ml-3 text-base">→</span>
            </Link>
            <Link
              href={{
                pathname: "/contato",
                query: {
                  origin,
                  intent: "consultor",
                },
              }}
              className="inline-flex items-center justify-center rounded-[16px] border border-white/38 bg-transparent px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/8"
            >
              Falar com consultor
            </Link>
          </div>

          <p className="mt-5 text-sm text-[#ffeaf2]">
            Suporte humanizado · Ativação comercial guiada
          </p>
        </div>
      </section>
    </main>
  );
}

function PlanBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#e8f4ed] text-[11px] font-semibold text-[#5b8b75]">
        ✓
      </span>
      <p className="text-sm leading-7 text-[#6c897b]">{children}</p>
    </div>
  );
}
