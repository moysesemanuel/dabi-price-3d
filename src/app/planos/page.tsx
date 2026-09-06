import type { Metadata } from "next";
import Link from "next/link";
import { DabiWordmark } from "@/components/brand/dabi-brand";
import { LandingThemeToggle } from "@/components/public/landing-theme-toggle";
import { getCurrentAuthSession } from "@/lib/auth/session";
import {
  defaultAppPreferences,
  resolveWorkspacePlanPriceLabel,
  workspacePlans,
} from "@/lib/settings/app-preferences";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";

type PlanId = (typeof workspacePlans)[number]["id"];

/**
 * O Max e mostrado como futuro e nao vendido: a regra comercial e nao
 * comercializa-lo antes das automacoes e do ERP existirem. Vender agora seria
 * cobrar por promessa.
 */
const purchasablePlans: Record<PlanId, boolean> = {
  starter: true,
  growth: true,
  scale: false,
};

const planFeatureRows = [
  {
    label: "Precificações e exportação em PDF",
    values: { starter: "Ilimitado", growth: "Ilimitado", scale: "Ilimitado" },
  },
  {
    label: "Orçamentos salvos",
    values: { starter: "Até 50", growth: "Até 200", scale: "Até 1000" },
  },
  {
    label: "Usuários incluídos",
    values: { starter: "1 usuário", growth: "3 usuários", scale: "10 usuários" },
  },
  {
    label: "Logo e identidade da empresa",
    values: { starter: "Incluído", growth: "Incluído", scale: "Incluído" },
  },
  {
    label: "Modelos de orçamento",
    values: { starter: "Base", growth: "Avançado", scale: "Completo" },
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
    values: { starter: "Base", growth: "Prioritário", scale: "Consultivo" },
  },
] as const;

const planHighlights: Record<PlanId, readonly string[]> = {
  starter: [
    "Para quem está organizando a precificação pela primeira vez",
    "Até 50 orçamentos salvos",
    "1 usuário",
    "Logo e identidade da sua empresa nos orçamentos",
  ],
  growth: [
    "Para quem vende com recorrência e precisa proteger margem",
    "Até 200 orçamentos salvos",
    "3 usuários",
    "Comparação entre canais e integrações liberadas",
  ],
  scale: [
    "Para operação com time, volume e integração forte",
    "Até 1000 orçamentos salvos",
    "10 usuários",
    "Acompanhamento consultivo",
  ],
};

const faqItems = [
  {
    question: "Como funciona a cobrança?",
    answer:
      "A assinatura é recorrente, por workspace. Você escolhe mensal ou anual, e a renovação acontece automaticamente até você cancelar.",
  },
  {
    question: "Posso cancelar quando quiser?",
    answer:
      "Sim. O cancelamento interrompe as próximas renovações e o acesso continua até o fim do período já pago. Nos primeiros 7 dias você pode desistir e receber o valor de volta.",
  },
  {
    question: "Consigo mudar de plano depois?",
    answer:
      "Sim. Dá para subir ou descer de plano conforme o negócio muda, e o valor é ajustado proporcionalmente.",
  },
  {
    question: "Quantas pessoas podem usar a mesma conta?",
    answer:
      "Depende do plano: o Start inclui 1 usuário, o Pro inclui 3. Cada pessoa entra com o próprio acesso.",
  },
] as const;

export const metadata: Metadata = {
  title: "Planos | dabi price",
  description:
    "Planos e preços da dabi price. Assinatura por workspace, com cancelamento quando você quiser.",
};

