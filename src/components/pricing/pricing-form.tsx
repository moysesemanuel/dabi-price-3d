"use client";

import { useMemo, useState } from "react";
import {
  convertFromBRL,
  convertToBRL,
  currencyMeta,
  formatDecimal,
  parseLocalizedNumber,
  type DisplayCurrency,
  type ExchangeRateSnapshot,
} from "@/lib/currency/display-currency";
import {
  mercadoLivreListingTypes,
  mercadoLivreRootCategories,
} from "@/lib/marketplaces/mercado-livre";
import { type PricingFormState } from "@/lib/pricing/initial-pricing-form";
import { salesChannels } from "@/lib/pricing/sales-channels";
import { MercadoLivreCartIcon } from "./mercado-livre-cart-icon";
import { HandbagIcon } from "./hand-bag-icon";
import { AmazonIcon } from "./amazon-icon";
import { DirectSaleIcon } from "./direct-sale-icon";

type PricingFormProps = {
  form: PricingFormState;
  onChange: (
    field: keyof PricingFormState,
    value: string | number | boolean
  ) => void;
  suggestedPrice: number;
  effectiveMarketplaceFeePercentage: number;
  mercadoLivrePredictedCategoryName: string | null;
  mercadoLivreShippingEstimate: number;
  mercadoLivreOfficialLookupReady: boolean;
  mercadoLivreOfficialLookupError: string | null;
  displayCurrency: DisplayCurrency;
  onDisplayCurrencyChange: (currency: DisplayCurrency) => void;
  exchangeRateSnapshot: ExchangeRateSnapshot;
};

const channelDescriptions: Record<string, string> = {
  "mercado-livre": "Classico ou Premium",
  shopee: "Tabela oficial 2026",
  amazon: "FBA ou DBA",
  direct: "Pix, cartao, personalizado",
  consignment: "Comissao do parceiro",
};

const paymentOptions = [
  { id: "debit", label: "Debito", fee: "1,99%" },
  { id: "credit", label: "Credito", fee: "2,99%" },
  { id: "2x", label: "2x", fee: "4,49%" },
  { id: "3x", label: "3x", fee: "5,49%" },
  { id: "4x", label: "4x", fee: "6,49%" },
  { id: "6x", label: "6x", fee: "7,99%" },
  { id: "12x", label: "12x", fee: "11,99%" },
  { id: "other", label: "Outra", fee: "digitar" },
] as const;

const amazonCategoryOptions = [
  { value: "casa-e-cozinha", label: "Casa e Cozinha - 13%" },
  { value: "eletronicos", label: "Eletronicos - 11%" },
  { value: "utilidades", label: "Utilidades - 14%" },
] as const;

const printerModelOptions = [
  {
    value: "bambu-a1",
    label: "A1 — 0,10 kWh/h",
    powerWatts: 100,
  },
  {
    value: "bambu-a1-mini",
    label: "A1 Mini — 0,08 kWh/h",
    powerWatts: 80,
  },
  {
    value: "bambu-p1s",
    label: "P1S — 0,12 kWh/h",
    powerWatts: 120,
  },
  {
    value: "bambu-x1-carbon",
    label: "X1 Carbon — 0,15 kWh/h",
    powerWatts: 150,
  },
  {
    value: "creality-k1",
    label: "Creality K1 — 0,14 kWh/h",
    powerWatts: 140,
  },
  {
    value: "ender-3",
    label: "Ender 3 — 0,12 kWh/h",
    powerWatts: 120,
  },
] as const;

