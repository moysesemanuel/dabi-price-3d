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
    materialGrams,
    parsedPromoDiscount,
    profitPerHour,
    promotionalSalePrice,
    realMarginPercentage,
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
  const consignment = calculateConsignment({
    customerPrice: displayedSalePrice,
    costTotal: unitCoreCost,
    commissionPercentage: form.consignmentCommissionPercentage,
  });
  const wholesale = calculateWholesale({
    costTotal: unitCoreCost,
  });
  const wholesaleBaseTier = wholesale.tiers[0] ?? {
    units: 10,
    label: "10 unidades",
    multiplier: 2.1,
    unitPrice: wholesale.safeMinimumPrice,
    totalPrice: wholesale.safeMinimumPrice * 10,
    unitProfit: wholesale.safeMinimumPrice - wholesale.costTotal,
    totalProfit:
      (wholesale.safeMinimumPrice - wholesale.costTotal) * 10,
    isCloseToCost: true,
  };

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
      ? "Preço sugerido"
      : "Preço de venda";

  return (
    <aside className="xl:sticky xl:top-6">
      <section className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.22)] sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
          Detalhamento
        </p>

        <div className="mt-6 rounded-[22px] border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[var(--accent)]">
                {salePriceLabel}
              </p>

              <p className="mt-2 text-xs text-[var(--muted)]">
                {selectedChannelLabel}
              </p>
            </div>

            <strong className="text-right text-3xl font-semibold tracking-[-0.04em] text-[var(--accent)]">
              {formatCurrency(
                convertFromBRL(displayedSalePrice, displayCurrency, exchangeRates),
                displayCurrency,
              )}
            </strong>
          </div>

          {form.promoEnabled && promotionalSalePrice ? (
            <div className="mt-5 rounded-2xl border border-[var(--accent)]/20 bg-black/10 p-4">
              <SimpleLine
                label="Preço original"
                value={formatCurrency(
                  convertFromBRL(baseSalePrice, displayCurrency, exchangeRates),
                  displayCurrency,
                )}
              />

              <SimpleLine
                label="Desconto aplicado"
                value={`${formatPercent(parsedPromoDiscount)}`}
                muted
              />

              <SimpleLine
                label="Preço promocional"
                value={formatCurrency(
                  convertFromBRL(
                    promotionalSalePrice,
                    displayCurrency,
                    exchangeRates,
                  ),
                  displayCurrency,
                )}
                highlight
              />
            </div>
          ) : null}
        </div>

        <div className="mt-7">
          <SectionTitle title="Resumo financeiro" />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label="Quanto o cliente paga"
              value={formatCurrency(
                convertFromBRL(directSale.customerPrice, displayCurrency, exchangeRates),
                displayCurrency,
              )}
              tone="accent"
            />
            <SummaryCard
              label="Quanto custa para produzir"
              value={formatCurrency(
                convertFromBRL(directSale.costTotal, displayCurrency, exchangeRates),
                displayCurrency,
              )}
            />
            <SummaryCard
              label="Seu lucro bruto"
              value={formatCurrency(
                convertFromBRL(directSale.grossProfit, displayCurrency, exchangeRates),
                displayCurrency,
              )}
              tone="success"
            />
            <SummaryCard
              label="Margem de lucro"
              value={formatPercent(directSale.marginPercentage)}
            />
            <SummaryCard
              label="Preço mínimo seguro"
              value={formatCurrency(
                convertFromBRL(
                  directSale.safeMinimumPrice,
                  displayCurrency,
                  exchangeRates,
                ),
                displayCurrency,
              )}
              helper="Piso recomendado para não apertar sua margem."
            />
            <SummaryCard
              label="Vale a pena?"
              value={directSale.isWorthIt ? "Sim" : "Não"}
              tone={directSale.isWorthIt ? "success" : "danger"}
              helper={
                directSale.isWorthIt
                  ? "Venda direta saudável com o preço atual."
                  : "O preço atual não cobre seus custos."
              }
            />
          </div>
        </div>

        <div className="mt-7">
          <SectionTitle title="Custos e descontos" />

          <div className="mt-3 space-y-1">
            {unitMarketplaceFee > 0 ? (
              <ResultLine
                label={feeLabel}
                meta={formatPercent(
                  displayedSalePrice > 0
                    ? (unitMarketplaceFee / displayedSalePrice) * 100
                    : 0
                )}
                value={convertFromBRL(
                  unitMarketplaceFee,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitMarketplaceFixedFee > 0 ? (
              <ResultLine
                label="Tarifa fixa marketplace"
                value={convertFromBRL(
                  unitMarketplaceFixedFee,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitTaxCost > 0 ? (
              <ResultLine
                label="Imposto"
                meta={formatPercent(
                  displayedSalePrice > 0
                    ? (unitTaxCost / displayedSalePrice) * 100
                    : 0
                )}
                value={convertFromBRL(
                  unitTaxCost,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitEnergyCost > 0 ? (
              <ResultLine
                label="Energia elétrica"
                meta={formatPercent(
                  displayedSalePrice > 0
                    ? (unitEnergyCost / displayedSalePrice) * 100
                    : 0
                )}
                value={convertFromBRL(
                  unitEnergyCost,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitMaterialCost > 0 ? (
              <ResultLine
                label="Filamento"
                meta={`${materialGrams}g`}
                value={convertFromBRL(
                  unitMaterialCost,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitPackagingCost > 0 ? (
              <ResultLine
                label="Embalagem e acabamento"
                value={convertFromBRL(
                  unitPackagingCost,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitMaintenanceCost > 0 ? (
              <ResultLine
                label="Manutenção e extras"
                value={convertFromBRL(
                  unitMaintenanceCost,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitLaborCost > 0 ? (
              <ResultLine
                label="Mão de obra"
                value={convertFromBRL(
                  unitLaborCost,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitShippingCost > 0 ? (
              <ResultLine
                label="Frete"
                meta={formatPercent(
                  displayedSalePrice > 0
                    ? (unitShippingCost / displayedSalePrice) * 100
                    : 0
                )}
                value={convertFromBRL(
                  unitShippingCost,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}

            {unitLossCost > 0 ? (
              <ResultLine
                label="Reserva de perdas"
                value={convertFromBRL(
                  unitLossCost,
                  displayCurrency,
                  exchangeRates,
                )}
                currency={displayCurrency}
                negative
              />
            ) : null}
          </div>
        </div>

        <div className="mt-6 border-t border-white/8 pt-5">
          <ResultLine
            label="Total neste canal"
            meta="Custos do produto + taxas do canal ativo"
            value={convertFromBRL(unitTotalCost, displayCurrency, exchangeRates)}
            currency={displayCurrency}
            negative
            strong
          />
        </div>

        <div className="mt-7 rounded-[24px] border border-[var(--accent)]/35 bg-[#0f1c33] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="flex items-center gap-2.5">
            <span className="text-[28px] leading-none text-[var(--accent)]">↗</span>
            <p className="text-[14px] font-semibold tracking-[-0.03em] text-[var(--accent)]">
              Lucro no canal ativo
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-3">
            <strong className="min-w-0 text-2xl font-semibold leading-[0.92] tracking-[-0.07em] text-[var(--accent)]">
              {formatCurrency(
                convertFromBRL(unitProfit, displayCurrency, exchangeRates),
                displayCurrency,
              )}
            </strong>

            <div className="ml-auto flex shrink-0 items-baseline gap-2">
              <span className="text-sm font-semibold tracking-[-0.04em] text-[var(--accent)]">
                {formatPercent(realMarginPercentage)}
              </span>

              <span
                className={`inline-flex rounded-full border px-3 py-1.5 text-[12px] font-medium ${marginBadge.className}`}
              >
                {marginBadge.label}
              </span>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2.5 text-[14px] text-[#9fa7bc]">
            <span className="text-[18px] leading-none">◷</span>
            <span>
              {formatCurrency(
                convertFromBRL(profitPerHour, displayCurrency, exchangeRates),
                displayCurrency,
              )}
              /hora
            </span>
          </div>
        </div>

        <div className="mt-7 border-t border-white/8 pt-6">
          <SectionTitle title="Consignado" />

          <div className="mt-4 rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-5">
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
                label="Quanto o cliente paga"
                value={formatCurrency(
                  convertFromBRL(
                    consignment.customerPrice,
                    displayCurrency,
                    exchangeRates,
                  ),
                  displayCurrency,
                )}
              />
              <SummaryCard
                label="Quanto a loja fica"
                value={formatCurrency(
                  convertFromBRL(
                    consignment.storeCommissionValue,
                    displayCurrency,
                    exchangeRates,
                  ),
                  displayCurrency,
                )}
                helper={formatPercent(consignment.storeCommissionPercentage)}
              />
              <SummaryCard
                label="Quanto volta para você"
                value={formatCurrency(
                  convertFromBRL(
                    consignment.amountReturnedToYou,
                    displayCurrency,
                    exchangeRates,
                  ),
                  displayCurrency,
                )}
                tone="accent"
              />
              <SummaryCard
                label="Seu lucro final"
                value={formatCurrency(
                  convertFromBRL(
                    consignment.grossProfit,
                    displayCurrency,
                    exchangeRates,
                  ),
                  displayCurrency,
                )}
                tone={consignment.isWorthIt ? "success" : "danger"}
              />
            </div>

            <RecommendationBanner
              className="mt-5"
              tone={consignment.tone}
              title={consignment.isWorthIt ? "Vale a pena?" : "Atenção"}
              message={consignment.recommendation}
            />
          </div>
        </div>

        <div className="mt-7 border-t border-white/8 pt-6">
          <SectionTitle title="Revenda / atacado" />

          <div className="mt-4 rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryCard
                label="Custo total do produto"
                value={formatCurrency(
                  convertFromBRL(wholesale.costTotal, displayCurrency, exchangeRates),
                  displayCurrency,
                )}
              />
              <SummaryCard
                label="Preço mínimo seguro"
                value={formatCurrency(
                  convertFromBRL(
                    wholesale.safeMinimumPrice,
                    displayCurrency,
                    exchangeRates,
                  ),
                  displayCurrency,
                )}
                helper="Base mínima recomendada para lojistas."
              />
            </div>

            <div className="mt-5 space-y-3">
              {wholesale.tiers.map((tier) => (
                <div
                  key={tier.units}
                  className="rounded-[20px] border border-white/8 bg-black/10 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {tier.label}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Multiplicador {tier.multiplier.toFixed(1).replace(".", ",")}x
                      </p>
                    </div>

                    <strong className="text-xl font-semibold tracking-[-0.04em] text-[var(--accent)]">
                      {formatCurrency(
                        convertFromBRL(tier.unitPrice, displayCurrency, exchangeRates),
                        displayCurrency,
                      )}{" "}
                      / un.
                    </strong>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <SummaryCard
                      label="Preço por unidade"
                      value={formatCurrency(
                        convertFromBRL(
                          tier.unitPrice,
                          displayCurrency,
                          exchangeRates,
                        ),
                        displayCurrency,
                      )}
                    />
                    <SummaryCard
                      label="Lucro por unidade"
                      value={formatCurrency(
                        convertFromBRL(
                          tier.unitProfit,
                          displayCurrency,
                          exchangeRates,
                        ),
                        displayCurrency,
                      )}
                      tone={tier.unitProfit > 0 ? "success" : "danger"}
                    />
                    <SummaryCard
                      label="Lucro total estimado"
                      value={formatCurrency(
                        convertFromBRL(
                          tier.totalProfit,
                          displayCurrency,
                          exchangeRates,
                        ),
                        displayCurrency,
                      )}
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
          </div>
        </div>

        <div className="mt-7 border-t border-white/8 pt-6">
          <SectionTitle title="Capacidade produtiva" />

          <div className="mt-5 space-y-4">
            <MetricLine
              label="Produto"
              value={productName || "Sem nome"}
              muted={
                result.quantity > 1
                  ? `${result.quantity} unidade(s) por ciclo`
                  : "1 unidade por ciclo"
              }
            />

            <MetricLine
              label="Tempo total"
              value={`${result.printTimeTotalHours
                .toFixed(2)
                .replace(".", ",")}h`}
              muted={
                result.quantity > 1
                  ? [
                      form.dividePrintTimeByPieces
                        ? "tempo digitado do ciclo"
                        : "tempo digitado por peça",
                      form.divideFilamentByPieces
                        ? "filamento digitado do ciclo"
                        : "filamento digitado por peça",
                    ].join(" · ")
                  : "Base de energia e produtividade"
              }
            />

            {result.quantity > 1 ? (
              <MetricLine
                label="Lucro por ciclo"
                value={formatCurrency(
                  convertFromBRL(lotProfit, displayCurrency, exchangeRates),
                  displayCurrency,
                )}
                muted={`${result.quantity} unidade(s) produzidas por ciclo`}
              />
            ) : null}

            <MetricLine
              label="Lucro diário estimado (20h)"
              value={formatCurrency(
                convertFromBRL(
                  estimatedDailyProfit,
                  displayCurrency,
                  exchangeRates,
                ),
                displayCurrency,
              )}
              muted={
                result.quantity > 1
                  ? `${formatDecimal(lotsPerDay)} ciclo(s)/dia · ${Math.round(
                      unitsPerDay,
                    )} un/dia`
                  : undefined
              }
            />

            <MetricLine
              label="Lucro mensal estimado (30d)"
              value={formatCurrency(
                convertFromBRL(
                  estimatedMonthlyProfit,
                  displayCurrency,
                  exchangeRates,
                ),
                displayCurrency,
              )}
              muted={
                result.quantity > 1
                  ? `${formatDecimal(lotsPerMonth)} ciclo(s)/mês · ${Math.round(
                      unitsPerMonth,
                    )} un/mês`
                  : undefined
              }
              highlight
            />
          </div>
        </div>

        <div className="mt-7 border-t border-white/8 pt-6">
          <SectionTitle title="Configuração ativa" />

          <div className="mt-4 rounded-[22px] border border-white/8 bg-[var(--panel-soft)] p-5">
            <div className="space-y-3">
              {summaryLines.map((line) => (
                <SimpleLine key={line.label} label={line.label} value={line.value} />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-7 border-t border-white/8 pt-6">
          <SectionTitle title="Comparação dos modelos" />

          <div className="mt-4 overflow-hidden rounded-[22px] border border-white/8">
            <div className="overflow-x-auto">
              <table className="min-w-full bg-[var(--panel-soft)]">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <ComparisonHeader>Modelo</ComparisonHeader>
                    <ComparisonHeader>Preço cobrado</ComparisonHeader>
                    <ComparisonHeader>Comissão / desconto</ComparisonHeader>
                    <ComparisonHeader>Quanto fica com você</ComparisonHeader>
                    <ComparisonHeader>Custo</ComparisonHeader>
                    <ComparisonHeader>Lucro final</ComparisonHeader>
                  </tr>
                </thead>

                <tbody>
                  <ComparisonRow
                    label="Venda direta"
                    price={directSale.customerPrice}
                    commissionOrDiscount={0}
                    amountReturned={directSale.amountReturnedToYou}
                    cost={directSale.costTotal}
                    profit={directSale.grossProfit}
                    displayCurrency={displayCurrency}
                    exchangeRates={exchangeRates}
                  />
                  <ComparisonRow
                    label="Consignado"
                    price={consignment.customerPrice}
                    commissionOrDiscount={consignment.storeCommissionValue}
                    amountReturned={consignment.amountReturnedToYou}
                    cost={consignment.costTotal}
                    profit={consignment.grossProfit}
                    displayCurrency={displayCurrency}
                    exchangeRates={exchangeRates}
                  />
                  <ComparisonRow
                    label="Revenda (10 un.)"
                    price={wholesaleBaseTier.unitPrice}
                    commissionOrDiscount={Math.max(
                      directSale.customerPrice - wholesaleBaseTier.unitPrice,
                      0,
                    )}
                    amountReturned={wholesaleBaseTier.unitPrice}
                    cost={wholesale.costTotal}
                    profit={wholesaleBaseTier.unitProfit}
                    displayCurrency={displayCurrency}
                    exchangeRates={exchangeRates}
                  />
                </tbody>
              </table>
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

function ResultLine({
  label,
  meta,
  value,
  currency,
  negative = false,
  strong = false,
}: {
  label: string;
  meta?: string;
  value: number;
  currency: DisplayCurrency;
  negative?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 py-4 last:border-b-0">
      <div>
        <p
          className={`text-sm ${
            strong ? "font-semibold text-white" : "text-[#d6d9e8]"
          }`}
        >
          {label}
        </p>

        {meta ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{meta}</p>
        ) : null}
      </div>

      <span
        className={`font-mono text-sm ${
          strong
            ? "font-semibold text-white"
            : negative
              ? "text-[#dc2828]"
              : "text-[var(--accent)]"
        }`}
      >
        {negative ? "- " : ""}
        {formatCurrency(value, currency)}
      </span>
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
  danger = false,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
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
            : danger
              ? "text-[#dc2828]"
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
    accent: "border-[var(--accent)]/25 bg-[var(--accent-soft)] text-[var(--accent)]",
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
  tone: "good" | "warning" | "danger";
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

function ComparisonHeader({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
      {children}
    </th>
  );
}

function ComparisonRow({
  label,
  price,
  commissionOrDiscount,
  amountReturned,
  cost,
  profit,
  displayCurrency,
  exchangeRates,
}: {
  label: string;
  price: number;
  commissionOrDiscount: number;
  amountReturned: number;
  cost: number;
  profit: number;
  displayCurrency: DisplayCurrency;
  exchangeRates: CurrencyRates;
}) {
  return (
    <tr className="border-b border-white/6 last:border-b-0">
      <td className="px-4 py-4 text-sm font-semibold text-white">{label}</td>
      <td className="px-4 py-4 text-sm text-white">
        {formatCurrency(
          convertFromBRL(price, displayCurrency, exchangeRates),
          displayCurrency,
        )}
      </td>
      <td className="px-4 py-4 text-sm text-[#f5c96e]">
        {formatCurrency(
          convertFromBRL(commissionOrDiscount, displayCurrency, exchangeRates),
          displayCurrency,
        )}
      </td>
      <td className="px-4 py-4 text-sm text-white">
        {formatCurrency(
          convertFromBRL(amountReturned, displayCurrency, exchangeRates),
          displayCurrency,
        )}
      </td>
      <td className="px-4 py-4 text-sm text-[#dc2828]">
        {formatCurrency(
          convertFromBRL(cost, displayCurrency, exchangeRates),
          displayCurrency,
        )}
      </td>
      <td className="px-4 py-4 text-sm font-semibold text-[var(--accent)]">
        {formatCurrency(
          convertFromBRL(profit, displayCurrency, exchangeRates),
          displayCurrency,
        )}
      </td>
    </tr>
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
      label: "Producao por ciclo",
      value: form.multiplePiecesEnabled
        ? `${form.quantity} peças`
        : "1 peça por vez",
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
        (listingType) => listingType.id === form.mercadoLivreListingTypeId
      )?.label ?? "Classico";

    const rootCategoryLabel =
      mercadoLivreRootCategories.find(
        (category) => category.key === form.mercadoLivreRootCategoryKey
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
      }
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
      }
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
      }
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
      }
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
      }
    );
  }

  return lines;
}

type SummaryLine = {
  label: string;
  value: string;
  numericValue?: number;
  hideWhenZero?: boolean;
};

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

function isZeroValue(value?: number) {
  return value === undefined || Math.abs(value) < 0.0001;
}
