"use client";

import type { FormEvent, HTMLInputTypeAttribute, ReactNode } from "react";
import { useEffect, useState } from "react";

type LeadState = {
  name: string;
  email: string;
  whatsapp: string;
};

type CalculatorState = {
  ingredients: number;
  packaging: number;
  energy: number;
  other: number;
  hours: number;
  hourValue: number;
  fixed: number;
  loss: number;
  yield: number;
  fees: number;
  margin: number;
};

const LEAD_STORAGE_KEY = "dabi-price-3d:confectionery-free-lead";
const CALCULATOR_STORAGE_KEY = "dabi-price-3d:confectionery-free-calculator";

const initialLeadState: LeadState = {
  name: "",
  email: "",
  whatsapp: "",
};

const initialCalculatorState: CalculatorState = {
  ingredients: 35,
  packaging: 8,
  energy: 4,
  other: 3,
  hours: 2,
  hourValue: 15,
  fixed: 5,
  loss: 5,
  yield: 20,
  fees: 0,
  margin: 30,
};

export function ConfectioneryLandingCalculator() {
  const [lead, setLead] = useState<LeadState>(() => readSavedLead());
  const [isUnlocked, setIsUnlocked] = useState(() => hasSavedLead());
  const [calculator, setCalculator] = useState<CalculatorState>(() =>
    readSavedCalculator(),
  );

  useEffect(() => {
    window.localStorage.setItem(
      CALCULATOR_STORAGE_KEY,
      JSON.stringify(calculator),
    );
  }, [calculator]);

  const summary = buildCalculatorSummary(calculator);

  function handleLeadChange<K extends keyof LeadState>(field: K, value: LeadState[K]) {
    setLead((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleCalculatorChange<K extends keyof CalculatorState>(
    field: K,
    value: CalculatorState[K],
  ) {
    setCalculator((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    window.localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(lead));
    setIsUnlocked(true);

    window.requestAnimationFrame(() => {
      document
        .getElementById("calculadora")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-6">
      <section
        id="captura"
        className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
      >
        <div className="rounded-[32px] border border-[#bddccd] bg-[#24473c] px-6 py-7 text-white shadow-[0_24px_60px_rgba(36,71,60,0.24)] sm:px-7">
          <h2 className="mt-4 text-3xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-4xl">
            Antes de calcular, receba também o mini guia gratuito.
          </h2>
          <p className="mt-4 max-w-[36rem] text-sm leading-7 text-[#dcebe4] sm:text-base">
            Além da calculadora, você recebe um material rápido com os principais
            erros que fazem uma confeiteira vender e ainda assim não ver o
            dinheiro sobrar.
          </p>

          <div className="mt-6 grid gap-3">
            {[
              {
                title: "Checklist de custos",
                description:
                  "Para não esquecer itens importantes na sua formação de preço.",
              },
              {
                title: "Erros de precificação",
                description:
                  "Os problemas mais comuns que reduzem sua margem sem você perceber.",
              },
              {
                title: "Acesso à calculadora",
                description:
                  "Use quantas vezes quiser para testar seus produtos.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-white/12 bg-white/8 px-4 py-4 backdrop-blur"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#d4e5dd]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={handleUnlock}
          className="rounded-[32px] border border-[#d8e9df] bg-white/94 px-6 py-7 shadow-[0_24px_60px_rgba(99,144,126,0.12)] sm:px-7"
        >
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-[#274338] sm:text-3xl">
            Libere seu acesso gratuito
          </h2>
          <p className="mt-3 max-w-[34rem] text-sm leading-7 text-[#6c897b]">
            Preencha abaixo. Nesta versão demonstrativa, os dados ficam apenas
            no seu navegador.
          </p>

          <div className="mt-6 grid gap-4">
            <Field
              label="Seu nome"
              value={lead.name}
              onChange={(value) => handleLeadChange("name", value)}
              placeholder="Ex.: Amanda"
              required
            />
            <Field
              label="Seu melhor e-mail"
              value={lead.email}
              onChange={(value) => handleLeadChange("email", value)}
              placeholder="voce@email.com"
              type="email"
              required
            />
            <Field
              label="WhatsApp"
              value={lead.whatsapp}
              onChange={(value) => handleLeadChange("whatsapp", value)}
              placeholder="(41) 99999-9999"
              helper="Opcional"
            />
          </div>

          <button
            type="submit"
            className="mt-6 inline-flex w-full items-center justify-center rounded-[18px] bg-[#f68ab0] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(246,138,176,0.28)] transition hover:bg-[#eb739d]"
          >
            Quero acessar a calculadora
          </button>

          <p className="mt-4 text-xs leading-6 text-[#7e9689]">
            Ao continuar, você concorda em receber conteúdos relacionados a
            confeitaria, vendas, gestão e precificação. Você poderá sair da
            lista quando quiser.
          </p>

          {isUnlocked ? (
            <div className="mt-4 rounded-[20px] border border-[#b9dec7] bg-[#f4fff8] px-4 py-3 text-sm font-medium text-[#2e6c51]">
              Acesso liberado. Role a página para usar a calculadora.
            </div>
          ) : null}
        </form>
      </section>

      <section
        id="calculadora"
        className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_360px]"
      >
        <div className="rounded-[32px] border border-[#d8e9df] bg-white/94 px-6 py-7 shadow-[0_24px_60px_rgba(99,144,126,0.12)] sm:px-7">
          <h2 className="text-3xl font-semibold leading-[1.02] tracking-[-0.06em] text-[#274338] sm:text-4xl">
            Calculadora de precificação
          </h2>
          <p className="mt-3 max-w-[42rem] text-sm leading-7 text-[#6c897b] sm:text-base">
            Preencha os dados de uma receita ou lote completo. Os resultados são
            atualizados automaticamente.
          </p>

          <div className="mt-8 grid gap-8">
            <CalculatorBlock
              title="1. Custos da produção"
              description="Use os valores referentes a uma receita ou lote completo."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Ingredientes"
                  suffix="R$"
                  value={calculator.ingredients}
                  onChange={(value) =>
                    handleCalculatorChange("ingredients", value)
                  }
                />
                <NumberField
                  label="Embalagens"
                  suffix="R$"
                  value={calculator.packaging}
                  onChange={(value) =>
                    handleCalculatorChange("packaging", value)
                  }
                />
                <NumberField
                  label="Gás / energia"
                  suffix="R$"
                  helper="Estimativa"
                  value={calculator.energy}
                  onChange={(value) => handleCalculatorChange("energy", value)}
                />
                <NumberField
                  label="Outros custos variáveis"
                  suffix="R$"
                  value={calculator.other}
                  onChange={(value) => handleCalculatorChange("other", value)}
                />
              </div>
            </CalculatorBlock>

            <CalculatorBlock
              title="2. Seu trabalho e estrutura"
              description="Inclua seu tempo e o rateio de despesas do negócio."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Horas de trabalho"
                  value={calculator.hours}
                  onChange={(value) => handleCalculatorChange("hours", value)}
                />
                <NumberField
                  label="Valor da sua hora"
                  suffix="R$"
                  value={calculator.hourValue}
                  onChange={(value) =>
                    handleCalculatorChange("hourValue", value)
                  }
                />
                <NumberField
                  label="Rateio de custos fixos"
                  suffix="R$"
                  helper="água, aluguel etc."
                  value={calculator.fixed}
                  onChange={(value) => handleCalculatorChange("fixed", value)}
                />
                <NumberField
                  label="Perdas e imprevistos"
                  suffix="%"
                  value={calculator.loss}
                  onChange={(value) => handleCalculatorChange("loss", value)}
                />
              </div>
            </CalculatorBlock>

            <CalculatorBlock
              title="3. Venda"
              description="Defina rendimento, taxas e margem desejada."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <NumberField
                  label="Rendimento da receita"
                  helper="unidades"
                  value={calculator.yield}
                  onChange={(value) => handleCalculatorChange("yield", value)}
                />
                <NumberField
                  label="Taxas de venda"
                  suffix="%"
                  helper="maquininha/app"
                  value={calculator.fees}
                  onChange={(value) => handleCalculatorChange("fees", value)}
                />
                <div className="md:col-span-2">
                  <NumberField
                    label="Margem de lucro desejada"
                    suffix="%"
                    value={calculator.margin}
                    onChange={(value) => handleCalculatorChange("margin", value)}
                  />
                </div>
              </div>
            </CalculatorBlock>
          </div>
        </div>

        <aside className="rounded-[32px] border border-[#e5d6de] bg-[#fff8fb] px-6 py-7 shadow-[0_24px_60px_rgba(168,121,140,0.12)] xl:sticky xl:top-6 xl:self-start">
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.05em] text-[#4d3240]">
            Preço sugerido
          </h2>
          <small className="mt-3 block text-[#846674]">
            Com base nos dados preenchidos
          </small>

          <div className="mt-6 rounded-[28px] border border-[#f2d6e3] bg-white/84 px-5 py-5">
            <p className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-[#24473c] sm:text-5xl">
              {formatCurrency(summary.suggestedPrice)}
            </p>
            <p className="mt-2 text-sm text-[#7e6872]">
              {formatCurrency(summary.unitPrice)} por unidade
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <MetricRow
              label="Custo total do lote"
              value={formatCurrency(summary.totalCost)}
            />
            <MetricRow
              label="Custo por unidade"
              value={formatCurrency(summary.unitCost)}
            />
            <MetricRow
              label="Lucro estimado"
              value={formatCurrency(summary.profit)}
              tone="success"
            />
            <MetricRow
              label="Margem estimada"
              value={`${summary.effectiveMargin.toFixed(1).replace(".", ",")}%`}
            />
          </div>

          <div className="mt-6 rounded-[24px] border border-[#f2d6e3] bg-[#fff7f8] px-4 py-4 text-sm leading-7 text-[#6e4b54]">
            Esta é uma estimativa educacional. Custos, impostos, taxas e
            posicionamento devem ser revisados antes de definir o preço final.
          </div>

          <div className="mt-6 rounded-[16px] bg-[#24473c] px-[18px] py-[18px] text-white">
            <strong className="block text-base">Quer profissionalizar sua confeitaria?</strong>
            <span className="mt-1 block text-[0.86rem] leading-[1.45] text-[#dcebe4]">
              Em breve: aulas, materiais práticos e ferramentas para ajudar você
              a precificar, organizar e vender melhor.
            </span>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
  required?: boolean;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-semibold text-[#35584a]">
        {label}
        {helper ? (
          <span className="text-xs font-medium text-[#8aa595]">{helper}</span>
        ) : null}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[18px] border border-[#d7e8df] bg-[#fbfffc] px-4 py-3 text-sm text-[#24473c] outline-none transition focus:border-[#f68ab0] focus:ring-2 focus:ring-[#f68ab0]/20"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  helper,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-semibold text-[#35584a]">
        {label}
        {helper ? (
          <span className="text-xs font-medium text-[#8aa595]">{helper}</span>
        ) : null}
      </span>
      <div className="mt-2 flex items-center overflow-hidden rounded-[18px] border border-[#d7e8df] bg-[#fbfffc] transition focus-within:border-[#f68ab0] focus-within:ring-2 focus-within:ring-[#f68ab0]/20">
        {suffix ? (
          <span className="border-r border-[#d7e8df] px-4 py-3 text-sm text-[#7a9487]">
            {suffix}
          </span>
        ) : null}
        <input
          type="number"
          min="0"
          step="0.1"
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(toPositiveNumber(event.target.value))}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-[#24473c] outline-none"
        />
      </div>
    </label>
  );
}

function CalculatorBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#deece4] bg-[#f8fcfa] px-5 py-5 sm:px-6">
      <h3 className="text-xl font-semibold tracking-[-0.04em] text-[#274338]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-[#6c897b]">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[20px] border border-[#efdde5] bg-white/84 px-4 py-3 text-sm">
      <span className="text-[#735b65]">{label}</span>
      <strong className={tone === "success" ? "text-[#2c8058]" : "text-[#31483f]"}>
        {value}
      </strong>
    </div>
  );
}

function buildCalculatorSummary(input: CalculatorState) {
  const ingredients = clampPositive(input.ingredients);
  const packaging = clampPositive(input.packaging);
  const energy = clampPositive(input.energy);
  const other = clampPositive(input.other);
  const labor = clampPositive(input.hours) * clampPositive(input.hourValue);
  const fixed = clampPositive(input.fixed);
  const lossPct = Math.min(clampPositive(input.loss), 100) / 100;
  const feesPct = Math.min(clampPositive(input.fees), 99) / 100;
  const marginPct = Math.min(clampPositive(input.margin), 95) / 100;
  const quantity = Math.max(1, clampPositive(input.yield));

  const base = ingredients + packaging + energy + other + labor + fixed;
  const totalCost = base + base * lossPct;
  const divisor = Math.max(0.01, 1 - feesPct - marginPct);
  const suggestedPrice = totalCost / divisor;
  const feesValue = suggestedPrice * feesPct;
  const profit = suggestedPrice - totalCost - feesValue;
  const unitPrice = suggestedPrice / quantity;
  const unitCost = totalCost / quantity;
  const effectiveMargin = suggestedPrice > 0 ? (profit / suggestedPrice) * 100 : 0;

  return {
    totalCost,
    suggestedPrice,
    feesValue,
    profit,
    unitPrice,
    unitCost,
    effectiveMargin,
  };
}

function clampPositive(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function toPositiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function hasSavedLead() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(LEAD_STORAGE_KEY) !== null;
}

function readSavedLead() {
  if (typeof window === "undefined") {
    return initialLeadState;
  }

  const savedLead = window.localStorage.getItem(LEAD_STORAGE_KEY);
  if (!savedLead) {
    return initialLeadState;
  }

  try {
    return {
      ...initialLeadState,
      ...(JSON.parse(savedLead) as LeadState),
    };
  } catch {
    window.localStorage.removeItem(LEAD_STORAGE_KEY);
    return initialLeadState;
  }
}

function readSavedCalculator() {
  if (typeof window === "undefined") {
    return initialCalculatorState;
  }

  const savedCalculator = window.localStorage.getItem(CALCULATOR_STORAGE_KEY);
  if (!savedCalculator) {
    return initialCalculatorState;
  }

  try {
    return {
      ...initialCalculatorState,
      ...(JSON.parse(savedCalculator) as CalculatorState),
    };
  } catch {
    window.localStorage.removeItem(CALCULATOR_STORAGE_KEY);
    return initialCalculatorState;
  }
}