export function PricingForm({
  form,
  onChange,
  suggestedPrice,
  effectiveMarketplaceFeePercentage,
  mercadoLivrePredictedCategoryName,
  mercadoLivreShippingEstimate,
  mercadoLivreOfficialLookupReady,
  mercadoLivreOfficialLookupError,
  displayCurrency,
  onDisplayCurrencyChange,
  exchangeRateSnapshot,
}: PricingFormProps) {
  const [mlPackageDetailsOpen, setMlPackageDetailsOpen] = useState(false);

  const isMercadoLivre = form.salesChannelId === "mercado-livre";
  const isShopee = form.salesChannelId === "shopee";
  const isAmazon = form.salesChannelId === "amazon";
  const isDirect = form.salesChannelId === "direct";
  const isConsignment = form.salesChannelId === "consignment";

  const pixPrice = useMemo(() => {
    return suggestedPrice * (1 - form.directPixDiscountPercentage / 100);
  }, [form.directPixDiscountPercentage, suggestedPrice]);

  const currencySymbol = currencyMeta[displayCurrency].symbol;
  const exchangeRateDateLabel = exchangeRateSnapshot.date
    ? new Intl.DateTimeFormat("pt-BR").format(
        new Date(`${exchangeRateSnapshot.date}T00:00:00`),
      )
    : "última cotação disponível";

  function displayMoney(valueInBRL: number) {
    return formatDecimal(
      convertFromBRL(valueInBRL, displayCurrency, exchangeRateSnapshot.rates),
    );
  }

  function handleMoneyChange(
    field: keyof PricingFormState,
    rawValue: string,
  ) {
    const parsedDisplayValue = parseLocalizedNumber(rawValue);
    const valueInBRL = convertToBRL(
      parsedDisplayValue,
      displayCurrency,
      exchangeRateSnapshot.rates,
    );

    onChange(field, valueInBRL);
  }

  return (
    <form className="space-y-4">
      <SectionCard>
        <SectionEyebrow label="Moeda de exibicao" />

        <div className="mt-5 flex flex-wrap gap-2">
          <MiniToggle
            label="R$"
            active={displayCurrency === "BRL"}
            onClick={() => onDisplayCurrencyChange("BRL")}
          />
          <MiniToggle
            label="US$"
            active={displayCurrency === "USD"}
            onClick={() => onDisplayCurrencyChange("USD")}
          />
          <MiniToggle
            label="EUR"
            active={displayCurrency === "EUR"}
            onClick={() => onDisplayCurrencyChange("EUR")}
          />
        </div>

        <p className="mt-3 text-xs text-[var(--muted)]">
          Cotação diária via {exchangeRateSnapshot.sourceLabel} ·{" "}
          {exchangeRateDateLabel}
        </p>
      </SectionCard>

      <SectionCard>
        <NumberEyebrow index="0" label="Tipo de produto" />

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ChoiceCard
            title="Produto 3D"
            description="Impressora + filamento"
            active={form.productType === "3d"}
            onClick={() => onChange("productType", "3d")}
          />
          <ChoiceCard
            title="Produto Normal"
            description="Comprado de fornecedor"
            active={form.productType === "normal"}
            onClick={() => onChange("productType", "normal")}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <NumberEyebrow index="1" label="Marketplace" />

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {salesChannels.map((channel) => {
            const isActive = channel.id === form.salesChannelId;

            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onChange("salesChannelId", channel.id)}
                className={`rounded-[22px] border px-5 py-2 text-center transition ${
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_rgba(17,184,245,0.14)]"
                    : "border-white/8 bg-[var(--panel-soft)] text-white hover:border-white/16 hover:bg-white/3"
                }`}
              >
                {channel.id === "mercado-livre" ? (
                  <MercadoLivreCartIcon
                    className={`mx-auto mb-2 size-8 ${
                      isActive ? "text-[var(--accent)]" : "text-[#b6b2d0]"
                    }`}
                  />
                ) : null}

                {channel.id === "shopee" ? (
                  <HandbagIcon
                    className={`mx-auto mb-2 size-8 ${
                      isActive ? "text-[var(--accent)]" : "text-[#b6b2d0]"
                    }`}
                  />
                ) : null}

                {channel.id === "amazon" ? (
                  <AmazonIcon
                    className={`mx-auto mb-2 size-8 ${
                      isActive ? "text-[var(--accent)]" : "text-[#b6b2d0]"
                    }`}
                  />
                ) : null}

                {channel.id === "direct" ? (
                  <DirectSaleIcon
                    className={`mx-auto mb-2 size-8 ${
                      isActive ? "text-[var(--accent)]" : "text-[#b6b2d0]"
                    }`}
                  />
                ) : null}

                {channel.id === "consignment" ? (
                  <DirectSaleIcon
                    className={`mx-auto mb-2 size-8 ${
                      isActive ? "text-[var(--accent)]" : "text-[#b6b2d0]"
                    }`}
                  />
                ) : null}

                <strong
                  className={`block text-lg font-semibold tracking-[-0.04em] ${
                    isActive ? "text-[var(--accent)]" : "text-[#d4d9eb]"
                  }`}
                >
                  {channel.name}
                </strong>

                <span className="mt-1 block text-xs text-[var(--muted)]">
                  {channelDescriptions[channel.id] ?? "Canal configuravel"}
                </span>
              </button>
            );
          })}
        </div>

        {isMercadoLivre ? (
          <div className="mt-8 space-y-6">
            <div>
              <SectionEyebrow label="Tipo de anuncio" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {mercadoLivreListingTypes.map((listingType) => (
                  <MarketplaceModeCard
                    key={listingType.id}
                    title={listingType.label}
                    description={
                      listingType.id === "gold_special"
                        ? "10-14% . sem parcelamento"
                        : "15-19% . ate 18x sem juros"
                    }
                    active={form.mercadoLivreListingTypeId === listingType.id}
                    onClick={() =>
                      onChange("mercadoLivreListingTypeId", listingType.id)
                    }
                  />
                ))}
              </div>
            </div>

              <Field
                label="Nome do produto"
                value={form.productName}
                onChange={(value) => onChange("productName", value)}
                inputKind="text"
                note="Usado para prever automaticamente a categoria real do Mercado Livre."
              />

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <SelectField
                label="Categoria (Classico / Premium)"
                value={form.mercadoLivreRootCategoryKey}
                options={mercadoLivreRootCategories.map((category) => ({
                  value: category.key,
                  label: category.label,
                }))}
                onChange={(value) =>
                  onChange("mercadoLivreRootCategoryKey", value)
                }
              />
              <Field
                label="Taxa aplicada"
                value={effectiveMarketplaceFeePercentage
                  .toFixed(1)
                  .replace(".", ",")}
                onChange={() => undefined}
                suffix="%"
                disabled
                note="Comissao"
              />
            </div>

            <div className="border-t border-white/6 pt-6">
              <SectionEyebrow label="Custo de envio (Envios ML 2026)" />

              <div className="mt-4 flex items-center justify-between gap-4 rounded-[18px] border border-white/6 bg-[var(--panel-soft)] px-4 py-4">
                <div>
                  <p className="text-sm text-white">
                    Perfil de embalagem usado na simulacao
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {`${form.mercadoLivrePackageHeightCm} x ${
                      form.mercadoLivrePackageWidthCm
                    } x ${
                      form.mercadoLivrePackageLengthCm
                    } cm . ${form.mercadoLivrePackageWeightKg
                      .toFixed(3)
                      .replace(".", ",")} kg`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMlPackageDetailsOpen((current) => !current)}
                  className="rounded-xl border border-white/8 px-4 py-2 text-sm text-white transition hover:border-white/14 hover:bg-white/4"
                >
                  {mlPackageDetailsOpen ? "Ocultar medidas" : "Ajustar medidas"}
                </button>
              </div>

              {mlPackageDetailsOpen ? (
                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field
                    label="Altura embalagem (cm)"
                    value={form.mercadoLivrePackageHeightCm}
                    onChange={(value) =>
                      onChange("mercadoLivrePackageHeightCm", value)
                    }
                  />
                  <Field
                    label="Largura embalagem (cm)"
                    value={form.mercadoLivrePackageWidthCm}
                    onChange={(value) =>
                      onChange("mercadoLivrePackageWidthCm", value)
                    }
                  />
                  <Field
                    label="Comprimento embalagem (cm)"
                    value={form.mercadoLivrePackageLengthCm}
                    onChange={(value) =>
                      onChange("mercadoLivrePackageLengthCm", value)
                    }
                  />
                  <Field
                    label="Peso com embalagem (kg)"
                    value={form.mercadoLivrePackageWeightKg}
                    onChange={(value) =>
                      onChange("mercadoLivrePackageWeightKg", value)
                    }
                  />
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field
                  label="Custo de envio estimado"
                  value={displayMoney(mercadoLivreShippingEstimate)}
                  onChange={() => undefined}
                  inputKind="money"
                  prefix={currencySymbol}
                  disabled
                />
                <Field
                  label="Frete no calculo"
                  value={displayMoney(form.shippingCost)}
                  onChange={(value) => handleMoneyChange("shippingCost", value)}
                  inputKind="money"
                  prefix={currencySymbol}
                  note={
                    form.mercadoLivreFreeShipping &&
                    mercadoLivreOfficialLookupError
                      ? "A cotação automática falhou neste cenário. Informe manualmente o custo que o vendedor absorve."
                      : "Permite ajustar manualmente se o custo real diferir da estimativa."
                  }
                  className={
                    form.mercadoLivreFreeShipping &&
                    mercadoLivreOfficialLookupError
                      ? "[&_input]:border-amber-400/30 [&_input]:bg-amber-400/5"
                      : undefined
                  }
                />
              </div>

              <div className="mt-3 space-y-2">
                {!form.mercadoLivreFreeShipping ? (
                  <p className="text-xs text-[var(--muted)]">
                    Frete grátis desligado. O custo do envio no cálculo fica em{" "}
                    {currencySymbol} 0,00 até você informar um valor manual.
                  </p>
                ) : null}

                {form.mercadoLivreFreeShipping &&
                mercadoLivreOfficialLookupError ? (
                  <p className="text-xs text-[#ffb3b3]">
                    Não foi possível calcular o frete automático do Mercado
                    Livre: {mercadoLivreOfficialLookupError}
                  </p>
                ) : null}

                {form.mercadoLivreFreeShipping &&
                mercadoLivreOfficialLookupError ? (
                  <p className="text-xs text-amber-300">
                    Use o campo <strong>Frete no cálculo</strong> para informar
                    manualmente o valor que o vendedor precisa absorver.
                  </p>
                ) : null}

                {form.mercadoLivreFreeShipping &&
                !mercadoLivreOfficialLookupError &&
                !mercadoLivreOfficialLookupReady ? (
                  <p className="text-xs text-[var(--muted)]">
                    A estimativa automática depende da conexão com o Mercado
                    Livre em <strong>Preferências</strong>.
                  </p>
                ) : null}
              </div>

              <ToggleRow
                className="mt-6"
                label="Oferecer frete gratis"
                note="Custo adicional para entrega gratis"
                checked={form.mercadoLivreFreeShipping}
                onToggle={() =>
                  onChange(
                    "mercadoLivreFreeShipping",
                    !form.mercadoLivreFreeShipping
                  )
                }
              />

              {mercadoLivrePredictedCategoryName ? (
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Categoria prevista automaticamente:{" "}
                  {mercadoLivrePredictedCategoryName}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {isShopee ? (
          <div className="mt-8 space-y-6">
            <div>
              <SectionEyebrow label="Tipo de vendedor" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <MarketplaceModeCard
                  title="CNPJ"
                  description="Tabela padrao"
                  active={form.shopeeSellerType === "cnpj"}
                  onClick={() => onChange("shopeeSellerType", "cnpj")}
                />
                <MarketplaceModeCard
                  title="CPF"
                  description="+R$3/item (baixo vol.)"
                  active={form.shopeeSellerType === "cpf"}
                  onClick={() => onChange("shopeeSellerType", "cpf")}
                />
              </div>
            </div>

            <ToggleRow
              label="Campanha de destaque?"
              note="+2,5% de comissao durante a campanha"
              checked={form.shopeeFeaturedCampaign}
              onToggle={() =>
                onChange("shopeeFeaturedCampaign", !form.shopeeFeaturedCampaign)
              }
            />
            <ToggleRow
              label="Cupom de desconto proprio?"
              note="Desconto bancado por voce"
              checked={form.shopeeOwnCoupon}
              onToggle={() => onChange("shopeeOwnCoupon", !form.shopeeOwnCoupon)}
            />

            {form.shopeeOwnCoupon ? (
              <div className="rounded-[20px] border-l border-[var(--accent)] pl-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <PillButton
                    label="% desconto"
                    active={form.shopeeCouponMode === "percent"}
                    onClick={() => onChange("shopeeCouponMode", "percent")}
                  />
                  <PillButton
                    label="R$ fixo"
                    active={form.shopeeCouponMode === "fixed"}
                    onClick={() => onChange("shopeeCouponMode", "fixed")}
                  />
                </div>

                <div className="mt-4">
                  <Field
                    label={
                      form.shopeeCouponMode === "percent"
                        ? "Desconto em %"
                        : "Desconto em R$"
                    }
                    value={form.shopeeCouponValue}
                    onChange={(value) =>
                      form.shopeeCouponMode === "fixed"
                        ? handleMoneyChange("shopeeCouponValue", value)
                        : onChange("shopeeCouponValue", value)
                    }
                    inputKind={
                      form.shopeeCouponMode === "fixed" ? "money" : "number"
                    }
                    suffix={
                      form.shopeeCouponMode === "percent" ? "%" : undefined
                    }
                    prefix={
                      form.shopeeCouponMode === "fixed"
                        ? currencySymbol
                        : undefined
                    }
                  />
                </div>
              </div>
            ) : null}

            <InfoBlock title="Taxas Shopee 2026 (marco):">
              <p>Ate R$79,99 -&gt; 20% + R$4</p>
              <p>R$80-99,99 -&gt; 14% + R$16</p>
              <p>R$100-199,99 -&gt; 14% + R$20</p>
              <p>R$200-499,99 -&gt; 14% + R$26</p>
              <p>R$500+ -&gt; 14% + R$26</p>
              <p>Teto de comissao: R$100/item</p>
            </InfoBlock>
          </div>
        ) : null}

        {isAmazon ? (
          <div className="mt-8 space-y-6">
            <div>
              <SectionEyebrow label="Tipo de fulfillment" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <MarketplaceModeCard
                  title="FBA"
                  description="Fulfillment by Amazon"
                  active={form.amazonFulfillment === "fba"}
                  onClick={() => onChange("amazonFulfillment", "fba")}
                  accentTone="amber"
                />
                <MarketplaceModeCard
                  title="DBA"
                  description="Delivery by Amazon"
                  active={form.amazonFulfillment === "dba"}
                  onClick={() => onChange("amazonFulfillment", "dba")}
                  accentTone="amber"
                />
              </div>
            </div>

            <div>
              <SelectField
                label="Categoria do produto"
                value={form.amazonCategory}
                options={amazonCategoryOptions.map((category) => ({
                  value: category.value,
                  label: category.label,
                }))}
                onChange={(value) => onChange("amazonCategory", value)}
              />
              <p className="mt-3 font-mono text-sm text-[var(--muted)]">
                Comissao: 13%
              </p>
            </div>

            {form.amazonFulfillment === "fba" ? (
              <InfoBlock title="Taxas FBA por faixa de preco" tone="amber">
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <p>R$0-R$20</p>
                  <p>R$7.00</p>
                  <p>R$20-R$50</p>
                  <p>R$8.75</p>
                  <p>R$50-R$100</p>
                  <p>R$10.50</p>
                  <p>R$100-R$200</p>
                  <p>R$12.75</p>
                  <p>Logistica + Coleta + Armazenamento</p>
                  <p />
                </div>
              </InfoBlock>
            ) : null}

            <ToggleRow
              label="Parcelamento habilitado?"
              note="+3.5% em produtos acima de R$50"
              checked={form.amazonInstallmentsEnabled}
              onToggle={() =>
                onChange(
                  "amazonInstallmentsEnabled",
                  !form.amazonInstallmentsEnabled
                )
              }
            />
          </div>
        ) : null}

        {isConsignment ? (
          <div className="mt-8 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Comissão do parceiro"
                value={form.consignmentCommissionPercentage}
                onChange={(value) =>
                  onChange("consignmentCommissionPercentage", value)
                }
                suffix="%"
                note="Percentual do preço sugerido que o ponto parceiro vai reter."
              />

              <Field
                label="Preço sugerido atual"
                value={displayMoney(suggestedPrice)}
                onChange={() => undefined}
                inputKind="money"
                prefix={currencySymbol}
                disabled
                note="Valor de vitrine sugerido para manter sua margem após a comissão."
              />
            </div>

            <InfoBlock title="Como o consignado entra no cálculo:">
              <p>O preço sugerido é o valor final ao cliente no ponto parceiro.</p>
              <p>A comissão do parceiro entra como percentual sobre esse valor.</p>
              <p>Seu lucro líquido já sai descontando a comissão informada.</p>
            </InfoBlock>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard>
        <NumberEyebrow index="2" label="Preço & margem" />

        <div className="mt-8">
          <p className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Modo de precificação
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <PillButton
              label="Digitar preço de venda"
              active={form.pricingMode === "manual"}
              onClick={() => onChange("pricingMode", "manual")}
            />

            <PillButton
              label="Margem de contribuição"
              active={form.pricingMode === "margin"}
              onClick={() => onChange("pricingMode", "margin")}
            />
          </div>

          {form.pricingMode === "manual" ? (
            <div className="mt-6">
              <Field
                label="Preço de venda (R$) *"
                value={displayMoney(form.manualSalePrice)}
                onChange={(value) => handleMoneyChange("manualSalePrice", value)}
                inputKind="money"
                prefix={currencySymbol}
              />
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-white">Margem desejada</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    % sobre o preço de venda
                  </p>
                </div>

                <strong className="text-3xl font-semibold text-[var(--accent)]">
                  {form.profitMarginPercentage}%
                </strong>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={form.profitMarginPercentage}
                onChange={(event) =>
                  onChange("profitMarginPercentage", event.target.value)
                }
                style={{
                  background: `linear-gradient(
                    to right,
                    var(--accent) 0%,
                    var(--accent) ${form.profitMarginPercentage}%,
                    rgba(255,255,255,0.05) ${form.profitMarginPercentage}%,
                    rgba(255,255,255,0.05) 100%
                  )`,
                }}
                className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full
                  [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:w-5
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:border-2
                  [&::-webkit-slider-thumb]:border-[var(--accent)]
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:w-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-[var(--accent)]
                  [&::-moz-range-thumb]:bg-white"
              />
            </div>
          )}

          <ToggleRow
            className="mt-8"
            label="Calcular preço com promoção?"
            note="Preço com margem para absorver desconto"
            checked={form.promoEnabled}
            onToggle={() => onChange("promoEnabled", !form.promoEnabled)}
          />

          {form.promoEnabled ? (
            <div className="mt-6 w-fit">
              <Field
                label="Desconto da promoção (%)"
                value={form.promoDiscountPercentage}
                onChange={(value) => onChange("promoDiscountPercentage", value)}
                className="block w-[180px] [&>span]:whitespace-nowrap"
              />
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <NumberEyebrow index="3" label="Impressora & energia" />

          <span className="rounded-md border border-white/8 px-3 py-1 font-mono text-[10px] text-[var(--muted)]">
            Bambu Lab + outras
          </span>
        </div>

        <div className="mt-8 space-y-6">
          <div className="max-w-[300px]">
            <SelectField
              label="Modelo"
              value={form.printerModel}
              options={printerModelOptions}
              onChange={(value) => {
                onChange("printerModel", value);

                const selectedPrinter = printerModelOptions.find(
                  (printer) => printer.value === value
                );

                if (selectedPrinter) {
                  onChange(
                    "printerPowerWatts",
                    selectedPrinter.powerWatts.toString()
                  );
                }
              }}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Horas de impressão *"
              value={form.printTimeHours}
              onChange={(value) => onChange("printTimeHours", value)}
            />

            <Field
              label="Minutos de impressão"
              value={form.printTimeMinutes}
              onChange={(value) => onChange("printTimeMinutes", value)}
            />
          </div>

          <ToggleRow
            label="Múltiplas peças na mesa?"
            note="Divide o custo por peça automaticamente"
            checked={form.multiplePiecesEnabled}
            onToggle={() =>
              onChange("multiplePiecesEnabled", !form.multiplePiecesEnabled)
            }
          />

          {form.multiplePiecesEnabled ? (
            <div className="border-l border-[var(--accent)] pl-6">
              <div className="max-w-[160px]">
                <Field
                  label="Peças na mesa"
                  value={form.quantity}
                  onChange={(value) => onChange("quantity", value)}
                />
              </div>

              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                Dividir por peças
              </p>

              <div className="mt-4 space-y-4">
                <ToggleRow
                  label="Tempo de impressão"
                  note=""
                  checked={form.dividePrintTimeByPieces}
                  onToggle={() =>
                    onChange(
                      "dividePrintTimeByPieces",
                      !form.dividePrintTimeByPieces
                    )
                  }
                />

                <ToggleRow
                  label="Filamento"
                  note=""
                  checked={form.divideFilamentByPieces}
                  onToggle={() =>
                    onChange(
                      "divideFilamentByPieces",
                      !form.divideFilamentByPieces
                    )
                  }
                />
              </div>
            </div>
          ) : null}

          <Field
            label="Valor do kWh"
            value={displayMoney(form.kwhPrice)}
            onChange={(value) => handleMoneyChange("kwhPrice", value)}
            inputKind="money"
            prefix={currencySymbol}
            note={`Média nacional ≈ ${currencySymbol} ${displayMoney(0.85)} · verifique sua conta`}
          />
        </div>
      </SectionCard>

      <SectionCard>
        <NumberEyebrow index="4" label="Filamento" />

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field
            label="Custo do filamento"
            value={displayMoney(form.filamentSpoolPrice)}
            onChange={(value) => handleMoneyChange("filamentSpoolPrice", value)}
            inputKind="money"
            prefix={currencySymbol}
            suffix="/kg"
            note={`Custo = (${currencySymbol}/kg / 1000) x gramas`}
          />
          <Field
            label="Peso usado na peca"
            value={form.weightGrams}
            onChange={(value) => onChange("weightGrams", value)}
            suffix="g"
          />
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <NumberEyebrow index="5" label="Demais custos" />
          <span className="rounded-full border border-white/8 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            opcional
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field
            label="Imposto (aliquota)"
            value={form.taxPercentage}
            onChange={(value) => onChange("taxPercentage", value)}
            suffix="%"
            note="Simples, MEI ou regime proprio"
          />
          <Field
            label="Embalagem / acabamento"
            value={displayMoney(form.packagingCost)}
            onChange={(value) => handleMoneyChange("packagingCost", value)}
            inputKind="money"
            prefix={currencySymbol}
          />
          <Field
            label="Outros custos"
            value={displayMoney(form.maintenanceCostPerHour)}
            onChange={(value) =>
              handleMoneyChange("maintenanceCostPerHour", value)
            }
            inputKind="money"
            prefix={currencySymbol}
            note="Uso aqui como manutencao por hora"
            className="md:col-span-2"
          />
          {isDirect ? (
            <Field
              label="Mao de obra"
              value={displayMoney(form.laborCost)}
              onChange={(value) => handleMoneyChange("laborCost", value)}
              inputKind="money"
              prefix={currencySymbol}
              note="Custo total do lote"
            />
          ) : null}
          <Field
            label="Perdas / falhas"
            value={form.lossPercentage}
            onChange={(value) => onChange("lossPercentage", value)}
            suffix="%"
            note="Margem extra para absorver retrabalho"
          />
        </div>
      </SectionCard>

      {isDirect ? (
        <SectionCard>
          <NumberEyebrow index="6" label="Forma de pagamento" />

          <p className="mt-5 text-sm text-[var(--muted)]">
            O preco base e sempre o Pix. O cartao embute a taxa da maquininha no
            preco cobrado do cliente.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {paymentOptions.map((option) => (
              <ChoiceCard
                key={option.id}
                title={option.label}
                description={option.fee}
                active={form.directPaymentMethod === option.id}
                onClick={() => onChange("directPaymentMethod", option.id)}
                compact
              />
            ))}
          </div>

          <div className="mt-4">
            <Field
              label="Taxa manual"
              value={form.directCustomCardFeePercentage}
              onChange={(value) =>
                onChange("directCustomCardFeePercentage", value)
              }
              suffix="%"
            />
          </div>

          <div className="mt-6 grid gap-4 border-t border-white/6 pt-6 md:grid-cols-2">
            <Field
              label="Desconto para pagamento no Pix"
              value={form.directPixDiscountPercentage}
              onChange={(value) =>
                onChange("directPixDiscountPercentage", value)
              }
              suffix="%"
              note="Padrao 5%: exclusao aproximada da taxa da maquininha"
            />
            <Field
              label="Preco no Pix (calculado)"
              value={displayMoney(pixPrice)}
              onChange={() => undefined}
              inputKind="money"
              prefix={currencySymbol}
              disabled
            />
          </div>
        </SectionCard>
      ) : null}
    </form>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.22)] sm:p-6">
      {children}
    </section>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
      {label}
    </p>
  );
}

function NumberEyebrow({
  index,
  label,
}: {
  index: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-[#08110d]">
        {index}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
        {label}
      </span>
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  active,
  compact = false,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border px-5 text-center transition ${
        compact ? "py-4" : "py-6"
      } ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-white/8 bg-[var(--panel-soft)] hover:border-white/14"
      }`}
    >
      <strong
        className={`block text-base font-semibold tracking-[-0.03em] ${
          active ? "text-[var(--accent)]" : "text-white"
        }`}
      >
        {title}
      </strong>
      <span className="mt-2 block text-xs text-[var(--muted)]">
        {description}
      </span>
    </button>
  );
}

function MarketplaceModeCard({
  title,
  description,
  active,
  onClick,
  accentTone = "mint",
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
  accentTone?: "mint" | "amber";
}) {
  const activeClassName =
    accentTone === "amber"
      ? "border-amber-400 bg-[rgba(251,146,60,0.12)]"
      : "border-[var(--accent)] bg-[var(--accent-soft)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[22px] border px-5 py-6 text-left transition ${
        active
          ? activeClassName
          : "border-white/8 bg-[var(--panel-soft)] hover:border-white/14"
      }`}
    >
      <strong className="block text-2xl font-semibold tracking-[-0.03em] text-white">
        {title}
      </strong>
      <span className="mt-3 block text-sm text-[var(--muted)]">
        {description}
      </span>
    </button>
  );
}

function MiniToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
          : "border-white/8 bg-[var(--panel-soft)] text-[var(--muted)] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-4 py-3 text-center text-sm transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-white"
          : "border-white/8 bg-[var(--panel-soft)] text-[var(--muted)] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function ToggleRow({
  label,
  note,
  checked,
  onToggle,
  className = "",
}: {
  label: string;
  note: string;
  checked: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{note}</p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-[var(--accent)]" : "bg-white/10"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputKind = "number",
  note,
  prefix,
  suffix,
  disabled = false,
  className = "",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  inputKind?: "text" | "number" | "money";
  note?: string;
  prefix?: string;
  suffix?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [draftValue, setDraftValue] = useState(stringifyFieldValue(value));
  const [isFocused, setIsFocused] = useState(false);

  return (
    <label className={className}>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>

      <div className="mt-2 flex items-center overflow-hidden rounded-2xl border border-white/8 bg-[var(--panel-strong)]">
        {prefix ? (
          <span className="border-r border-white/8 px-4 py-3 text-sm text-[var(--muted)]">
            {prefix}
          </span>
        ) : null}

        <input
          type="text"
          inputMode={getInputMode(inputKind)}
          value={isFocused ? draftValue : stringifyFieldValue(value)}
          onFocus={() => {
            setDraftValue(stringifyFieldValue(value));
            setIsFocused(true);
            if (inputKind !== "text") {
              requestAnimationFrame(() => {
                if (document.activeElement instanceof HTMLInputElement) {
                  document.activeElement.select();
                }
              });
            }
          }}
          onBlur={() => setIsFocused(false)}
          onChange={(event) => {
            const nextValue =
              inputKind === "money"
                ? formatMoneyInput(event.target.value)
                : event.target.value;

            setDraftValue(nextValue);
            onChange(nextValue);
          }}
          disabled={disabled}
          placeholder={getInputPlaceholder(inputKind)}
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-white outline-none disabled:text-[var(--accent)]"
        />

        {suffix ? (
          <span className="border-l border-white/8 px-4 py-3 text-sm text-[var(--muted)]">
            {suffix}
          </span>
        ) : null}
      </div>

      {note ? <p className="mt-2 text-xs text-[var(--muted)]">{note}</p> : null}
    </label>
  );
}

function stringifyFieldValue(value: string | number) {
  return typeof value === "number" ? String(value).replace(".", ",") : value;
}

function formatMoneyInput(value: string) {
  const digitsOnly = value.replace(/\D/g, "");

  if (digitsOnly.length === 0) {
    return "";
  }

  const normalizedDigits = digitsOnly.padStart(3, "0");
  const integerPart = normalizedDigits
    .slice(0, -2)
    .replace(/^0+(?=\d)/, "");
  const decimalPart = normalizedDigits.slice(-2);

  return `${integerPart || "0"},${decimalPart}`;
}

function getInputMode(inputKind: "text" | "number" | "money") {
  if (inputKind === "money") {
    return "numeric";
  }

  if (inputKind === "number") {
    return "decimal";
  }

  return undefined;
}

function getInputPlaceholder(inputKind: "text" | "number" | "money") {
  if (inputKind === "money") {
    return "0,00";
  }

  if (inputKind === "number") {
    return "0";
  }

  return undefined;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/8 bg-[var(--panel-strong)] px-4 py-3 text-base text-white outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoBlock({
  title,
  children,
  tone = "default",
}: {
  title: string;
  children: React.ReactNode;
  tone?: "default" | "amber";
}) {
  return (
    <div
      className={`rounded-[22px] border p-5 font-mono text-sm leading-8 ${
        tone === "amber"
          ? "border-amber-500/30 bg-[rgba(251,146,60,0.08)] text-[#ddd9ef]"
          : "border-white/6 bg-[#121522] text-[#ddd9ef]"
      }`}
    >
      <p className="mb-3 uppercase tracking-[0.2em] text-[var(--muted)]">
        {title}
      </p>
      {children}
    </div>
  );
}
