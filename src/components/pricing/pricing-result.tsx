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
  calculateProfitMargin,
  calculateConsignment,
  calculateDirectSale,
  calculateWholesale,
} from "@/lib/pricing/calculate-sales-models";
import {
  calculateProfitDestinationBreakdown,
  type ProfitDestinationPercentages,
} from "@/lib/pricing/profit-destination";
import { resolveShopeeFeeConfigForPrice } from "@/lib/marketplaces/shopee";
import {
  calculate3DPrice,
  type Calculate3DPriceResult,
} from "@/lib/pricing/calculate-3d-price";
import { buildPricingViewModel } from "@/lib/pricing/build-pricing-view-model";
import { formatCurrency, formatPercent } from "@/lib/pricing/formatters";
import type { PricingFormState } from "@/lib/pricing/initial-pricing-form";

type PricingResultProps = {
  productName: string;
  form: PricingFormState;
  result: Calculate3DPriceResult;
  profitDestinations: ProfitDestinationPercentages;
  onFieldChange: (
    field: keyof PricingFormState,
    value: string | number | boolean,
  ) => void;
  selectedChannelLabel: string;
  effectiveMarketplaceFeePercentage: number;
  effectiveMarketplaceFixedFee: number;
  mercadoLivrePredictedCategoryName?: string | null;
  displayCurrency: DisplayCurrency;
  exchangeRates: CurrencyRates;
  onSave: () => void;
  saveButtonLabel: string;
};

type BannerTone = "good" | "warning" | "danger";
type FinancialTone = "default" | "accent" | "success" | "danger";

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
  tone?: FinancialTone;
};

const financialToneTextClassName: Record<FinancialTone, string> = {
  default: "text-[var(--foreground)]",
  accent: "text-[var(--accent)]",
  success: "text-[#137a3a]",
  danger: "text-[#c1372b]",
};

const financialToneBorderClassName: Record<FinancialTone, string> = {
  default: "border-[var(--panel-border)]",
  accent: "border-[var(--accent)]",
  success: "border-[#137a3a]",
  danger: "border-[#c1372b]",
};

