"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { defaultExchangeRateSnapshot } from "@/lib/currency/display-currency";
import {
  saveCalculationToHistory,
  upsertCalculationInHistory,
} from "@/lib/history/calculation-history";
import type { SavedConfectioneryCalculation } from "@/lib/history/workspace-calculations";
import { formatCurrency } from "@/lib/pricing/formatters";
import {
  calculateConfectioneryPrice,
  createConfectioneryIngredientInput,
  hydrateConfectioneryPricingFormState,
  initialConfectioneryPricingForm,
  type ConfectioneryIngredientInput,
  type ConfectioneryIngredientUnit,
  type ConfectioneryPricingFormState,
} from "@/lib/confectionery/calculate-confectionery-price";

const STORAGE_KEY = "dabi-price-3d:confectionery-pricing";

type ConfectioneryPricingWorkspaceProps = {
  workspaceName: string;
  profileLabel: string;
  defaultMarginPercentage: number;
  initialCalculation?: SavedConfectioneryCalculation | null;
  onPersisted?: (calculation: SavedConfectioneryCalculation) => void;
};

type SaveState = "idle" | "saved";

export function ConfectioneryPricingWorkspace({
  workspaceName,
  profileLabel,
  defaultMarginPercentage,
  initialCalculation = null,
  onPersisted,
}: ConfectioneryPricingWorkspaceProps) {
  const storedForm = readStoredForm();
  const [form, setForm] = useState<ConfectioneryPricingFormState>(() =>
    initialCalculation
      ? hydrateConfectioneryPricingFormState(initialCalculation.confectionerySnapshot)
      : hydrateConfectioneryPricingFormState({
          ...storedForm,
          marginPercentage: storedForm?.marginPercentage ?? defaultMarginPercentage,
        }),
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveState("idle"), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [saveState]);

  const result = useMemo(() => calculateConfectioneryPrice(form), [form]);
  const completedFields = [
    form.productName.trim().length > 0,
    form.fixedMonthlyCosts > 0,
    form.desiredMonthlySalary > 0,
    result.ingredientCost > 0,
    form.productionTimeMinutes > 0,
    form.unitsProduced > 0,
  ].filter(Boolean).length;
  const editingLabel = initialCalculation ? "Editar cálculo salvo" : "Novo cálculo";

  async function handleSave() {
    setErrorMessage(null);

    const nextItem: SavedConfectioneryCalculation = {
      id:
        initialCalculation?.id ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `confectionery-${Date.now()}`),
      kind: "confectionery",
      savedAt: new Date().toISOString(),
      productName: form.productName.trim() || "Sem nome",
      salesChannelId: "confectionery-direct",
      salesChannelLabel: "Venda direta",
      displayCurrency: "BRL",
      exchangeRateSnapshot: defaultExchangeRateSnapshot,
      confectionerySnapshot: form,
      summary: {
        salePrice: result.suggestedBatchRevenue,
        totalCost: result.totalBatchCost,
        profit: result.batchProfit,
        marginPercentage: form.marginPercentage,
        profitPerHour:
          result.productionTimeHours > 0
            ? result.batchProfit / result.productionTimeHours
            : result.batchProfit,
      },
    };

    try {
      if (initialCalculation) {
        await upsertCalculationInHistory(nextItem);
      } else {
        await saveCalculationToHistory(nextItem);
      }

      setSaveState("saved");
      onPersisted?.(nextItem);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Falha ao salvar o cálculo.",
      );
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr)_390px]">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-[34px] border border-[#d8ebe3] bg-[linear-gradient(180deg,#ffffff_0%,#f6fcf8_100%)] shadow-[0_24px_54px_rgba(102,170,139,0.12)]">
          <div className="border-b border-[#d8ebe3] bg-[linear-gradient(135deg,rgba(247,255,251,0.98)_0%,rgba(255,247,251,0.96)_100%)] px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-[760px]">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#73ad8e]">
                  Cálculo da confeitaria
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#26473a]">
                  Do custo real ao preço sugerido por unidade
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#638475]">
                  Monte a receita com ingredientes por grama, ml ou unidade, some
                  embalagem e tempo, e deixe o sistema sugerir o preço ideal.
                </p>
              </div>

              <div className="rounded-[24px] border border-[#d8ebe3] bg-white px-4 py-4 text-right shadow-[0_12px_28px_rgba(102,170,139,0.08)]">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#73ad8e]">
                  {editingLabel}
                </p>
                <p className="mt-2 text-base font-semibold text-[#26473a]">
                  {profileLabel}
                </p>
                <p className="mt-1 text-xs text-[#89a295]">{workspaceName}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <PastelHeroStat
                label="Custo por hora"
                value={formatCurrency(result.hourlyCost, "BRL")}
                tone="mint"
              />
              <PastelHeroStat
                label="Custo do lote"
                value={formatCurrency(result.totalBatchCost, "BRL")}
                tone="cream"
              />
              <PastelHeroStat
                label="Preço sugerido"
                value={formatCurrency(result.suggestedUnitPrice, "BRL")}
                tone="pink"
              />
            </div>
          </div>

          <div className="space-y-6 p-6">
            <section className="rounded-[28px] border border-[#dceee7] bg-white px-5 py-5 shadow-[0_14px_34px_rgba(102,170,139,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#73ad8e]">
                    Etapa 1
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#26473a]">
                    Custo da sua hora de trabalho
                  </h3>
                </div>
                <span className="rounded-full border border-[#dceee7] bg-[#f4fbf7] px-3 py-1 text-xs font-semibold text-[#5c977b]">
                  {(completedFields / 6 * 100).toFixed(0)}% preenchido
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <PastelMoneyField
                  label="Despesas fixas mensais"
                  hint="Água, luz, aluguel, internet e outros custos."
                  value={form.fixedMonthlyCosts}
                  onChange={(value) =>
                    updateNumberField(setForm, "fixedMonthlyCosts", value)
                  }
                />
                <PastelMoneyField
                  label="Salário desejado por mês"
                  hint="Quanto você quer retirar do negócio mensalmente."
                  value={form.desiredMonthlySalary}
                  onChange={(value) =>
                    updateNumberField(setForm, "desiredMonthlySalary", value)
                  }
                />
                <PastelNumberField
                  label="Horas trabalhadas por dia"
                  hint="Use a média real do seu dia produtivo."
                  suffix="h"
                  value={form.workHoursPerDay}
                  onChange={(value) =>
                    updateNumberField(setForm, "workHoursPerDay", value)
                  }
                />
                <PastelNumberField
                  label="Dias trabalhados por semana"
                  hint="O cálculo usa 4 semanas por mês."
                  suffix="dias"
                  value={form.workDaysPerWeek}
                  onChange={(value) =>
                    updateNumberField(setForm, "workDaysPerWeek", value)
                  }
                />
              </div>

              <div className="mt-5 rounded-[24px] border border-[#dceee7] bg-[#f8fcfa] px-4 py-4 text-sm text-[#567967]">
                Custo por hora = ({formatCurrency(form.fixedMonthlyCosts, "BRL")} +{" "}
                {formatCurrency(form.desiredMonthlySalary, "BRL")}) ÷{" "}
                {formatNumber(result.monthlyHours)}h ={" "}
                <strong className="text-[#26473a]">
                  {formatCurrency(result.hourlyCost, "BRL")}
                </strong>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#f0dfe6] bg-white px-5 py-5 shadow-[0_14px_34px_rgba(230,161,190,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#d184a4]">
                    Etapa 2
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#26473a]">
                    Receita e composição automática
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      ingredients: [
                        ...current.ingredients,
                        createConfectioneryIngredientInput(),
                      ],
                    }))
                  }
                  className="rounded-full bg-[#f589ae] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(245,137,174,0.24)] transition hover:brightness-105"
                >
                  + Ingrediente
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <PastelTextField
                  label="Nome do produto"
                  hint="Ex.: bolo de chocolate, brigadeiro gourmet, pão caseiro."
                  value={form.productName}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, productName: value }))
                  }
                />
                <PastelNumberField
                  label="Quantidade produzida"
                  hint="Quantas unidades saem deste lote ou receita."
                  suffix="un"
                  value={form.unitsProduced}
                  onChange={(value) =>
                    updateIntegerField(setForm, "unitsProduced", value)
                  }
                />
                <PastelMoneyField
                  label="Custo da embalagem"
                  hint="Caixa, laço, sacola, etiqueta ou apoio do produto."
                  value={form.packagingCost}
                  onChange={(value) => updateNumberField(setForm, "packagingCost", value)}
                />
                <PastelNumberField
                  label="Tempo de produção"
                  hint="Tempo total para produzir esse lote."
                  suffix="min"
                  value={form.productionTimeMinutes}
                  onChange={(value) =>
                    updateNumberField(setForm, "productionTimeMinutes", value)
                  }
                />
              </div>

              <div className="mt-5 space-y-4">
                {result.ingredientBreakdown.map((ingredient, index) => (
                  <div
                    key={ingredient.id}
                    className="rounded-[24px] border border-[#f3e5eb] bg-[#fffafb] px-4 py-4"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,0.8fr))_auto]">
                      <PastelTextField
                        label="Ingrediente"
                        hint="Nome do insumo."
                        value={ingredient.name}
                        onChange={(value) =>
                          updateIngredientField(setForm, index, "name", value)
                        }
                      />
                      <PastelNumberField
                        label="Compra"
                        hint="Quantidade comprada."
                        suffix={ingredient.purchaseUnit}
                        value={ingredient.purchaseQuantity}
                        onChange={(value) =>
                          updateIngredientField(
                            setForm,
                            index,
                            "purchaseQuantity",
                            value,
                          )
                        }
                      />
                      <PastelMoneyField
                        label="Custo da compra"
                        hint="Quanto pagou nesse volume."
                        value={ingredient.purchaseCost}
                        onChange={(value) =>
                          updateIngredientField(setForm, index, "purchaseCost", value)
                        }
                      />
                      <PastelNumberField
                        label="Usado na receita"
                        hint="Quantidade consumida."
                        suffix={ingredient.purchaseUnit}
                        value={ingredient.usageQuantity}
                        onChange={(value) =>
                          updateIngredientField(setForm, index, "usageQuantity", value)
                        }
                      />
                      <UnitField
                        label="Unidade"
                        value={ingredient.purchaseUnit}
                        onChange={(value) =>
                          updateIngredientUnit(setForm, index, value)
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeIngredient(setForm, index)}
                        className="self-start rounded-full border border-[#f0c8d7] bg-white px-4 py-2 text-sm font-semibold text-[#c76489] transition hover:border-[#f589ae] hover:text-[#ab4d71]"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[#f5dce6] bg-white px-4 py-3 text-sm">
                      <span className="text-[#8f6d7b]">
                        Custo por {ingredient.purchaseUnit}:{" "}
                        <strong className="text-[#26473a]">
                          {formatCurrency(ingredient.unitCost, "BRL")}
                        </strong>
                      </span>
                      <span className="text-[#8f6d7b]">
                        Custo deste ingrediente:{" "}
                        <strong className="text-[#c76489]">
                          {formatCurrency(ingredient.totalCost, "BRL")}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[24px] border border-[#f3e6eb] bg-[#fff8fb] px-4 py-4 text-sm text-[#7f6070]">
                Custo total = {formatCurrency(result.ingredientCost, "BRL")} +{" "}
                {formatCurrency(form.packagingCost, "BRL")} +{" "}
                {formatCurrency(result.timeCost, "BRL")} ={" "}
                <strong className="text-[#26473a]">
                  {formatCurrency(result.totalBatchCost, "BRL")}
                </strong>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#ebe5d7] bg-white px-5 py-5 shadow-[0_14px_34px_rgba(192,165,106,0.08)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#b89347]">
                Etapa 3
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#26473a]">
                Margem e preço sugerido
              </h3>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <PastelNumberField
                  label="Perdas de produção"
                  hint="Massa que erra o ponto, unidade que quebra, sobra que não vende."
                  suffix="%"
                  value={form.lossPercentage}
                  onChange={(value) => updateNumberField(setForm, "lossPercentage", value)}
                />
                <PastelNumberField
                  label="Taxas de venda"
                  hint="Comissão do canal, maquininha e tributos sobre o preço."
                  suffix="%"
                  value={form.salesFeePercentage}
                  onChange={(value) =>
                    updateNumberField(setForm, "salesFeePercentage", value)
                  }
                />
                <PastelNumberField
                  label="Margem de lucro"
                  hint="Quanto do preço final você quer que sobre."
                  suffix="%"
                  value={form.marginPercentage}
                  onChange={(value) => updateNumberField(setForm, "marginPercentage", value)}
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] border border-[#f0eadf] bg-[#fffdf7] px-4 py-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#b89347]">
                    Custo por unidade
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#26473a]">
                    {formatCurrency(result.unitCost, "BRL")}
                  </p>
                  <p className="mt-2 text-sm text-[#7f7565]">
                    {formatCurrency(result.totalBatchCostWithLoss, "BRL")} ÷{" "}
                    {form.unitsProduced} unidade(s)
                    {result.lossCost > 0
                      ? ` · inclui ${formatCurrency(result.lossCost, "BRL")} de perda`
                      : ""}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[#f0eadf] bg-[#fffdf7] px-4 py-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#b89347]">
                    Sobra por unidade
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#26473a]">
                    {formatCurrency(result.unitProfit, "BRL")}
                  </p>
                  <p className="mt-2 text-sm text-[#7f7565]">
                    {formatNumber(result.effectiveMarginPercentage)}% do preço
                    {result.salesFeeValue > 0
                      ? ` · depois de ${formatCurrency(result.salesFeeValue, "BRL")} de taxas`
                      : ""}
                  </p>
                </div>
              </div>

              {result.isPricingViable ? (
                <div className="mt-5 rounded-[24px] border border-[#efe8dc] bg-[#fffdf7] px-4 py-4 text-sm text-[#7f7565]">
                  Preço sugerido = {formatCurrency(result.unitCost, "BRL")} ÷ (1 −{" "}
                  {formatNumber(form.salesFeePercentage)}% de taxas −{" "}
                  {formatNumber(form.marginPercentage)}% de margem) ={" "}
                  <strong className="text-[#26473a]">
                    {formatCurrency(result.suggestedUnitPrice, "BRL")}
                  </strong>
                  <span className="mt-2 block">
                    A margem é sobre o preço de venda, não sobre o custo: as taxas
                    incidem sobre o preço, então é assim que a margem pedida vira a
                    margem obtida.
                  </span>
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border border-[#f0d7c8] bg-[#fff2ea] px-4 py-4 text-sm text-[#9d4615]">
                  Taxas ({formatNumber(form.salesFeePercentage)}%) e margem (
                  {formatNumber(form.marginPercentage)}%) somam 100% ou mais do
                  preço. Não existe preço que satisfaça as duas — reduza uma delas.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
        <div className="overflow-hidden rounded-[34px] border border-[#2f473a] bg-[linear-gradient(180deg,#24382e_0%,#1d2e27_100%)] p-6 text-white shadow-[0_26px_48px_rgba(26,44,37,0.28)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#b7d8c6]">
            Resultado
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
            {form.productName || "Produto sem nome"}
          </h3>
          <p className="mt-2 text-sm leading-7 text-[#d2e6db]">
            {form.unitsProduced} unidade(s) em {formatNumber(form.productionTimeMinutes)} min
          </p>

          <div className="mt-6 rounded-[28px] border border-white/10 bg-white/6 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9dcab5]">
              Preço sugerido por unidade
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-[#7cf0bf]">
              {formatCurrency(result.suggestedUnitPrice, "BRL")}
            </p>
            <p className="mt-3 text-sm text-[#d2e6db]">
              Receita total do lote em{" "}
              <strong>{formatCurrency(result.suggestedBatchRevenue, "BRL")}</strong>.
            </p>
          </div>

          <div className="mt-5 space-y-3 rounded-[26px] border border-white/10 bg-black/10 p-4">
            <ResultRow
              label="Custo dos ingredientes"
              value={formatCurrency(result.ingredientCost, "BRL")}
            />
            <ResultRow
              label="Custo da embalagem"
              value={formatCurrency(form.packagingCost, "BRL")}
            />
            <ResultRow
              label="Custo do tempo"
              value={formatCurrency(result.timeCost, "BRL")}
            />
            <ResultRow
              label="Custo total do lote"
              value={formatCurrency(result.totalBatchCost, "BRL")}
              highlight
            />
            <ResultRow
              label="Lucro por unidade"
              value={formatCurrency(result.unitProfit, "BRL")}
            />
            <ResultRow
              label="Lucro estimado do lote"
              value={formatCurrency(result.batchProfit, "BRL")}
              highlight
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSave()}
            className="mt-5 w-full rounded-[22px] bg-[#7cf0bf] px-5 py-3 text-base font-semibold text-[#173227] transition hover:brightness-105"
          >
            {saveState === "saved"
              ? initialCalculation
                ? "Cálculo atualizado"
                : "Cálculo salvo"
              : initialCalculation
                ? "Atualizar no histórico"
                : "Salvar no histórico"}
          </button>

          {errorMessage ? (
            <div className="mt-4 rounded-[20px] border border-[#ffb7c7]/40 bg-[#fff1f5] px-4 py-3 text-sm text-[#7c2d45]">
              {errorMessage}
            </div>
          ) : null}
        </div>

        <div className="rounded-[30px] border border-[#d8ebe3] bg-[linear-gradient(180deg,#fbfffd_0%,#f7fbf9_100%)] p-6 shadow-[0_18px_36px_rgba(102,170,139,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#73ad8e]">
                Exemplo prático
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#26473a]">
                Bolo de Chocolate
              </h3>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm(
                  hydrateConfectioneryPricingFormState({
                    ...initialConfectioneryPricingForm,
                    marginPercentage: 40,
                  }),
                )
              }
              className="rounded-full border border-[#d8ebe3] bg-white px-4 py-2 text-sm font-semibold text-[#4f826c] transition hover:border-[#73ad8e] hover:text-[#2f5d4a]"
            >
              Restaurar exemplo
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm leading-7 text-[#638475]">
            <p>
              Despesas fixas de {formatCurrency(1200, "BRL")}, salário desejado de{" "}
              {formatCurrency(3000, "BRL")}, jornada de 8h por dia e 5 dias por
              semana.
            </p>
            <p>
              Ingredientes compostos automaticamente em{" "}
              <strong className="text-[#26473a]">
                {formatCurrency(15, "BRL")}
              </strong>
              , embalagem em {formatCurrency(2, "BRL")} e 2 horas de produção.
            </p>
            <p>
              O preço sugerido esperado neste exemplo é{" "}
              <strong className="text-[#26473a]">
                {formatCurrency(97.3, "BRL")}
              </strong>
              .
            </p>
          </div>
        </div>

        <div className="rounded-[30px] border border-[#f0e3e8] bg-[#fff9fb] p-6 shadow-[0_18px_36px_rgba(230,161,190,0.08)]">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#d184a4]">
            Leitura rápida
          </p>
          <div className="mt-4 grid gap-3">
            <QuickFormulaCard
              title="1. Custo por hora"
              description="(Despesas fixas + salário desejado) ÷ horas mensais."
            />
            <QuickFormulaCard
              title="2. Receita composta"
              description="Cada ingrediente usa custo de compra ÷ quantidade comprada × quantidade usada."
            />
            <QuickFormulaCard
              title="3. Preço sugerido"
              description="Custo por unidade × (1 + margem de lucro)."
            />
          </div>
        </div>
      </aside>
    </section>
  );
}

function readStoredForm() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as Partial<ConfectioneryPricingFormState>;
  } catch {
    return null;
  }
}

function updateNumberField(
  setForm: Dispatch<SetStateAction<ConfectioneryPricingFormState>>,
  field: keyof ConfectioneryPricingFormState,
  value: string,
) {
  setForm((current) => ({
    ...current,
    [field]: Number(value.replace(",", ".")) || 0,
  }));
}

function updateIntegerField(
  setForm: Dispatch<SetStateAction<ConfectioneryPricingFormState>>,
  field: keyof ConfectioneryPricingFormState,
  value: string,
) {
  setForm((current) => ({
    ...current,
    [field]: Math.max(1, Math.round(Number(value.replace(",", ".")) || 0)),
  }));
}

function updateIngredientField(
  setForm: Dispatch<SetStateAction<ConfectioneryPricingFormState>>,
  index: number,
  field: keyof Omit<ConfectioneryIngredientInput, "id" | "purchaseUnit">,
  value: string,
) {
  setForm((current) => ({
    ...current,
    ingredients: current.ingredients.map((ingredient, ingredientIndex) => {
      if (ingredientIndex !== index) {
        return ingredient;
      }

      if (field === "name") {
        return {
          ...ingredient,
          name: value,
        };
      }

      return {
        ...ingredient,
        [field]: Number(value.replace(",", ".")) || 0,
      };
    }),
  }));
}

function updateIngredientUnit(
  setForm: Dispatch<SetStateAction<ConfectioneryPricingFormState>>,
  index: number,
  value: ConfectioneryIngredientUnit,
) {
  setForm((current) => ({
    ...current,
    ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
      ingredientIndex === index
        ? {
            ...ingredient,
            purchaseUnit: value,
          }
        : ingredient,
    ),
  }));
}

function removeIngredient(
  setForm: Dispatch<SetStateAction<ConfectioneryPricingFormState>>,
  index: number,
) {
  setForm((current) => {
    const nextIngredients = current.ingredients.filter(
      (_, ingredientIndex) => ingredientIndex !== index,
    );

    return {
      ...current,
      ingredients:
        nextIngredients.length > 0
          ? nextIngredients
          : [createConfectioneryIngredientInput()],
    };
  });
}

function PastelTextField({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  hint: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7ca08f]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-[22px] border border-[#d8ebe3] bg-[#fcfffd] px-4 py-3 text-base text-[#26473a] outline-none transition placeholder:text-[#97aa9f] focus:border-[#73ad8e] focus:ring-2 focus:ring-[#73ad8e]/20"
      />
      <p className="mt-2 text-xs leading-6 text-[#8ba195]">{hint}</p>
    </label>
  );
}

function PastelMoneyField({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  hint: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7ca08f]">
        {label}
      </span>
      <div className="mt-2 flex items-center overflow-hidden rounded-[22px] border border-[#d8ebe3] bg-[#fcfffd]">
        <span className="border-r border-[#d8ebe3] px-4 py-3 text-sm text-[#84a092]">
          R$
        </span>
        <input
          type="number"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-[#26473a] outline-none"
        />
      </div>
      <p className="mt-2 text-xs leading-6 text-[#8ba195]">{hint}</p>
    </label>
  );
}

function PastelNumberField({
  label,
  value,
  hint,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  hint: string;
  suffix: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7ca08f]">
        {label}
      </span>
      <div className="mt-2 flex items-center overflow-hidden rounded-[22px] border border-[#d8ebe3] bg-[#fcfffd]">
        <input
          type="number"
          step="any"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-[#26473a] outline-none"
        />
        <span className="border-l border-[#d8ebe3] px-4 py-3 text-sm text-[#84a092]">
          {suffix}
        </span>
      </div>
      <p className="mt-2 text-xs leading-6 text-[#8ba195]">{hint}</p>
    </label>
  );
}

function UnitField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ConfectioneryIngredientUnit;
  onChange: (value: ConfectioneryIngredientUnit) => void;
}) {
  return (
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7ca08f]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as ConfectioneryIngredientUnit)
        }
        className="mt-2 w-full rounded-[22px] border border-[#d8ebe3] bg-[#fcfffd] px-4 py-3 text-base text-[#26473a] outline-none transition focus:border-[#73ad8e] focus:ring-2 focus:ring-[#73ad8e]/20"
      >
        <option value="g">g</option>
        <option value="ml">ml</option>
        <option value="un">un</option>
      </select>
    </label>
  );
}

function PastelHeroStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "pink" | "cream";
}) {
  const toneClassName = {
    mint: "border-[#d5eadf] bg-[#f5fcf8]",
    pink: "border-[#f4d7e2] bg-[#fff7fa]",
    cream: "border-[#efe6d6] bg-[#fffdf6]",
  }[tone];

  return (
    <div className={`rounded-[24px] border px-4 py-4 ${toneClassName}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7ca08f]">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[#26473a]">{value}</p>
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className={highlight ? "font-semibold text-white" : "text-[#d2e6db]"}>
        {label}
      </span>
      <strong className={highlight ? "font-semibold text-[#7cf0bf]" : "text-white"}>
        {value}
      </strong>
    </div>
  );
}

function QuickFormulaCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#f3e4ea] bg-white px-4 py-4">
      <p className="text-sm font-semibold text-[#26473a]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[#8c6b79]">{description}</p>
    </div>
  );
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
}