export default async function PublicPlansPage({
  searchParams,
}: {
  searchParams?: Promise<{
    origin?: string;
    billingCycle?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const origin = params.origin;
  const selectedBillingCycle =
    params.billingCycle === "annual" ? "annual" : "monthly";

  const session = await getCurrentAuthSession();
  const preferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
        () => defaultAppPreferences,
      )
      : defaultAppPreferences;

  const resolvePlanHref = (planId: PlanId) =>
    session
      ? preferences.onboardingCompleted
        ? {
          pathname: "/app/planos",
          query: { plan: planId, billingCycle: selectedBillingCycle, origin },
        }
        : {
          pathname: "/app/onboarding",
          query: { plan: planId, billingCycle: selectedBillingCycle },
        }
      : {
        pathname: "/cadastro",
        query: { plan: planId, billingCycle: selectedBillingCycle },
      };

  return (
    <main className="landing-root min-h-screen overflow-x-hidden">
      <header className="landing-header">
        <div className="landing-shell">
          <div className="landing-header__bar">
            <div className="flex items-center gap-10">
              <Link href="/" aria-label="dabi price">
                <DabiWordmark />
              </Link>
              <nav className="hidden items-center gap-7 lg:flex">
                <a href="#planos" className="landing-link">
                  Planos
                </a>
                <a href="#comparacao" className="landing-link">
                  Comparação
                </a>
                <a href="#duvidas" className="landing-link">
                  Perguntas
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <LandingThemeToggle />
              <Link href="/login" className="landing-link hidden sm:inline-flex">
                Entrar
              </Link>
              <Link href="/contato" className="landing-cta landing-cta--sm">
                Falar com a gente
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- topo ---------- */}
      <section className="landing-hero">
        <div className="landing-shell">
          <div
            className="flex flex-col gap-6"
            style={{ paddingBlock: "clamp(48px, 7vw, 88px)", maxWidth: "58ch" }}
          >
            <span className="landing-eyebrow">Planos</span>
            <h1 className="landing-display">
              Um plano que se paga quando você{" "}
              <span className="landing-turn">para de errar o preço</span>.
            </h1>
            <p className="landing-lede" style={{ fontSize: "1.0625rem" }}>
              Assinatura por workspace, sem fidelidade. Você troca de plano
              quando o negócio muda e cancela quando quiser.
            </p>

            <div
              className="mt-2 flex w-fit gap-1 p-1"
              style={{
                border: "1px solid var(--landing-line-strong)",
                borderRadius: "var(--landing-radius-sm)",
              }}
            >
              {(["monthly", "annual"] as const).map((cycle) => (
                <Link
                  key={cycle}
                  href={{
                    pathname: "/planos",
                    query: { origin, billingCycle: cycle },
                  }}
                  className="px-5 py-2 text-sm font-semibold transition"
                  style={{
                    borderRadius: "calc(var(--landing-radius-sm) - 2px)",
                    background:
                      selectedBillingCycle === cycle
                        ? "var(--landing-accent)"
                        : "transparent",
                    color:
                      selectedBillingCycle === cycle
                        ? "var(--landing-accent-ink)"
                        : "var(--landing-muted)",
                  }}
                >
                  {cycle === "monthly" ? "Mensal" : "Anual · 12 meses"}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- planos ---------- */}
      <section id="planos" className="landing-section">
        <div className="landing-shell flex flex-col gap-8">
          <div className="landing-grid landing-grid--3">
            {workspacePlans.map((plan) => {
              const isHighlighted = plan.id === "growth";
              const isPurchasable = purchasablePlans[plan.id];

              return (
                <article
                  key={plan.id}
                  className={`landing-card flex flex-col gap-5 ${isHighlighted ? "landing-card--gold" : ""
                    }`}
                  style={isPurchasable ? undefined : { opacity: 0.86 }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="landing-h3">{plan.label}</h2>
                    {isHighlighted ? (
                      <span
                        className="landing-num shrink-0"
                        style={{
                          fontSize: 10,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "var(--landing-gold)",
                        }}
                      >
                        Mais escolhido
                      </span>
                    ) : null}
                    {!isPurchasable ? (
                      <span
                        className="landing-num shrink-0"
                        style={{
                          fontSize: 10,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "var(--landing-muted-soft)",
                        }}
                      >
                        Em breve
                      </span>
                    ) : null}
                  </div>

                  <p className="landing-note">{plan.description}</p>

                  <div className="flex flex-col gap-1">
                    <span
                      className="landing-num text-4xl font-semibold"
                      style={{ letterSpacing: "-0.03em" }}
                    >
                      {isPurchasable
                        ? resolveWorkspacePlanPriceLabel(
                          plan,
                          selectedBillingCycle,
                        )
                        : "A definir"}
                    </span>
                    <span className="landing-note">
                      {isPurchasable
                        ? selectedBillingCycle === "annual"
                          ? "valor total por 12 meses"
                          : "por workspace / mês"
                        : "disponível quando as automações e o ERP estiverem prontos"}
                    </span>
                  </div>

                  <ul
                    className="flex flex-col gap-3"
                    style={{ listStyle: "none", margin: 0, padding: 0 }}
                  >
                    {planHighlights[plan.id].map((item) => (
                      <li
                        key={item}
                        className="flex items-baseline gap-3 text-sm"
                        style={{ color: "var(--landing-ink-soft)" }}
                      >
                        <span
                          aria-hidden="true"
                          style={{ color: "var(--landing-profit)" }}
                        >
                          ✓
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  {isPurchasable ? (
                    <Link
                      href={resolvePlanHref(plan.id)}
                      className={`landing-cta mt-auto w-full ${isHighlighted ? "" : "landing-cta--ghost"
                        }`}
                    >
                      Assinar {plan.label}
                    </Link>
                  ) : (
                    <Link
                      href={{
                        pathname: "/contato",
                        query: { plan: plan.id, origin, intent: "aviso" },
                      }}
                      className="landing-cta landing-cta--ghost mt-auto w-full"
                    >
                      Quero saber quando lançar
                    </Link>
                  )}
                </article>
              );
            })}
          </div>

          <p className="landing-note">
            Os valores são à vista no Pix. No cartão, o parcelamento em até 10x
            tem juros, informados antes de você confirmar.
          </p>
        </div>
      </section>

      {/* ---------- comparação ---------- */}
      <section id="comparacao" className="landing-section landing-section--alt">
        <div className="landing-shell flex flex-col gap-10">
          <div className="flex flex-col gap-5" style={{ maxWidth: "62ch" }}>
            <span className="landing-eyebrow">Comparação</span>
            <h2 className="landing-h2">O que muda de um plano para o outro.</h2>
          </div>

          <div className="landing-rail" style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 640,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr className="landing-rail__head">
                  <th
                    className="landing-num"
                    style={{
                      textAlign: "left",
                      padding: "16px 24px",
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      color: "var(--landing-muted-soft)",
                      fontWeight: 400,
                    }}
                  >
                    Recurso
                  </th>
                  {workspacePlans.map((plan) => (
                    <th
                      key={plan.id}
                      style={{
                        textAlign: "left",
                        padding: "16px 24px",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      {plan.label}
                      {purchasablePlans[plan.id] ? null : (
                        <span
                          className="landing-num ml-2"
                          style={{
                            fontSize: 10,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "var(--landing-muted-soft)",
                          }}
                        >
                          Em breve
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planFeatureRows.map((row) => (
                  <tr key={row.label}>
                    <td
                      style={{
                        padding: "14px 24px",
                        borderTop: "1px solid var(--landing-line)",
                        fontSize: 14,
                        color: "var(--landing-muted)",
                      }}
                    >
                      {row.label}
                    </td>
                    {workspacePlans.map((plan) => (
                      <td
                        key={plan.id}
                        style={{
                          padding: "14px 24px",
                          borderTop: "1px solid var(--landing-line)",
                          fontSize: 14,
                          color: "var(--landing-ink-soft)",
                        }}
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
      </section>

      {/* ---------- dúvidas ---------- */}
      <section id="duvidas" className="landing-section">
        <div className="landing-shell landing-split">
          <div className="flex flex-col gap-5">
            <span className="landing-eyebrow">Perguntas</span>
            <h2 className="landing-h2">Ficou alguma dúvida?</h2>
            <p className="landing-lede">
              Se a sua não estiver aqui,{" "}
              <Link href="/contato" style={{ color: "var(--landing-action)" }}>
                fale com a gente
              </Link>
              .
            </p>
          </div>

          <div className="flex flex-col">
            {faqItems.map((item) => (
              <div
                key={item.question}
                className="flex flex-col gap-3 py-6"
                style={{ borderBottom: "1px solid var(--landing-line)" }}
              >
                <h3 className="text-lg font-semibold tracking-[-0.01em]">
                  {item.question}
                </h3>
                <p className="landing-note">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- fechamento ---------- */}
      <section className="landing-section landing-section--alt">
        <div className="landing-shell">
          <div
            className="landing-card landing-card--gold flex flex-wrap items-end justify-between gap-8"
            style={{ padding: "clamp(32px, 5vw, 52px) clamp(24px, 4vw, 44px)" }}
          >
            <div className="flex flex-col gap-4" style={{ maxWidth: "38ch" }}>
              <span className="landing-eyebrow">Próximo passo</span>
              <span className="landing-h2">
                Comece a precificar com <span className="landing-turn">números</span>.
              </span>
              <p className="landing-lede">
                Você configura uma vez e cada produto novo entra na mesma régua.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={resolvePlanHref("growth")} className="landing-cta">
                Assinar DaBi Pro
              </Link>
              <Link
                href={{
                  pathname: "/contato",
                  query: { origin, intent: "consultor" },
                }}
                className="landing-cta landing-cta--ghost"
              >
                Falar com a gente
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