export function PricingResult({
  productName,
  form,
  result,
  profitDestinations,
  onFieldChange,
  selectedChannelLabel,
  effectiveMarketplaceFeePercentage,
  effectiveMarketplaceFixedFee,
  mercadoLivrePredictedCategoryName = null,
  displayCurrency,
  exchangeRates,
  onSave,
  saveButtonLabel,
}: PricingResultProps) {
  if (!result.isValid) {
    return (
      <aside className="rounded-[30px] border border-[var(--accent)] bg-[linear-gradient(180deg,#271a59_0%,#140d33_100%)] p-6 text-white shadow-[0_24px_70px_rgba(12,8,32,0.34)] xl:sticky xl:top-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/70">
          Cálculo interrompido
        </p>

        <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
          Revise as taxas informadas.
        </h2>

        <p className="mt-4 text-sm leading-7 text-white">
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

  const unitCoreCost = unitProductionCost + unitTaxCost;
  const directSale = calculateDirectSale({
    customerPrice: displayedSalePrice,
    costTotal: unitCoreCost,
  });
  const healthyMarginTarget = form.healthyMarginTargetPercentage;
  const activeChannelSuggestedMinimumPrice = calculateChannelSafeMinimumPrice({
    baseCost: unitProductionCost,
    variableFeePercentage:
      effectiveMarketplaceFeePercentage + form.taxPercentage,
    fixedFee: effectiveMarketplaceFixedFee,
    targetMarginPercentage: healthyMarginTarget,
  });
  const consignment = calculateConsignment({
    customerPrice: displayedSalePrice,
    costTotal: unitCoreCost,
    commissionPercentage: form.consignmentCommissionPercentage,
  });
  const wholesale = calculateWholesale({
    costTotal: unitCoreCost,
  });
  const profitDestinationBreakdown = calculateProfitDestinationBreakdown({
    estimatedProfit: unitProfit,
    percentages: profitDestinations,
  });
  const benchmarkPracticedScenario =
    form.benchmarkPracticedPrice > 0
      ? calculate3DPrice({
          ...form,
          pricingMode: "manual",
          manualSalePrice: form.benchmarkPracticedPrice,
          promoEnabled: false,
          promoDiscountPercentage: 0,
          marketplaceFeePercentage: effectiveMarketplaceFeePercentage,
          marketplaceFixedFee: effectiveMarketplaceFixedFee,
        })
      : null;
  const benchmarkChannelCost =
    (benchmarkPracticedScenario?.marketplaceFee ?? 0) +
    (benchmarkPracticedScenario?.marketplaceFixedFeeCost ?? 0) +
    (benchmarkPracticedScenario?.taxCost ?? 0);
  const benchmarkMarketGap =
    form.benchmarkMarketPrice > 0
      ? form.benchmarkMarketPrice - displayedSalePrice
      : null;
  const benchmarkPracticedGap =
    form.benchmarkPracticedPrice > 0
      ? form.benchmarkPracticedPrice - displayedSalePrice
      : null;

  const summaryLines = buildSummaryLines({
    form,
    selectedChannelLabel,
    effectiveMarketplaceFeePercentage,
    effectiveMarketplaceFixedFee,
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

  const businessProfitTone: FinancialTone =
    unitProfit > 0 ? "success" : "danger";
  const resultLabel = unitProfit >= 0 ? "Lucro líquido" : "Prejuízo";
  const activeWorthIt = unitProfit > 0;
  const suggestedGap = displayedSalePrice - activeChannelSuggestedMinimumPrice;
  const saleConditionBadge = getSaleConditionBadge({
    isWorthIt: activeWorthIt,
    healthyMarginTarget,
    marginPercentage: realMarginPercentage,
    suggestedGapValue: suggestedGap,
  });
  const activeDecision = getActiveDecision({
    activeWorthIt,
    healthyMarginTarget,
    marginPercentage: realMarginPercentage,
    suggestedGapValue: suggestedGap,
    selectedChannelLabel,
    formattedSuggestedGap: money(Math.abs(suggestedGap)),
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
  const channelOutflowTotal =
    unitMarketplaceFee + unitMarketplaceFixedFee + unitTaxCost;
  const benchmarkValidation = getBenchmarkValidation({
    benchmarkMarketGap,
    benchmarkPracticedGap,
    benchmarkPracticedScenario,
    healthyMarginTarget,
    money,
  });

  const thirdPartyCostItems: CostLineItem[] = [
    {
      label: "Filamento",
      amount: unitMaterialCost,
      meta: `${materialGrams}g`,
      value: money(unitMaterialCost),
      tone: "danger" as const,
    },
    {
      label: "Energia elétrica",
      amount: unitEnergyCost,
      meta:
        displayedSalePrice > 0
          ? formatPercent((unitEnergyCost / displayedSalePrice) * 100)
          : undefined,
      value: money(unitEnergyCost),
      tone: "danger" as const,
    },
    {
      label: "Embalagem e acabamento",
      amount: unitPackagingCost,
      value: money(unitPackagingCost),
      tone: "danger" as const,
    },
  ].filter((item) => !isZeroValue(item.amount));

  const thirdPartyChannelItems: CostLineItem[] = [
    ...(form.salesChannelId === "shopee"
      ? (() => {
          const shopeeFeeConfig = resolveShopeeFeeConfigForPrice({
            salePrice: displayedSalePrice,
            sellerType: form.shopeeSellerType,
            featuredCampaign: form.shopeeFeaturedCampaign,
          });

          const items: CostLineItem[] = [
            {
              label: "Comissão percentual Shopee",
              amount:
                displayedSalePrice * (shopeeFeeConfig.basePercentage / 100),
              meta: `${formatPercent(shopeeFeeConfig.basePercentage)} sobre o valor vendido`,
              value: money(
                displayedSalePrice * (shopeeFeeConfig.basePercentage / 100),
              ),
              tone: "danger" as const,
            },
            {
              label: "Tarifa fixa por item",
              amount: shopeeFeeConfig.baseFixedFee,
              meta: `Faixa atual: ${shopeeFeeConfig.priceRangeLabel} · cobrada por item vendido`,
              value: money(shopeeFeeConfig.baseFixedFee),
              tone: "danger" as const,
            },
          ];

          if (shopeeFeeConfig.featuredCampaignFee > 0) {
            items.push({
              label: "Campanha de destaque",
              amount:
                displayedSalePrice *
                (shopeeFeeConfig.featuredCampaignFee / 100),
              meta: `${formatPercent(shopeeFeeConfig.featuredCampaignFee)} adicional sobre o valor vendido`,
              value: money(
                displayedSalePrice *
                  (shopeeFeeConfig.featuredCampaignFee / 100),
              ),
              tone: "danger" as const,
            });
          }

          if (shopeeFeeConfig.cpfSellerFee > 0) {
            items.push({
              label: "Taxa vendedor CPF",
              amount: shopeeFeeConfig.cpfSellerFee,
              meta: "Adicional fixo por item vendido no CPF",
              value: money(shopeeFeeConfig.cpfSellerFee),
              tone: "danger" as const,
            });
          }

          return items;
        })()
      : [
          {
            label: feeLabel,
            amount: unitMarketplaceFee,
            meta:
              displayedSalePrice > 0
                ? formatPercent((unitMarketplaceFee / displayedSalePrice) * 100)
                : undefined,
              value: money(unitMarketplaceFee),
              tone: "danger" as const,
            },
            {
              label: "Tarifa fixa marketplace",
              amount: unitMarketplaceFixedFee,
              value: money(unitMarketplaceFixedFee),
              tone: "danger" as const,
            },
        ]),
    {
      label: "Imposto",
      amount: unitTaxCost,
      meta:
        displayedSalePrice > 0
          ? formatPercent((unitTaxCost / displayedSalePrice) * 100)
          : undefined,
      value: money(unitTaxCost),
      tone: "danger" as const,
    },
    {
      label: "Frete",
      amount: unitShippingCost,
      meta:
        displayedSalePrice > 0
          ? formatPercent((unitShippingCost / displayedSalePrice) * 100)
          : undefined,
      value: money(unitShippingCost),
      tone: "danger" as const,
    },
  ].filter((item) => !isZeroValue(item.amount));

  const operationalReserveItems: CostLineItem[] = [
    {
      label: "Manutenção",
      amount: unitMaintenanceCost,
      value: money(unitMaintenanceCost),
      tone: "accent" as const,
    },
    {
      label: "Reserva de perdas",
      amount: unitLossCost,
      meta: `${formatPercent(form.lossPercentage)} sobre a base sujeita a reimpressão`,
      value: money(unitLossCost),
      tone: "accent" as const,
    },
  ].filter((item) => !isZeroValue(item.amount));

  const businessReturnItems: CostLineItem[] = [
    {
      label: "Pró-labore",
      amount: unitLaborCost,
      meta:
        result.laborTimeTotalHours > 0
          ? formatOperationalTime(result.laborTimeTotalHours)
          : undefined,
      value: money(unitLaborCost),
      tone: "success" as const,
    },
    {
      label: "Resultado final",
      amount: unitProfit,
      meta:
        result.laborTimeTotalHours > 0
          ? `${money(profitPerHour)} / hora operacional`
          : undefined,
      value: money(unitProfit),
      tone: businessProfitTone,
    },
  ].filter((item) => !isZeroValue(item.amount));
  const totalCostItems: CostLineItem[] = [
    ...thirdPartyCostItems,
    ...thirdPartyChannelItems,
    ...operationalReserveItems,
    ...businessReturnItems.filter((item) => item.label !== "Resultado final"),
  ];

  return (
    <aside className="xl:sticky xl:top-6">
      <section className="rounded-[32px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.94)] p-5 shadow-[0_20px_60px_rgba(57,37,118,0.08)] sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">
          Painel de decisão
        </p>

        <div className="mt-4 rounded-[28px] border border-[#6c56ff]/20 bg-[var(--panel-soft)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--accent)]">
                {selectedChannelLabel}
              </p>
              <h2 className="mt-2 text-4xl font-semibold tracking-[-0.07em] text-[var(--foreground)]">
                {money(displayedSalePrice)}
              </h2>
              <p className="mt-2 text-sm text-[var(--muted)]">{salePriceLabel}</p>
            </div>

            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-medium ${saleConditionBadge.className}`}
            >
              {saleConditionBadge.label}
            </span>
          </div>

          {form.isKit ? (
            <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-white p-4">
              <SimpleLine label="Itens por kit" value={`${kitQuantity}`} muted />
              <SimpleLine
                label="Valor por item do kit"
                value={perKitItemSalePrice}
                highlight
              />
            </div>
          ) : null}

          {form.promoEnabled && promotionalSalePrice ? (
            <div className="mt-4 rounded-2xl border border-[var(--panel-border)] bg-white p-4">
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

          <div className="mt-5 divide-y divide-[var(--panel-border)] rounded-[22px] border border-[var(--panel-border)] bg-white">
            <KeyMetricRow
              label={resultLabel}
              value={money(unitProfit)}
              helper={form.isKit ? `${perKitItemNetProfit} por item` : undefined}
              tone={businessProfitTone}
            />
            <KeyMetricRow
              label="Margem real"
              value={formatPercent(realMarginPercentage)}
              helper={kitHelperText}
              tone="accent"
            />
            <KeyMetricRow
              label="Custo total neste canal"
              value={money(unitTotalCost)}
              helper="Produção + marketplace + demais custos."
              tone="danger"
            />
            <KeyMetricRow
              label="Preço mínimo sugerido"
              value={money(activeChannelSuggestedMinimumPrice)}
              helper={`Piso sugerido para manter pelo menos ${formatPercent(healthyMarginTarget)} de lucro líquido.`}
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
          <SectionTitle title="Composição do preço" />

          <div className="mt-4 divide-y divide-black/8 rounded-[24px] border border-black/8 bg-white">
            <QuickReadRow
              label="Cliente paga"
              value={money(displayedSalePrice)}
              helper={
                form.isKit ? `${perKitItemSalePrice} por item do kit` : undefined
              }
              tone="success"
            />
            <QuickReadRow
              label="Custo total"
              value={money(unitTotalCost)}
              helper="Tudo que precisa ser coberto neste canal: produção, frete, taxas, pró-labore e proteção operacional."
              tone="danger"
            />
            <QuickReadRow
              label="Pró-labore dentro do custo"
              value={money(unitLaborCost)}
              helper={
                result.laborTimeTotalHours > 0
                  ? `${formatOperationalTime(result.laborTimeTotalHours)} · já incluído no custo total`
                  : "Remuneração do trabalho manual já incluída no custo total."
              }
              tone="success"
            />
            <QuickReadRow
              label={resultLabel}
              value={money(unitProfit)}
              helper={
                result.laborTimeTotalHours > 0
                  ? `${money(profitPerHour)} / hora operacional`
                  : "Resultado final depois de todos os custos."
              }
              tone={businessProfitTone}
            />
          </div>

          <AccordionSection
            title="Detalhamento dos valores"
            description="Abra para ver cada linha que compõe o preço."
            compact
          >
            <div className="grid gap-4">
              <CostGroupCard
                title="Como o custo total foi formado"
                subtitle="Essas linhas já estão dentro do custo total acima. Não são cobranças extras."
                items={totalCostItems}
                totalLabel="Custo total"
                totalValue={money(unitTotalCost)}
                tone="danger"
              />
            </div>
          </AccordionSection>

          <p className="mt-4 text-xs leading-6 text-[#7c6858]">
            Imposto e taxas entram aqui como leitura operacional do canal. A
            ferramenta orienta decisão comercial, mas não substitui apuração
            fiscal ou contábil.
          </p>
        </div>

        <div className="mt-7 border-t border-black/8 pt-6">
          <SectionTitle title="Destinação do lucro" />

          <div className="mt-4 rounded-[24px] border border-black/8 bg-white p-5">
            <SimpleLine
              label="Lucro estimado"
              value={money(unitProfit)}
              tone={businessProfitTone}
            />
            <div className="mt-4 grid gap-3">
              <SimpleLine
                label={`Expansão — ${formatPercent(profitDestinations.expansionPercentage)}`}
                value={money(profitDestinationBreakdown.expansionAmount)}
              />
              <SimpleLine
                label={`Reserva de caixa — ${formatPercent(profitDestinations.cashReservePercentage)}`}
                value={money(profitDestinationBreakdown.cashReserveAmount)}
              />
              <SimpleLine
                label={`Distribuição — ${formatPercent(profitDestinations.ownerDistributionPercentage)}`}
                value={money(profitDestinationBreakdown.ownerDistributionAmount)}
              />
            </div>

            <p className="mt-4 text-xs leading-6 text-[#7c6858]">
              Esta leitura é apenas gerencial e não altera o preço de venda.
              {profitDestinationBreakdown.distributableProfit <= 0
                ? " Como o lucro estimado está zerado ou negativo, não há valor positivo para distribuir."
                : ""}
            </p>

            {!profitDestinationBreakdown.isValid ? (
              <p className="mt-2 text-xs text-[#c1372b]">
                {profitDestinationBreakdown.errorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-7 border-t border-black/8 pt-6">
          <AccordionSection
            title="Memória do cálculo"
            description="Abra só quando quiser auditar a fórmula detalhada."
            compact
          >
            <div className="grid gap-4">
              <FormulaCard
                title="1. Custo protegido de produção"
                subtitle="Tudo que precisa ser coberto antes de falar em lucro."
                totalLabel="Subtotal protegido"
                totalValue={money(unitProductionCost)}
                tone="danger"
                expression={`Filamento + energia + manutenção + embalagem + frete + pró-labore + perdas = ${money(unitProductionCost)}`}
              >
                <SimpleLine label="Filamento" value={money(unitMaterialCost)} />
                <SimpleLine label="Energia" value={money(unitEnergyCost)} />
                <SimpleLine label="Manutenção" value={money(unitMaintenanceCost)} />
                <SimpleLine label="Embalagem" value={money(unitPackagingCost)} />
                <SimpleLine label="Frete" value={money(unitShippingCost)} />
                <SimpleLine label="Pró-labore" value={money(unitLaborCost)} />
                <SimpleLine
                  label="Reserva de perdas"
                  value={money(unitLossCost)}
                />
              </FormulaCard>

              <FormulaCard
                title="2. Saídas do canal e do fisco"
                subtitle="Quanto o canal e o imposto retiram da venda."
                totalLabel="Subtotal de saídas"
                totalValue={money(channelOutflowTotal)}
                tone="danger"
                expression={`Taxas variáveis ${formatPercent(result.variableFeesPercentage)} + tarifa fixa ${money(unitMarketplaceFixedFee)} = ${money(channelOutflowTotal)}`}
              >
                <SimpleLine label={feeLabel} value={money(unitMarketplaceFee)} />
                <SimpleLine
                  label="Tarifa fixa"
                  value={money(unitMarketplaceFixedFee)}
                />
                <SimpleLine label="Imposto" value={money(unitTaxCost)} />
              </FormulaCard>

              <FormulaCard
                title="3. Regra do preço"
                subtitle={
                  form.pricingMode === "margin"
                    ? "O preço sugerido já segura a margem líquida alvo depois de custos, canal e imposto."
                    : "No preço manual, a ferramenta mede o que sobra de verdade depois das saídas."
                }
                totalLabel={
                  form.pricingMode === "margin"
                    ? "Preço sugerido"
                    : "Preço analisado"
                }
                totalValue={money(displayedSalePrice)}
                tone="success"
                expression={
                  form.pricingMode === "margin"
                    ? `(${money(unitProductionCost)} + ${money(unitMarketplaceFixedFee)}) ÷ (1 - ${formatPercent(result.variableFeesPercentage)} - ${formatPercent(result.desiredMarginPercentage)}) = ${money(displayedSalePrice)}`
                    : `${money(displayedSalePrice)} - ${money(unitProductionCost)} - ${money(channelOutflowTotal)} = ${money(unitProfit)}`
                }
              >
                <SimpleLine
                  label="Margem alvo"
                  value={formatPercent(result.desiredMarginPercentage)}
                />
                <SimpleLine
                  label="Margem saudável"
                  value={formatPercent(healthyMarginTarget)}
                />
                <SimpleLine
                  label="Lucro empresarial estimado"
                  value={money(unitProfit)}
                  tone={businessProfitTone}
                />
              </FormulaCard>
            </div>
          </AccordionSection>
        </div>

        {(form.benchmarkPracticedPrice > 0 || form.benchmarkMarketPrice > 0) ? (
          <div className="mt-7 border-t border-black/8 pt-6">
            <SectionTitle title="Benchmark comercial" />

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Preço sugerido"
                value={money(displayedSalePrice)}
                helper="Valor que respeita a política atual."
                tone="success"
              />
              {form.benchmarkPracticedPrice > 0 ? (
                <SummaryCard
                  label="Preço praticado"
                  value={money(form.benchmarkPracticedPrice)}
                  helper={
                    benchmarkPracticedGap === null
                      ? undefined
                      : `${money(Math.abs(benchmarkPracticedGap))} ${
                          benchmarkPracticedGap >= 0 ? "acima" : "abaixo"
                        } do sugerido`
                  }
                  tone={benchmarkPracticedGap !== null && benchmarkPracticedGap >= 0 ? "success" : "danger"}
                />
              ) : null}
              {form.benchmarkMarketPrice > 0 ? (
                <SummaryCard
                  label="Preço de mercado"
                  value={money(form.benchmarkMarketPrice)}
                  helper={
                    benchmarkMarketGap === null
                      ? undefined
                      : `${money(Math.abs(benchmarkMarketGap))} ${
                          benchmarkMarketGap >= 0 ? "acima" : "abaixo"
                        } do sugerido`
                  }
                  tone={benchmarkMarketGap !== null && benchmarkMarketGap >= 0 ? "success" : "accent"}
                />
              ) : null}
              {benchmarkPracticedScenario ? (
                <SummaryCard
                  label="Lucro no praticado"
                  value={money(benchmarkPracticedScenario.netProfit)}
                  helper={formatPercent(
                    calculateProfitMargin(
                      form.benchmarkPracticedPrice,
                      benchmarkPracticedScenario.costWithLoss +
                        benchmarkChannelCost,
                    ),
                  )}
                  tone={benchmarkPracticedScenario.netProfit > 0 ? "success" : "danger"}
                />
              ) : null}
            </div>

            <RecommendationBanner
              className="mt-4"
              tone={benchmarkValidation.tone}
              title={benchmarkValidation.title}
              message={benchmarkValidation.message}
            />
          </div>
        ) : null}

        <div className="mt-7 border-t border-black/8 pt-6">
          <AccordionSection
            title="Outros cenários"
            description="Abra para comparar formatos alternativos de venda."
            defaultOpen={false}
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
                    tone="success"
                  />
                  <SummaryCard
                    label={form.isKit ? "Custo total do kit" : "Custo total"}
                    value={money(directSale.costTotal)}
                    helper={form.isKit ? `${perKitItemCost} por item` : undefined}
                    tone="danger"
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
                    <p className="text-sm font-semibold text-[#18120d]">
                      Comissão do ponto de venda
                    </p>
                    <p className="mt-1 text-xs text-[#7c6858]">
                      Ajuste quanto a loja fica em cada venda.
                    </p>
                  </div>

                  <strong className="text-2xl font-semibold tracking-[-0.04em] text-[#d84f00]">
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
                  className="mt-5 w-full accent-[#ff6a00]"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  {[25, 30].map((percentage) => (
                    <button
                      key={percentage}
                      type="button"
                      onClick={() =>
                        onFieldChange("consignmentCommissionPercentage", percentage)
                      }
                      className={`rounded-full border px-3 py-2 text-sm transition ${
                        form.consignmentCommissionPercentage === percentage
                          ? "border-[#ff6a00] bg-[#ff6a00] text-white"
                          : "border-black/8 text-[#18120d] hover:border-black/12 hover:bg-black/[0.03]"
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
                    tone="success"
                  />
                  <SummaryCard
                    label="Loja fica com"
                    value={money(consignment.storeCommissionValue)}
                    helper={formatPercent(consignment.storeCommissionPercentage)}
                    tone="danger"
                  />
                  <SummaryCard
                    label="Volta para você"
                    value={money(consignment.amountReturnedToYou)}
                    tone="success"
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
                    tone="danger"
                  />
                  <SummaryCard
                    label={
                      form.isKit
                        ? "Preço mínimo sugerido do kit"
                        : "Preço mínimo sugerido"
                    }
                    value={money(wholesale.safeMinimumPrice)}
                    helper="Base mínima recomendada para lojistas."
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {wholesale.tiers.map((tier) => (
                    <div
                      key={tier.units}
                      className="rounded-[20px] border border-black/8 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[#18120d]">
                            {tier.label}
                          </p>
                          <p className="mt-1 text-xs text-[#7c6858]">
                            Multiplicador{" "}
                            {tier.multiplier.toFixed(1).replace(".", ",")}x
                          </p>
                        </div>

                        <strong className="text-lg font-semibold tracking-[-0.04em] text-[#d84f00]">
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
                          tone={tier.totalProfit > 0 ? "success" : "danger"}
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

        <div className="mt-7 border-t border-black/8 pt-6">
          <AccordionSection
            title="Produção e contexto"
            description="Abra para ver produtividade, horizonte mensal e configuração ativa."
            defaultOpen={false}
          >
            <div className="rounded-[24px] border border-black/8 bg-white p-5">
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

              <div className="mt-5 border-t border-black/8 pt-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
                  Configuração ativa
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {summaryLines.map((line) => (
                    <SimpleBlock key={line.label} label={line.label} value={line.value} />
                  ))}
                </div>
              </div>
            </div>
          </AccordionSection>
        </div>

        <button
          type="button"
          onClick={onSave}
          className="mt-7 w-full rounded-2xl bg-[#ff6a00] px-4 py-4 text-base font-semibold text-white transition hover:brightness-110"
        >
          {saveButtonLabel}
        </button>
      </section>
    </aside>
  );
}

function formatOperationalTime(totalHours: number) {
  const totalMinutes = Math.round(totalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min de trabalho manual`;
  }

  if (hours > 0) {
    return `${hours}h de trabalho manual`;
  }

  return `${minutes}min de trabalho manual`;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
      {title}
    </p>
  );
}

function KeyMetricRow({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: FinancialTone;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        {helper ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{helper}</p>
        ) : null}
      </div>

      <strong
        className={`text-right text-lg font-semibold tracking-[-0.04em] ${financialToneTextClassName[tone]}`}
      >
        {value}
      </strong>
    </div>
  );
}

function QuickReadRow({
  label,
  value,
  helper,
  tone = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: FinancialTone;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4">
      <div className="min-w-0">
        <p className="text-sm text-[var(--foreground)]">{label}</p>
        {helper ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{helper}</p>
        ) : null}
      </div>
      <strong
        className={`text-right text-base font-semibold tracking-[-0.03em] ${financialToneTextClassName[tone]}`}
      >
        {value}
      </strong>
    </div>
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
  tone?: FinancialTone;
}) {
  return (
    <div
      className={`rounded-[16px] border bg-white p-4 ${financialToneBorderClassName[tone]} ${financialToneTextClassName[tone]}`}
    >
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
    good: "border-[var(--panel-border)] bg-white text-[var(--foreground)]",
    warning:
      "border-[var(--accent)] bg-[var(--panel-soft)] text-[var(--foreground)]",
    danger:
      "border-[#c1372b] bg-[#fff1f1] text-[#7f1d1d]",
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
      className={`group overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-white ${
        compact ? "" : "shadow-[0_10px_28px_rgba(57,37,118,0.08)]"
      }`}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 marker:content-none">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
          {description ? (
            <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
          ) : null}
        </div>

        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--accent)] text-sm text-white transition-transform duration-200 group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="border-t border-[var(--panel-border)] px-5 py-5">{children}</div>
    </details>
  );
}

function CostGroupCard({
  title,
  subtitle,
  expression,
  items,
  totalLabel,
  totalValue,
  tone = "default",
}: {
  title: string;
  subtitle: string;
  expression?: string;
  items: CostLineItem[];
  totalLabel: string;
  totalValue: string;
  tone?: FinancialTone;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--panel-border)] bg-white p-5">
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p>
        {expression ? (
          <p className="mt-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-3 text-xs leading-6 text-[var(--muted)]">
            {expression}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-1">
        {items.length > 0 ? (
          items.map((item) => (
            <CostLine
              key={item.label}
              label={item.label}
              value={item.value}
              meta={item.meta}
              tone={item.tone ?? tone}
            />
          ))
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--panel-border)] px-4 py-4 text-sm text-[var(--muted)]">
            Nenhum custo relevante registrado aqui para o cenário atual.
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-[var(--panel-border)] pt-4">
        <SimpleLine label={totalLabel} value={totalValue} tone={tone} />
      </div>
    </div>
  );
}

function CostLine({
  label,
  value,
  meta,
  tone = "default",
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: FinancialTone;
}) {
  const signal = {
    default: "",
    accent: "",
    success: "+ ",
    danger: "- ",
  }[tone];

  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--panel-border)] py-4 last:border-b-0">
      <div>
        <p className="text-sm text-[var(--foreground)]">{label}</p>
        {meta ? <p className="mt-1 text-xs text-[var(--muted)]">{meta}</p> : null}
      </div>

      <span
        className={`font-mono text-sm ${financialToneTextClassName[tone]}`}
      >
        {signal}
        {value}
      </span>
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
    <div className="rounded-[24px] border border-[var(--panel-border)] bg-white p-5">
      <div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
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
        <p className="text-sm text-[var(--foreground)]">{label}</p>

        {muted ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{muted}</p>
        ) : null}
      </div>

      <strong
        className={`text-right text-xl font-semibold tracking-[-0.04em] ${
          highlight ? "text-[var(--accent)]" : "text-[var(--foreground)]"
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
  tone,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
  tone?: FinancialTone;
}) {
  const valueClassName = tone
    ? financialToneTextClassName[tone]
    : highlight
      ? "text-[var(--accent)]"
      : muted
        ? "text-[var(--muted)]"
        : "text-[var(--foreground)]";

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--foreground)]">{label}</span>

      <strong className={`font-mono text-sm ${valueClassName}`}>
        {value}
      </strong>
    </div>
  );
}

function SimpleBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-white p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        {label}
      </p>
      <strong className="mt-2 block text-sm font-semibold text-[var(--foreground)]">
        {value}
      </strong>
    </div>
  );
}

function buildSummaryLines({
  form,
  selectedChannelLabel,
  effectiveMarketplaceFeePercentage,
  effectiveMarketplaceFixedFee,
  mercadoLivrePredictedCategoryName,
  displayCurrency,
  exchangeRates,
}: {
  form: PricingFormState;
  selectedChannelLabel: string;
  effectiveMarketplaceFeePercentage: number;
  effectiveMarketplaceFixedFee: number;
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
          : `Lucro alvo ${formatPercent(form.profitMarginPercentage)}`,
    },
    {
      label: "Promoção",
      value: form.promoEnabled
        ? `${formatPercent(form.promoDiscountPercentage)} ativa`
        : "Desligada",
    },
    {
      label: "Margem saudável",
      value: formatPercent(form.healthyMarginTargetPercentage),
    },
    {
      label: "Perdas",
      value: formatPercent(form.lossPercentage),
      numericValue: form.lossPercentage,
      hideWhenZero: true,
    },
    {
      label: "MO sujeita a falha",
      value: formatPercent(form.lossLaborSharePercentage),
      numericValue: form.lossLaborSharePercentage,
      hideWhenZero: true,
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
        label: "Taxa paga a Shopee",
        value: formatPercent(effectiveMarketplaceFeePercentage),
        numericValue: effectiveMarketplaceFeePercentage,
      },
      {
        label: "Taxa fixa por item",
        value: formatCurrency(
          convertFromBRL(
            effectiveMarketplaceFixedFee,
            displayCurrency,
            exchangeRates,
          ),
          displayCurrency,
        ),
        numericValue: effectiveMarketplaceFixedFee,
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

function getSaleConditionBadge({
  isWorthIt,
  healthyMarginTarget,
  marginPercentage,
  suggestedGapValue,
}: {
  isWorthIt: boolean;
  healthyMarginTarget: number;
  marginPercentage: number;
  suggestedGapValue: number;
}) {
  if (!isWorthIt || suggestedGapValue < 0) {
    return {
      label: "Ruim",
      className:
        "border-[#c85600] bg-[#c85600] text-white",
    };
  }

  if (marginPercentage >= healthyMarginTarget + 10) {
    return {
      label: "Excelente",
      className: "border-[#2f7d32] bg-[#2f7d32] text-white",
    };
  }

  if (marginPercentage < healthyMarginTarget) {
    return {
      label: "Ajustar",
      className: "border-[var(--accent)] bg-[var(--accent)] text-white",
    };
  }

  return {
    label: "Boa",
    className:
      "border-[var(--accent)] bg-[var(--accent)] text-white",
  };
}

function getActiveDecision({
  activeWorthIt,
  healthyMarginTarget,
  marginPercentage,
  suggestedGapValue,
  selectedChannelLabel,
  formattedSuggestedGap,
}: {
  activeWorthIt: boolean;
  healthyMarginTarget: number;
  marginPercentage: number;
  suggestedGapValue: number;
  selectedChannelLabel: string;
  formattedSuggestedGap: string;
}) {
  if (!activeWorthIt) {
    return {
      tone: "danger" as const,
      title: "Venda inviável",
      message: `No canal ${selectedChannelLabel}, o valor atual já entrou em lucro negativo. Revise preço, custos ou taxas antes de vender.`,
    };
  }

  if (suggestedGapValue < 0) {
    return {
      tone: "warning" as const,
      title: "Venda boa, mas abaixo do sugerido",
      message: `No canal ${selectedChannelLabel}, o preço atual ainda dá lucro, mas está ${formattedSuggestedGap} abaixo do mínimo sugerido para preservar ${formatPercent(healthyMarginTarget)} de lucro líquido.`,
    };
  }

  if (marginPercentage < healthyMarginTarget) {
    return {
      tone: "warning" as const,
      title: "Venda viável, mas com margem curta",
      message: `Você está acima do piso sugerido, mas ainda abaixo da margem saudável de ${formatPercent(healthyMarginTarget)} definida para a operação.`,
    };
  }

  if (marginPercentage < healthyMarginTarget + 10) {
    return {
      tone: "good" as const,
      title: "Venda viável",
      message: `Você está ${formattedSuggestedGap} acima do mínimo sugerido neste canal, com lucro líquido positivo e folga operacional.`,
    };
  }

  return {
    tone: "good" as const,
    title: "Venda excelente",
    message: `Você está ${formattedSuggestedGap} acima do mínimo sugerido neste canal, com margem confortável para operar.`,
  };
}

function isZeroValue(value?: number) {
  return value === undefined || Math.abs(value) < 0.0001;
}

function FormulaCard({
  title,
  subtitle,
  expression,
  children,
  totalLabel,
  totalValue,
  tone = "default",
}: {
  title: string;
  subtitle: string;
  expression: string;
  children: React.ReactNode;
  totalLabel: string;
  totalValue: string;
  tone?: FinancialTone;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--panel-border)] bg-white p-5">
      <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p>
      <p className="mt-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-3 text-xs leading-6 text-[var(--muted)]">
        {expression}
      </p>
      <div className="mt-4 space-y-3">{children}</div>
      <div className="mt-4 border-t border-[var(--panel-border)] pt-4">
        <SimpleLine label={totalLabel} value={totalValue} tone={tone} />
      </div>
    </div>
  );
}

function getBenchmarkValidation({
  benchmarkMarketGap,
  benchmarkPracticedGap,
  benchmarkPracticedScenario,
  healthyMarginTarget,
  money,
}: {
  benchmarkMarketGap: number | null;
  benchmarkPracticedGap: number | null;
  benchmarkPracticedScenario: Calculate3DPriceResult | null;
  healthyMarginTarget: number;
  money: (value: number) => string;
}) {
  if (benchmarkPracticedScenario && benchmarkPracticedScenario.netProfit <= 0) {
    return {
      tone: "danger" as const,
      title: "Preço praticado em risco",
      message:
        "No preço praticado atual, a operação perde dinheiro depois de custos, canal e imposto.",
    };
  }

  if (benchmarkPracticedGap !== null && benchmarkPracticedGap < 0) {
    return {
      tone: "warning" as const,
      title: "Preço praticado abaixo da política",
      message: `O preço atual está ${money(
        Math.abs(benchmarkPracticedGap),
      )} abaixo do sugerido para segurar a política de ${formatPercent(
        healthyMarginTarget,
      )} de margem saudável.`,
    };
  }

  if (benchmarkMarketGap !== null && benchmarkMarketGap < 0) {
    return {
      tone: "warning" as const,
      title: "Mercado abaixo da sua política",
      message:
        "A referência observada no mercado ficou abaixo do preço sugerido. Revise posicionamento, eficiência ou premissas antes de escalar essa regra.",
    };
  }

  return {
    tone: "good" as const,
    title: "Benchmark coerente",
    message:
      "Os preços de referência não conflitam com a política atual. Use esse comparativo para validar mais produtos antes de comercializar o sistema.",
  };
}
