import {
  mercadoLivreListingTypes,
  mercadoLivreRootCategories,
} from "@/lib/marketplaces/mercado-livre";
import {
  convertFromBRL,
  formatDecimal,
  type CurrencyRates,
  type DisplayCurrency,
} from "@/lib/currency/display-currency";
import {
  calculateChannelSafeMinimumPrice,
  calculateConsignment,
  calculateDirectSale,
  calculateWholesale,
} from "@/lib/pricing/calculate-sales-models";
import type { Calculate3DPriceResult } from "@/lib/pricing/calculate-3d-price";
import { buildPricingViewModel } from "@/lib/pricing/build-pricing-view-model";
import { formatCurrency, formatPercent } from "@/lib/pricing/formatters";
import type { PricingFormState } from "@/lib/pricing/initial-pricing-form";

type PricingResultProps = {
  productName: string;
  form: PricingFormState;
  result: Calculate3DPriceResult;
  onFieldChange: (
    field: keyof PricingFormState,
    value: string | number | boolean,
  ) => void;
  selectedChannelLabel: string;
  effectiveMarketplaceFeePercentage: number;
  mercadoLivrePredictedCategoryName?: string | null;
  displayCurrency: DisplayCurrency;
  exchangeRates: CurrencyRates;
  onSave: () => void;
  saveButtonLabel: string;
};

type BannerTone = "good" | "warning" | "danger";

type SummaryLine = {
  label: string;
  value: string;
  numericValue?: number;
  hideWhenZero?: boolean;
};

type CostLineItem = {
  label: string;
  amount: number;
  value: string;
  meta?: string;
};

