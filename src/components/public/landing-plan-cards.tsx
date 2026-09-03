"use client";

import Link from "next/link";
import { useState } from "react";
import {
  workspacePlans,
  type WorkspaceBillingCycle,
  type WorkspacePlan,
} from "@/lib/settings/app-preferences";

const planContent: Record<
  WorkspacePlan["id"],
  {
    eyebrow: string;
    description: string;
    items: string[];
    cta: string;
    highlighted?: boolean;
  }
> = {
  starter: {
    eyebrow: "Entrada",
    description: "Para começar a organizar sua precificação com estrutura.",
    items: [
      "Controle essencial de custos",
      "Histórico operacional inicial",
      "Leitura básica da viabilidade",
    ],
    cta: "Começar agora",
  },
  growth: {
    eyebrow: "Mais escolhido",
    description: "Para quem vende regularmente e precisa proteger margem.",
    items: [
      "Precificação completa",
      "Comparação de canais",
      "Histórico ampliado",
      "Recursos avançados e suporte prioritário",
    ],
    cta: "Assinar Pro",
    highlighted: true,
  },
  scale: {
    eyebrow: "Consultivo",
    description:
      "Para operações com time, volume e necessidade de desenho comercial.",
    items: [
      "Mais usuários e histórico",
      "Acompanhamento consultivo",
      "Prioridade máxima em suporte e evolução",
    ],
    cta: "Falar com consultor",
  },
};

export function LandingPlanCards() {
  const [billingCycle, setBillingCycle] =
    useState<WorkspaceBillingCycle>("monthly");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div
          className="flex w-fit gap-1 p-1"
          style={{
            border: "1px solid var(--landing-line-strong)",
            borderRadius: "var(--landing-radius-sm)",
          }}
        >
          <CycleButton
            active={billingCycle === "monthly"}
            onClick={() => setBillingCycle("monthly")}
          >
            Assinatura mensal
          </CycleButton>
          <CycleButton
            active={billingCycle === "annual"}
            onClick={() => setBillingCycle("annual")}
          >
            Assinatura anual
          </CycleButton>
        </div>

        <p className="landing-note">
          {billingCycle === "annual"
            ? "Pagamento antecipado para 12 meses de acesso."
            : "Cobrança recorrente por workspace, a cada mês."}
        </p>
      </div>

      <div className="landing-grid landing-grid--3">
        {workspacePlans.map((plan) => (
          <LandingPlanCard
            key={plan.id}
            plan={plan}
            billingCycle={billingCycle}
            content={planContent[plan.id]}
          />
        ))}
      </div>

      <p className="landing-note">
        Os valores exibidos são à vista no Pix. No cartão, o parcelamento em até
        10x tem juros informados antes da confirmação.
      </p>
    </div>
  );
}

function CycleButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="px-4 py-2 text-sm font-semibold transition sm:px-5"
      style={{
        borderRadius: "calc(var(--landing-radius-sm) - 2px)",
        background: active ? "var(--landing-action)" : "transparent",
        color: active ? "var(--landing-action-ink)" : "var(--landing-muted)",
      }}
    >
      {children}
    </button>
  );
}

function LandingPlanCard({
  plan,
  billingCycle,
  content,
}: {
  plan: WorkspacePlan;
  billingCycle: WorkspaceBillingCycle;
  content: (typeof planContent)[WorkspacePlan["id"]];
}) {
  const price =
    billingCycle === "annual" ? plan.annualPriceLabel : plan.monthlyPriceLabel;
  const href = {
    pathname: "/cadastro",
    query: { plan: plan.id, billingCycle },
  };

  return (
    <article
      className={`landing-card flex flex-col gap-5 ${
        content.highlighted ? "landing-card--gold" : ""
      }`}
    >
      <span
        className="landing-num"
        style={{
          fontSize: 11,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: content.highlighted
            ? "var(--landing-gold)"
            : "var(--landing-muted-soft)",
        }}
      >
        {content.eyebrow}
      </span>

      <h3 className="landing-h3">{plan.label}</h3>
      <p className="landing-note">{content.description}</p>

      <div className="flex flex-col gap-1">
        <span
          className="landing-num text-4xl font-semibold"
          style={{ letterSpacing: "-0.03em" }}
        >
          {price}
        </span>
        <span className="landing-note">
          {billingCycle === "annual"
            ? "valor total anual"
            : "por workspace / mês"}
        </span>
      </div>

      <ul
        className="flex flex-col gap-3"
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        {content.items.map((item) => (
          <li
            key={item}
            className="flex items-baseline gap-3 text-sm"
            style={{ color: "var(--landing-ink-soft)" }}
          >
            <span aria-hidden="true" style={{ color: "var(--landing-profit)" }}>
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>

      <Link
        href={href}
        className={`landing-cta mt-auto w-full ${
          content.highlighted ? "" : "landing-cta--ghost"
        }`}
      >
        {content.cta}
      </Link>
    </article>
  );
}
