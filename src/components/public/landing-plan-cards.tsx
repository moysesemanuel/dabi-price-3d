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
    <div className="mt-10">
      <div className="mx-auto flex w-fit rounded-full border border-[#d7e3dc] bg-white/90 p-1 shadow-[0_12px_28px_rgba(41,55,45,0.06)]">
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

      <p className="mt-4 text-center text-sm text-[#5f7468]">
        {billingCycle === "annual"
          ? "Pagamento antecipado para 12 meses de acesso."
          : "Cobrança recorrente por workspace, a cada mês."}
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {workspacePlans.map((plan) => (
          <LandingPlanCard
            key={plan.id}
            plan={plan}
            billingCycle={billingCycle}
            content={planContent[plan.id]}
          />
        ))}
      </div>
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
      className={`rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5 ${
        active
          ? "bg-[#21352d] text-white shadow-[0_4px_12px_rgba(33,53,45,0.16)]"
          : "text-[#5f7468] hover:text-[#21352d]"
      }`}
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
  const isConsultative = plan.id === "scale";
  const href = isConsultative
    ? {
        pathname: "/contato",
        query: { plan: plan.id, origin: "site", billingCycle },
      }
    : {
        pathname: "/cadastro",
        query: { plan: plan.id, billingCycle },
      };

  return (
    <article
      className={`rounded-[34px] border p-6 shadow-[0_20px_48px_rgba(41,55,45,0.06)] ${
        content.highlighted
          ? "border-[#f0d7c8] bg-[#fff7f1]"
          : "border-[#e7e1d6] bg-white"
      }`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#b8511d]">
        {content.eyebrow}
      </p>
      <h3 className="mt-4 text-[2.15rem] font-semibold tracking-[-0.05em] text-[#17261f]">
        {plan.label}
      </h3>
      <p className="mt-4 text-lg leading-9 text-[#42574d]">
        {content.description}
      </p>
      <p className="mt-5 text-4xl font-semibold tracking-[-0.06em] text-[#21352d]">
        {price}
      </p>
      <p className="mt-2 text-sm text-[#60736a]">
        {isConsultative
          ? "Condições definidas com o time comercial"
          : billingCycle === "annual"
            ? "valor total anual"
            : "por workspace / mês"}
      </p>
      <div className="mt-6 grid gap-3">
        {content.items.map((item) => (
          <div key={item} className="flex items-start gap-3">
            <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#eef8f3] text-[10px] font-bold text-[#20543f]">
              ✓
            </span>
            <p className="text-base leading-8 text-[#42574d]">{item}</p>
          </div>
        ))}
      </div>
      <Link
        href={href}
        className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-base font-semibold transition ${
          content.highlighted
            ? "bg-[#21352d] text-white hover:bg-[#17251f]"
            : "border border-[#d7e3dc] bg-white text-[#21352d] hover:border-[#21352d]"
        }`}
      >
        {content.cta}
      </Link>
    </article>
  );
}