export function PricingResult({
  productName,
  form,
  result,
  onFieldChange,
  selectedChannelLabel,
  effectiveMarketplaceFeePercentage,
  mercadoLivrePredictedCategoryName = null,
  displayCurrency,
  exchangeRates,
  onSave,
  saveButtonLabel,
}: PricingResultProps) {
  if (!result.isValid) {
    return (
      <aside className="rounded-[26px] border border-red-400/20 bg-red-500/10 p-6 shadow-[0_24px_70px_rgba(4,4,14,0.42)] xl:sticky xl:top-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-200">
          Cálculo interrompido
        </p>

        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
          Revise as taxas informadas.
        </h2>

        <p className="mt-4 text-sm leading-7 text-red-100">
          {result.errorMessage}
        </p>
      </aside>
    );
  }

  const {
    baseSalePrice,
    displayedSalePrice,
    estimatedDailyProfit,
    estimatedMonthlyProfit,
    kitItemsPerDay,
    kitItemsPerMonth,
    kitQuantity,
    materialGrams,
    parsedPromoDiscount,
    piecesPerCycle,
    profitPerHour,
    profitPerKitItem,
    promotionalSalePrice,
    realMarginPercentage,
    salePricePerKitItem,
    saleUnitsPerCycle,
    cyclesPerSaleUnit,
    printTimePerCycleHours,
    unitEnergyCost,
    unitLaborCost,
    unitLossCost,
    unitMaintenanceCost,
    unitMarketplaceFee,
    unitMarketplaceFixedFee,
    unitMaterialCost,
    unitPackagingCost,
    unitProfit,
    unitShippingCost,
    unitTaxCost,
    unitTotalCost,
    unitProductionCost,
    lotProfit,
    lotsPerDay,
    unitsPerDay,
    lotsPerMonth,
    unitsPerMonth,
  } = buildPricingViewModel(form, result);

  const marginBadge = getMarginBadge(realMarginPercentage);
  const unitCoreCost = unitProductionCost + unitTaxCost;
  const directSale = calculateDirectSale({
    customerPrice: displayedSalePrice,
    costTotal: unitCoreCost,
  });
  const activeChannelSafeMinimumPrice = calculateChannelSafeMinimumPrice({
    baseCost: unitProductionCost,
    variableFeePercentage:
      effectiveMarketplaceFeePercentage + form.taxPercentage,
    fixedFee: unitMarketplaceFixedFee,
    targetMarginPercentage: form.profitMarginPercentage,
  });
  const consignment = calculateConsignment({
    customerPrice: displayedSalePrice,
    costTotal: unitCoreCost,
    commissionPercentage: form.consignmentCommissionPercentage,
  });
  const wholesale = calculateWholesale({
    costTotal: unitCoreCost,
  });

  const summaryLines = buildSummaryLines({
    form,
    selectedChannelLabel,
    effectiveMarketplaceFeePercentage,
    mercadoLivrePredictedCategoryName,
    displayCurrency,
    exchangeRates,
  }).filter((line) => !line.hideWhenZero || !isZeroValue(line.numericValue));

  const feeLabel =
    form.salesChannelId === "consignment"
      ? "Comissão do parceiro"
      : "Taxa marketplace";
  const salePriceLabel =
    form.salesChannelId === "consignment"
      ? form.isKit
        ? "Preço sugerido do kit"
        : "Preço sugerido"
      : form.isKit
        ? "Preço de venda do kit"
        : "Preço de venda";
  const wholesaleUnitLabel = form.isKit ? "kit" : "un.";
  const saleUnitLabel = form.isKit ? "kit" : "unidade";
  const saleUnitLabelPlural = form.isKit ? "kits" : "unidades";
  const kitHelperText = form.isKit
    ? `${kitQuantity} item(ns) por kit`
    : undefined;

  const money = (value: number) =>
    formatCurrency(
      convertFromBRL(value, displayCurrency, exchangeRates),
      displayCurrency,
    );

  const perKitItemSalePrice = money(salePricePerKitItem);
  const directSaleCostPerKitItem = directSale.costTotal / kitQuantity;
  const directSaleProfitPerKitItem = directSale.grossProfit / kitQuantity;
  const perKitItemCost = money(directSaleCostPerKitItem);
  const perKitItemProfit = money(directSaleProfitPerKitItem);
  const perKitItemNetProfit = money(profitPerKitItem);

  const channelChargesTotal =
    unitMarketplaceFee +
    unitMarketplaceFixedFee +
    unitTaxCost +
    unitShippingCost;
  const safeGap = displayedSalePrice - activeChannelSafeMinimumPrice;
  const activeWorthIt = unitProfit > 0;
  const activeDecision = getActiveDecision({
    activeWorthIt,
    marginPercentage: realMarginPercentage,
    safeGapValue: safeGap,
    selectedChannelLabel,
    formattedSafeGap: money(Math.abs(safeGap)),
  });
  const cyclesPerSaleLabel = formatDecimal(cyclesPerSaleUnit);
  const saleUnitsPerCycleLabel = formatDecimal(saleUnitsPerCycle);
  const cycleTimeLabel = `${printTimePerCycleHours.toFixed(2).replace(".", ",")}h`;
  const productFlowSummary = form.isKit
    ? cyclesPerSaleUnit > 1
      ? `${piecesPerCycle} peça(s) por ciclo · ${kitQuantity} item(ns) por kit · ${cyclesPerSaleLabel} ciclo(s) para fechar 1 kit`
      : `${kitQuantity} item(ns) por kit · 1 ciclo por kit`
    : saleUnitsPerCycle > 1
      ? `${saleUnitsPerCycleLabel} ${saleUnitLabelPlural} por ciclo`
      : `1 ${saleUnitLabel} por ciclo`;
  const timeSummary = form.isKit
    ? cyclesPerSaleUnit > 1
      ? `${cycleTimeLabel} por ciclo · total para produzir 1 kit`
      : "Tempo total para produzir 1 kit"
    : saleUnitsPerCycle > 1
      ? `${cycleTimeLabel} por ciclo`
      : "Base de energia e produtividade";
  const profitPerCycleSummary = form.isKit
    ? cyclesPerSaleUnit > 1
      ? `1 kit a cada ${cyclesPerSaleLabel} ciclo(s) · ${piecesPerCycle} peça(s) por ciclo`
      : "1 kit por ciclo"
    : saleUnitsPerCycle > 1
      ? `${saleUnitsPerCycleLabel} unidade(s) produzidas por ciclo`
      : "1 unidade por ciclo";

  const productionCostItems: CostLineItem[] = [
    {
      label: "Filamento",
      amount: unitMaterialCost,
      meta: `${materialGrams}g`,
      value: money(unitMaterialCost),
    },
    {
      label: "Energia elétrica",
      amount: unitEnergyCost,
      meta:
        displayedSalePrice > 0
          ? formatPercent((unitEnergyCost / displayedSalePrice) * 100)
          : undefined,
      value: money(unitEnergyCost),
    },
    {
      label: "Embalagem e acabamento",
      amount: unitPackagingCost,
      value: money(unitPackagingCost),
    },
    {
      label: "Manutenção e extras",
      amount: unitMaintenanceCost,
      value: money(unitMaintenanceCost),
    },
    {
      label: "Mão de obra",
      amount: unitLaborCost,
      value: money(unitLaborCost),
    },
    {
      label: "Reserva de perdas",
      amount: unitLossCost,
      value: money(unitLossCost),
    },
  ].filter((item) => !isZeroValue(item.amount));

  const channelCostItems: CostLineItem[] = [
    {
      label: feeLabel,
      amount: unitMarketplaceFee,
      meta:
        displayedSalePrice > 0
          ? formatPercent((unitMarketplaceFee / displayedSalePrice) * 100)
          : undefined,
      value: money(unitMarketplaceFee),
    },
    {
      label: "Tarifa fixa marketplace",
      amount: unitMarketplaceFixedFee,
      value: money(unitMarketplaceFixedFee),
    },
    {
      label: "Imposto",
      amount: unitTaxCost,
      meta:
        displayedSalePrice > 0
          ? formatPercent((unitTaxCost / displayedSalePrice) * 100)
          : undefined,
      value: money(unitTaxCost),
    },
    {
      label: "Frete",
      amount: unitShippingCost,
      meta:
        displayedSalePrice > 0
          ? formatPercent((unitShippingCost / displayedSalePrice) * 100)
          : undefined,
      value: money(unitShippingCost),
    },
  ].filter((item) => !isZeroValue(item.amount));

  return (
    <aside className="xl:sticky xl:top-6">
      <section className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
          Resultado final
        </p>

        <div className="mt-6 rounded-[24px] border border-[var(--accent)]/30 bg-[linear-gradient(180deg,rgba(118,201,255,0.14),rgba(7,15,28,0.96))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--accent)]">
                {selectedChannelLabel}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-white">
                {money(displayedSalePrice)}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{salePriceLabel}</p>
            </div>

            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-medium ${marginBadge.className}`}
            >
              {marginBadge.label}
            </span>
          </div>

          {form.isKit ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
              <SimpleLine label="Itens por kit" value={`${kitQuantity}`} muted />
              <SimpleLine
                label="Valor por item do kit"
                value={perKitItemSalePrice}
                highlight
              />
            </div>
          ) : null}

          {form.promoEnabled && promotionalSalePrice ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
              <SimpleLine
                label="Preço original"
                value={money(baseSalePrice)}
              />
              <SimpleLine
                label="Desconto aplicado"
                value={formatPercent(parsedPromoDiscount)}
                muted
              />
              <SimpleLine
                label="Preço promocional"
                value={money(promotionalSalePrice)}
                highlight
              />
            </div>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label="Lucro líquido"
              value={money(unitProfit)}
              helper={form.isKit ? `${perKitItemNetProfit} por item` : undefined}
              tone={activeWorthIt ? "success" : "danger"}
            />
            <SummaryCard
              label="Margem real"
              value={formatPercent(realMarginPercentage)}
              helper={kitHelperText}
              tone="accent"
            />
            <SummaryCard
              label="Custo total neste canal"
              value={money(unitTotalCost)}
            />
            <SummaryCard
              label="Preço mínimo seguro"
              value={money(activeChannelSafeMinimumPrice)}
              helper="Piso já considerando taxas, imposto e margem alvo."
            />
          </div>

          <RecommendationBanner
            className="mt-5"
            tone={activeDecision.tone}
            title={activeDecision.title}
            message={activeDecision.message}
          />
        </div>

        <div className="mt-7">
          <SectionTitle title="Leitura rápida" />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label="Cliente paga"
              value={money(displayedSalePrice)}
              helper={
                form.isKit ? `${perKitItemSalePrice} por item do kit` : undefined
              }
              tone="accent"
            />
            <SummaryCard
              label="Taxas, imposto e frete"
              value={money(channelChargesTotal)}
              helper="Custos específicos do canal ativo."
            />
            <SummaryCard
              label="Custo de produção"
              value={money(unitProductionCost)}
              helper="Material, energia, perdas e operação."
            />
            <SummaryCard
              label="Sobra para você"
              value={money(unitProfit)}
              helper={`${money(profitPerHour)} / hora`}
              tone={activeWorthIt ? "success" : "danger"}
            />
          </div>
        </div>

        <div className="mt-7">
          <SectionTitle title="Composição do custo" />

          <div className="mt-4 grid gap-4">
            <CostGroupCard
              title="Produção"
              subtitle="O que custa fabricar uma unidade vendável."
              items={productionCostItems}
              totalLabel="Subtotal de produção"
              totalValue={money(unitProductionCost)}
            />

            <CostGroupCard
              title="Canal e impostos"
              subtitle="Descontos e cobranças que acontecem na venda."
              items={channelCostItems}
              totalLabel="Subtotal do canal"
              totalValue={money(channelChargesTotal)}
            />
          </div>

          <div className="mt-4 rounded-[20px] border border-white/8 bg-black/10 px-4 py-4">
            <SimpleLine
              label="Total do custo neste canal"
              value={money(unitTotalCost)}
              highlight
            />
          </div>
        </div>

        <div className="mt-7 border-t border-white/8 pt-6">
          <AccordionSection
            title="Outros cenários"
            description="Abra para comparar formatos alternativos de venda."
            defaultOpen
          >
            <div className="space-y-4">
              <ScenarioCard
                title="Venda direta"
                description="Sem comissão de loja ou marketplace."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryCard
                    label={form.isKit ? "Cliente paga no kit" : "Cliente paga"}
                    value={money(directSale.customerPrice)}
                    helper={
                      form.isKit ? `${perKitItemSalePrice} por item` : undefined
                    }
                    tone="accent"
                  />
                  <SummaryCard
                    label={form.isKit ? "Custo total do kit" : "Custo total"}
                    value={money(directSale.costTotal)}
                    helper={form.isKit ? `${perKitItemCost} por item` : undefined}
                  />
                  <SummaryCard
                    label="Lucro bruto"
                    value={money(directSale.grossProfit)}
                    helper={form.isKit ? `${perKitItemProfit} por item` : undefined}
                    tone={directSale.isWorthIt ? "success" : "danger"}
                  />
                  <SummaryCard
                    label="Margem"
                    value={formatPercent(directSale.marginPercentage)}
                  />
                </div>

                <RecommendationBanner
                  className="mt-4"
                  tone={directSale.isWorthIt ? "good" : "danger"}
                  title={
                    directSale.isWorthIt
                      ? "Direto funciona"
                      : "Direto precisa ajuste"
                  }
                  message={
                    directSale.isWorthIt
                      ? "Na venda direta, o preço atual cobre o custo e deixa lucro."
                      : "Na venda direta, o preço atual ainda não cobre o custo total."
                  }
                />
              </ScenarioCard>

              <AccordionSection
                title="Consignado"
                description="Simule rapidamente quanto o ponto parceiro fica."
                compact
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Comissão do ponto de venda
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Ajuste quanto a loja fica em cada venda.
                    </p>
                  </div>

                  <strong className="text-2xl font-semibold tracking-[-0.04em] text-[var(--accent)]">
                    {formatPercent(form.consignmentCommissionPercentage)}
                  </strong>
                </div>

                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={form.consignmentCommissionPercentage}
                  onChange={(event) =>
                    onFieldChange(
                      "consignmentCommissionPercentage",
                      Number(event.target.value),
                    )
                  }
                  className="mt-5 w-full accent-[var(--accent)]"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  {[25, 30].map((percentage) => (
                    <button
                      key={percentage}
                      type="button"
                      onClick={() =>
                        onFieldChange("consignmentCommissionPercentage", percentage)
                      }
                      className={`rounded-xl border px-3 py-2 text-sm transition ${
                        form.consignmentCommissionPercentage === percentage
                          ? "border-[var(--accent)]/45 bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-white/8 text-white hover:border-white/14 hover:bg-white/4"
                      }`}
                    >
                      {percentage}%
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <SummaryCard
                    label="Cliente paga"
                    value={money(consignment.customerPrice)}
                  />
                  <SummaryCard
                    label="Loja fica com"
                    value={money(consignment.storeCommissionValue)}
                    helper={formatPercent(consignment.storeCommissionPercentage)}
                  />
                  <SummaryCard
                    label="Volta para você"
                    value={money(consignment.amountReturnedToYou)}
                    tone="accent"
                  />
                  <SummaryCard
                    label="Lucro final"
                    value={money(consignment.grossProfit)}
                    tone={consignment.isWorthIt ? "success" : "danger"}
                  />
                </div>

                <RecommendationBanner
                  className="mt-4"
                  tone={consignment.tone}
                  title={
                    consignment.isWorthIt
                      ? "Consignado viável"
                      : "Consignado em risco"
                  }
                  message={consignment.recommendation}
                />
              </AccordionSection>

              <AccordionSection
                title="Revenda / atacado"
                description="Faixas rápidas para negociar lote com lojista."
                compact
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <SummaryCard
                    label={form.isKit ? "Custo total do kit" : "Custo total do produto"}
                    value={money(wholesale.costTotal)}
                  />
                  <SummaryCard
                    label={form.isKit ? "Preço mínimo seguro do kit" : "Preço mínimo seguro"}
                    value={money(wholesale.safeMinimumPrice)}
                    helper="Base mínima recomendada para lojistas."
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {wholesale.tiers.map((tier) => (
                    <div
                      key={tier.units}
                      className="rounded-[18px] border border-white/8 bg-black/10 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {tier.label}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            Multiplicador{" "}
                            {tier.multiplier.toFixed(1).replace(".", ",")}x
                          </p>
                        </div>

                        <strong className="text-lg font-semibold tracking-[-0.04em] text-[var(--accent)]">
                          {money(tier.unitPrice)} / {wholesaleUnitLabel}
                        </strong>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <SummaryCard
                          label={form.isKit ? "Preço por kit" : "Preço por unidade"}
                          value={money(tier.unitPrice)}
                        />
                        <SummaryCard
                          label={form.isKit ? "Lucro por kit" : "Lucro por unidade"}
                          value={money(tier.unitProfit)}
                          tone={tier.unitProfit > 0 ? "success" : "danger"}
                        />
                        <SummaryCard
                          label="Lucro total estimado"
                          value={money(tier.totalProfit)}
                        />
                      </div>

                      {tier.isCloseToCost ? (
                        <RecommendationBanner
                          className="mt-4"
                          tone="warning"
                          title="Margem apertada"
                          message="Esse preço está muito perto do custo. Revise antes de fechar com a loja."
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </AccordionSection>
            </div>
          </AccordionSection>
        </div>

        <div className="mt-7 border-t border-white/8 pt-6">
          <SectionTitle title="Produção e contexto" />

          <div className="mt-4 rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-5">
            <div className="space-y-4">
              <MetricLine
                label="Produto"
                value={productName || "Sem nome"}
                muted={productFlowSummary}
              />

              <MetricLine
                label="Tempo total"
                value={`${result.printTimeTotalHours
                  .toFixed(2)
                  .replace(".", ",")}h`}
                muted={[
                  timeSummary,
                  form.dividePrintTimeByPieces
                    ? "tempo digitado do ciclo"
                    : "tempo digitado por peça",
                  form.divideFilamentByPieces
                    ? "filamento digitado do ciclo"
                    : "filamento digitado por peça",
                ].join(" · ")}
              />

              {saleUnitsPerCycle !== 1 ? (
                <MetricLine
                  label="Lucro por ciclo"
                  value={money(lotProfit)}
                  muted={profitPerCycleSummary}
                />
              ) : null}

              <MetricLine
                label="Lucro diário estimado (20h)"
                value={money(estimatedDailyProfit)}
                muted={
                  saleUnitsPerCycle !== 1 || form.isKit
                    ? form.isKit
                      ? `${formatDecimal(lotsPerDay)} ciclo(s)/dia · ${formatDecimal(
                          unitsPerDay,
                        )} ${saleUnitLabelPlural}/dia · ${formatDecimal(
                          kitItemsPerDay,
                        )} itens/dia`
                      : `${formatDecimal(lotsPerDay)} ciclo(s)/dia · ${Math.round(
                          unitsPerDay,
                        )} un/dia`
                    : undefined
                }
              />

              <MetricLine
                label="Lucro mensal estimado (30d)"
                value={money(estimatedMonthlyProfit)}
                muted={
                  saleUnitsPerCycle !== 1 || form.isKit
                    ? form.isKit
                      ? `${formatDecimal(
                          lotsPerMonth,
                        )} ciclo(s)/mês · ${formatDecimal(
                          unitsPerMonth,
                        )} ${saleUnitLabelPlural}/mês · ${formatDecimal(
                          kitItemsPerMonth,
                        )} itens/mês`
                      : `${formatDecimal(
                          lotsPerMonth,
                        )} ciclo(s)/mês · ${Math.round(unitsPerMonth)} un/mês`
                    : undefined
                }
                highlight
              />
            </div>

            <div className="mt-5 border-t border-white/8 pt-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
                Configuração ativa
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {summaryLines.map((line) => (
                  <SimpleBlock key={line.label} label={line.label} value={line.value} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSave}
          className="mt-7 w-full rounded-2xl bg-[var(--accent)] px-4 py-4 text-base font-semibold text-[#07110d] transition hover:brightness-110"
        >
          {saveButtonLabel}
        </button>
      </section>
    </aside>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
      {title}
    </p>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "accent" | "success" | "danger";
}) {
  const toneClassName = {
    default: "border-white/8 bg-black/10 text-white",
    accent:
      "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]",
    success: "border-[#6fd3ea]/20 bg-[#102a34] text-[#9ae7f9]",
    danger: "border-rose-400/20 bg-[#3d1b25] text-[#ffb1c0]",
  }[tone];

  return (
    <div className={`rounded-[18px] border p-4 ${toneClassName}`}>
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <strong className="mt-3 block text-lg font-semibold tracking-[-0.04em]">
        {value}
      </strong>

      {helper ? (
        <p className="mt-2 text-xs text-[var(--muted)]">{helper}</p>
      ) : null}
    </div>
  );
}

function RecommendationBanner({
  title,
  message,
  tone,
  className = "",
}: {
  title: string;
  message: string;
  tone: BannerTone;
  className?: string;
}) {
  const toneClassName = {
    good: "border-[#6fd3ea]/20 bg-[#102a34] text-[#9ae7f9]",
    warning: "border-amber-400/20 bg-[#4f3c1e] text-[#ffcf6e]",
    danger: "border-rose-400/20 bg-[#45202a] text-[#ffb1c0]",
  }[tone];

  return (
    <div className={`rounded-[18px] border px-4 py-4 ${toneClassName} ${className}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
    </div>
  );
}

function AccordionSection({
  title,
  description,
  children,
  defaultOpen = false,
  compact = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  compact?: boolean;
}) {
  return (
    <details
      className={`group overflow-hidden rounded-[22px] border border-white/8 bg-[var(--panel-soft)] ${
        compact ? "" : "shadow-[0_10px_28px_rgba(0,0,0,0.16)]"
      }`}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 marker:content-none">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{title}</p>
          {description ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
          ) : null}
        </div>

        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/15 text-sm text-[var(--accent)] transition-transform duration-200 group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="border-t border-white/8 px-5 py-5">{children}</div>
    </details>
  );
}

function CostGroupCard({
  title,
  subtitle,
  items,
  totalLabel,
  totalValue,
}: {
  title: string;
  subtitle: string;
  items: CostLineItem[];
  totalLabel: string;
  totalValue: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-5">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p>
      </div>

      <div className="mt-4 space-y-1">
        {items.length > 0 ? (
          items.map((item) => (
            <CostLine
              key={item.label}
              label={item.label}
              value={item.value}
              meta={item.meta}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-[var(--muted)]">
            Nenhum custo relevante registrado aqui para o cenário atual.
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-white/8 pt-4">
        <SimpleLine label={totalLabel} value={totalValue} highlight />
      </div>
    </div>
  );
}

function CostLine({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 py-4 last:border-b-0">
      <div>
        <p className="text-sm text-[#d6d9e8]">{label}</p>
        {meta ? <p className="mt-1 text-xs text-[var(--muted)]">{meta}</p> : null}
      </div>

      <span className="font-mono text-sm text-[#dc2828]">- {value}</span>
    </div>
  );
}

function ScenarioCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-5">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function MetricLine({
  label,
  value,
  muted,
  highlight = false,
}: {
  label: string;
  value: string;
  muted?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-sm text-[#d6d9e8]">{label}</p>

        {muted ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{muted}</p>
        ) : null}
      </div>

      <strong
        className={`text-right text-xl font-semibold tracking-[-0.04em] ${
          highlight ? "text-[var(--accent)]" : "text-white"
        }`}
      >
        {value}
      </strong>
    </div>
  );
}

function SimpleLine({
  label,
  value,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[#d6d9e8]">{label}</span>

      <strong
        className={`font-mono text-sm ${
          highlight
            ? "text-[var(--accent)]"
            : muted
              ? "text-[var(--muted)]"
              : "text-white"
        }`}
      >
        {value}
      </strong>
    </div>
  );
}

function SimpleBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/10 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <strong className="mt-2 block text-sm font-semibold text-white">
        {value}
      </strong>
    </div>
  );
}

function buildSummaryLines({
  form,
  selectedChannelLabel,
  effectiveMarketplaceFeePercentage,
  mercadoLivrePredictedCategoryName,
  displayCurrency,
  exchangeRates,
}: {
  form: PricingFormState;
  selectedChannelLabel: string;
  effectiveMarketplaceFeePercentage: number;
  mercadoLivrePredictedCategoryName: string | null;
  displayCurrency: DisplayCurrency;
  exchangeRates: CurrencyRates;
}) {
  const printerLabel =
    printerLabels[form.printerModel] ?? form.printerModel.toUpperCase();

  const lines: SummaryLine[] = [
    {
      label: "Canal",
      value: selectedChannelLabel,
    },
    {
      label: "Tipo de produto",
      value: form.productType === "3d" ? "Produto 3D" : "Produto normal",
    },
    {
      label: "Precificação",
      value:
        form.pricingMode === "manual"
          ? `Preço manual ${formatCurrency(
              convertFromBRL(
                form.manualSalePrice,
                displayCurrency,
                exchangeRates,
              ),
              displayCurrency,
            )}`
          : `Margem ${formatPercent(form.profitMarginPercentage)}`,
    },
    {
      label: "Promoção",
      value: form.promoEnabled
        ? `${formatPercent(form.promoDiscountPercentage)} ativa`
        : "Desligada",
    },
    {
      label: "Impressora",
      value: printerLabel,
    },
    {
      label: "Produção por ciclo",
      value: form.multiplePiecesEnabled
        ? `${form.quantity} peças`
        : "1 peça por vez",
    },
    {
      label: "Venda",
      value: form.isKit ? `Kit com ${form.kitQuantity} itens` : "Unidade avulsa",
    },
  ];

  if (form.multiplePiecesEnabled) {
    lines.push({
      label: "Rateio do ciclo",
      value: [
        form.dividePrintTimeByPieces ? "tempo do ciclo" : "tempo por peça",
        form.divideFilamentByPieces
          ? "filamento do ciclo"
          : "filamento por peça",
      ].join(" · "),
    });
  }

  if (form.salesChannelId === "mercado-livre") {
    const listingTypeLabel =
      mercadoLivreListingTypes.find(
        (listingType) => listingType.id === form.mercadoLivreListingTypeId,
      )?.label ?? "Classico";

    const rootCategoryLabel =
      mercadoLivreRootCategories.find(
        (category) => category.key === form.mercadoLivreRootCategoryKey,
      )?.label ?? "Categoria ML";

    lines.push(
      {
        label: "Tipo de anúncio",
        value: listingTypeLabel,
      },
      {
        label: "Categoria ML",
        value: mercadoLivrePredictedCategoryName ?? rootCategoryLabel,
      },
      {
        label: "Taxa ML",
        value: formatPercent(effectiveMarketplaceFeePercentage),
        numericValue: effectiveMarketplaceFeePercentage,
        hideWhenZero: true,
      },
      {
        label: "Frete grátis",
        value: form.mercadoLivreFreeShipping ? "Sim" : "Não",
      },
      {
        label: "Frete no cálculo",
        value: formatCurrency(
          convertFromBRL(form.shippingCost, displayCurrency, exchangeRates),
          displayCurrency,
        ),
        numericValue: form.shippingCost,
        hideWhenZero: true,
      },
    );
  }

  if (form.salesChannelId === "shopee") {
    lines.push(
      {
        label: "Tipo de vendedor",
        value: form.shopeeSellerType === "cnpj" ? "CNPJ" : "CPF",
      },
      {
        label: "Campanha",
        value: form.shopeeFeaturedCampaign ? "Destaque ativo" : "Sem campanha",
      },
      {
        label: "Cupom próprio",
        value: form.shopeeOwnCoupon
          ? form.shopeeCouponMode === "percent"
            ? `${formatPercent(form.shopeeCouponValue)}`
            : formatCurrency(
                convertFromBRL(
                  form.shopeeCouponValue,
                  displayCurrency,
                  exchangeRates,
                ),
                displayCurrency,
              )
          : "Desligado",
        numericValue: form.shopeeOwnCoupon ? form.shopeeCouponValue : undefined,
        hideWhenZero: form.shopeeOwnCoupon,
      },
    );
  }

  if (form.salesChannelId === "amazon") {
    lines.push(
      {
        label: "Fulfillment",
        value: form.amazonFulfillment.toUpperCase(),
      },
      {
        label: "Categoria Amazon",
        value: amazonCategoryLabels[form.amazonCategory] ?? form.amazonCategory,
      },
      {
        label: "Parcelamento",
        value: form.amazonInstallmentsEnabled ? "Habilitado" : "Desligado",
      },
    );
  }

  if (form.salesChannelId === "direct") {
    lines.push(
      {
        label: "Forma de pagamento",
        value:
          paymentMethodLabels[form.directPaymentMethod] ??
          form.directPaymentMethod,
      },
      {
        label: "Taxa manual",
        value: formatPercent(form.directCustomCardFeePercentage),
        numericValue: form.directCustomCardFeePercentage,
        hideWhenZero: true,
      },
      {
        label: "Desconto Pix",
        value: formatPercent(form.directPixDiscountPercentage),
        numericValue: form.directPixDiscountPercentage,
        hideWhenZero: true,
      },
    );
  }

  if (form.salesChannelId === "consignment") {
    lines.push(
      {
        label: "Modelo",
        value: "Consignado",
      },
      {
        label: "Comissão do parceiro",
        value: formatPercent(form.consignmentCommissionPercentage),
        numericValue: form.consignmentCommissionPercentage,
      },
    );
  }

  return lines;
}

const printerLabels: Record<string, string> = {
  "bambu-a1": "Bambu Lab A1",
  "bambu-a1-mini": "Bambu Lab A1 Mini",
  "bambu-p1s": "Bambu Lab P1S",
  "bambu-x1-carbon": "Bambu Lab X1 Carbon",
  "creality-k1": "Creality K1",
  "ender-3": "Ender 3",
};

const amazonCategoryLabels: Record<string, string> = {
  "casa-e-cozinha": "Casa e Cozinha",
  eletronicos: "Eletrônicos",
  utilidades: "Utilidades",
};

const paymentMethodLabels: Record<string, string> = {
  debit: "Débito",
  credit: "Crédito",
  "2x": "2x",
  "3x": "3x",
  "4x": "4x",
  "6x": "6x",
  "12x": "12x",
  other: "Outra",
};

function getMarginBadge(margin: number) {
  if (margin >= 45) {
    return {
      label: "Excelente",
      className: "border-[#6fd3ea]/25 bg-[#113849] text-[#8fe3f6]",
    };
  }

  if (margin >= 25) {
    return {
      label: "Muito boa",
      className: "border-[#11b8f5]/25 bg-[#0e3150] text-[#7edbff]",
    };
  }

  if (margin >= 12) {
    return {
      label: "Atenção",
      className: "border-amber-400/20 bg-[#4f3c1e] text-[#ffbf3f]",
    };
  }

  return {
    label: "Ajustar",
    className: "border-rose-400/20 bg-[#4a2029] text-[#ff9aaa]",
  };
}

function getActiveDecision({
  activeWorthIt,
  marginPercentage,
  safeGapValue,
  selectedChannelLabel,
  formattedSafeGap,
}: {
  activeWorthIt: boolean;
  marginPercentage: number;
  safeGapValue: number;
  selectedChannelLabel: string;
  formattedSafeGap: string;
}) {
  if (!activeWorthIt || safeGapValue < 0) {
    return {
      tone: "danger" as const,
      title: "Preço precisa ajuste",
      message: `No canal ${selectedChannelLabel}, o valor atual está ${formattedSafeGap} abaixo do mínimo seguro ou já entrou em lucro negativo.`,
    };
  }

  if (marginPercentage < 12) {
    return {
      tone: "warning" as const,
      title: "Venda viável, mas apertada",
      message:
        "O preço cobre o cenário atual, mas a folga de margem está curta para absorver desconto, erro ou oscilação de custo.",
    };
  }

  if (marginPercentage < 25) {
    return {
      tone: "warning" as const,
      title: "Venda saudável com pouca gordura",
      message: `Você está ${formattedSafeGap} acima do mínimo seguro. Ainda vale revisar antes de fazer promoção.`,
    };
  }

  return {
    tone: "good" as const,
    title: "Preço bem posicionado",
    message: `Você está ${formattedSafeGap} acima do mínimo seguro neste canal, com margem confortável para operar.`,
  };
}

function isZeroValue(value?: number) {
  return value === undefined || Math.abs(value) < 0.0001;
}
