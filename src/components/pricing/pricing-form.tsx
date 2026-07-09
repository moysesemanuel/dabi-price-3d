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
} from "@/lib/marketplaces/mercado-livre";
import {
  normalizeColorHex,
  sumFilamentRequirementInputWeights,
} from "@/lib/pricing/filament-requirements";
import {
  type FilamentRequirementInput,
  type PricingFormState,
} from "@/lib/pricing/initial-pricing-form";
import { salesChannels } from "@/lib/pricing/sales-channels";
import { MercadoLivreCartIcon } from "./mercado-livre-cart-icon";
import { HandbagIcon } from "./hand-bag-icon";
import { AmazonIcon } from "./amazon-icon";
import { DirectSaleIcon } from "./direct-sale-icon";
import { MercadoLivreCategoryPicker } from "./mercado-livre-category-picker";

type PricingFormProps = {
  form: PricingFormState;
  onChange: (
    field: keyof PricingFormState,
    value: string | number | boolean
  ) => void;
  onFilamentRequirementChange: (
    index: number,
    field: keyof FilamentRequirementInput,
    value: string | number,
  ) => void;
  onAddFilamentRequirement: () => void;
  onRemoveFilamentRequirement: (index: number) => void;
  suggestedPrice: number;
  effectiveMarketplaceFeePercentage: number;
  mercadoLivrePredictedCategoryName: string | null;
  mercadoLivreShippingEstimate: number;
  mercadoLivreOfficialLookupReady: boolean;
  mercadoLivreOfficialLookupError: string | null;
  displayCurrency: DisplayCurrency;
  onDisplayCurrencyChange: (currency: DisplayCurrency) => void;
  exchangeRateSnapshot: ExchangeRateSnapshot;
  onMercadoLivreOfficialCategorySelect: (selection: {
    id: string;
    name: string;
    rootCategoryKey: PricingFormState["mercadoLivreRootCategoryKey"] | null;
  }) => void;
  onMercadoLivreOfficialCategoryClear: () => void;
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
  onFilamentRequirementChange,
  onAddFilamentRequirement,
  onRemoveFilamentRequirement,
  suggestedPrice,
  effectiveMarketplaceFeePercentage,
  mercadoLivrePredictedCategoryName,
  mercadoLivreShippingEstimate,
  mercadoLivreOfficialLookupReady,
  mercadoLivreOfficialLookupError,
  displayCurrency,
  onDisplayCurrencyChange,
  exchangeRateSnapshot,
  onMercadoLivreOfficialCategorySelect,
  onMercadoLivreOfficialCategoryClear,
}: PricingFormProps) {
  const [mlPackageDetailsOpen, setMlPackageDetailsOpen] = useState(false);

  const isMercadoLivre = form.salesChannelId === "mercado-livre";
  const isShopee = form.salesChannelId === "shopee";
  const isAmazon = form.salesChannelId === "amazon";
  const isDirect = form.salesChannelId === "direct";
  const isConsignment = form.salesChannelId === "consignment";
  const kitQuantity = Math.max(form.kitQuantity, 1);
  const lotQuantity = Math.max(form.quantity, 1);
  const usesLotPrintTime =
    form.multiplePiecesEnabled && form.dividePrintTimeByPieces;
  const usesLotFilament =
    form.multiplePiecesEnabled && form.divideFilamentByPieces;
  const printTimeHoursLabel = usesLotPrintTime
    ? "Horas de impressão do ciclo *"
    : form.multiplePiecesEnabled
      ? "Horas de impressão por peça *"
      : "Horas de impressão *";
  const printTimeMinutesLabel = usesLotPrintTime
    ? "Minutos do ciclo"
    : form.multiplePiecesEnabled
      ? "Minutos por peça"
      : "Minutos de impressão";
  const printTimeNote = usesLotPrintTime
    ? `Use o tempo total para imprimir as ${lotQuantity} peça(s) juntas.`
    : form.multiplePiecesEnabled
      ? `Use o tempo de 1 peça. O total do ciclo será multiplicado por ${lotQuantity}.`
      : undefined;
  const weightLabel = usesLotFilament
    ? "Peso usado no ciclo"
    : form.multiplePiecesEnabled
      ? "Peso usado na peça"
      : "Peso usado na peça";
  const weightNote = usesLotFilament
    ? `Digite o peso total das ${lotQuantity} peça(s) juntas.`
    : form.multiplePiecesEnabled
      ? `Digite o peso de 1 peça. O total do ciclo será multiplicado por ${lotQuantity}.`
      : undefined;
  const salePriceFieldLabel = form.isKit
    ? "Preço de venda do kit (R$) *"
    : form.multiplePiecesEnabled
      ? "Preço de venda por unidade (R$) *"
      : "Preço de venda (R$) *";
  const salePriceFieldNote = form.isKit
    ? `Informe o valor total cobrado pelo kit. O resumo tambem mostra o valor por item (${kitQuantity} por kit) e valida a viabilidade no canal.`
    : form.multiplePiecesEnabled
      ? "Esse valor continua sendo por unidade vendida, mesmo com varias pecas por ciclo. O painel ao lado mostra taxas, lucro e viabilidade."
      : "Digite o preco de venda livremente. O painel ao lado mostra taxas, lucro e se o valor e viavel no canal.";

  const pixPrice = useMemo(() => {
    return suggestedPrice * (1 - form.directPixDiscountPercentage / 100);
  }, [form.directPixDiscountPercentage, suggestedPrice]);

  const currencySymbol = currencyMeta[displayCurrency].symbol;
  const exchangeRateDateLabel = exchangeRateSnapshot.date
    ? new Intl.DateTimeFormat("pt-BR").format(
        new Date(`${exchangeRateSnapshot.date}T00:00:00`),
      )
    : "última cotação disponível";
  const filamentRequirementsTotal = useMemo(
    () => sumFilamentRequirementInputWeights(form.filamentRequirements),
    [form.filamentRequirements],
  );
  const filamentRequirementsDifference = Math.abs(
    filamentRequirementsTotal - form.weightGrams,
  );
  const filamentRequirementsReferenceLabel = usesLotFilament
    ? "total do ciclo"
    : form.isKit
      ? "base de uma peça do kit"
      : "base de uma unidade";
  const filamentRequirementsMatch =
    filamentRequirementsDifference <= 0.01;

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
    <form className="space-y-5">
      <section className="overflow-hidden rounded-[32px] border border-black/8 bg-white shadow-[0_20px_60px_rgba(103,55,18,0.08)]">
        <div className="border-b border-black/8 px-5 py-5 sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#d84f00]">
            Editor da precificação
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#18120d]">
            Tudo em uma tela
          </h2>
          <p className="mt-2 max-w-[760px] text-sm leading-7 text-[#7c6858]">
            Preencha os blocos abaixo na ordem que fizer sentido. O cálculo e o
            painel lateral continuam atualizando em tempo real, sem navegação
            por etapas.
          </p>
        </div>

        <FormSection id="section-1">
        <NumberEyebrow index="1" label="Base do produto" />
        <SectionLead
          title="Contexto do produto"
          description="Defina o item, o formato de venda e a moeda de leitura antes de entrar nas regras do canal."
        />

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <Field
              label="Nome do produto"
              value={form.productName}
              onChange={(value) => onChange("productName", value)}
              inputKind="text"
              note="Usado no histórico, no site e nas integrações de marketplace."
            />

            <div className="mt-5 grid gap-2 md:grid-cols-2">
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
          </div>

          <div className="space-y-4">
            <div className="border-l border-black/10 pl-4">
              <SectionEyebrow label="Moeda de exibicao" />

              <div className="mt-4 flex flex-wrap gap-2">
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

              <p className="mt-3 text-xs text-[#7c6858]">
                Cotação diária via {exchangeRateSnapshot.sourceLabel} ·{" "}
                {exchangeRateDateLabel}
              </p>
            </div>

            <div className="border-l border-black/10 pl-4">
              <ToggleRow
                label="Vendido como kit?"
                note="Usa o preco total do kit e mostra tambem o valor por item interno."
                checked={form.isKit}
                onToggle={() => onChange("isKit", !form.isKit)}
              />

              {form.isKit ? (
                <div className="mt-4 max-w-[180px]">
                  <Field
                    label="Itens por kit"
                    value={form.kitQuantity}
                    onChange={(value) => onChange("kitQuantity", value)}
                    note="Usado para dividir preco, custo e lucro por item do kit."
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        </FormSection>

        <FormSection id="section-2" className="border-t border-black/8">
        <NumberEyebrow index="2" label="Marketplace" />
        <SectionLead
          title="Canal de venda"
          description="Escolha primeiro o canal. As regras específicas aparecem abaixo de forma mais compacta."
        />

        <div className="mt-5 flex flex-wrap gap-2">
          {salesChannels.map((channel) => {
            const isActive = channel.id === form.salesChannelId;

            return (
              <button
                key={channel.id}
                type="button"
                onClick={() => onChange("salesChannelId", channel.id)}
                className={`inline-flex items-center gap-3 rounded-full border px-4 py-3 text-left transition ${
                  isActive
                    ? "border-[#ff6a00] bg-[#ff6a00] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    : "border-black/8 bg-white text-[#18120d] hover:border-black/14 hover:bg-white"
                }`}
              >
                {channel.id === "mercado-livre" ? (
                  <MercadoLivreCartIcon
                    className={`mb-3 size-7 ${
                      isActive ? "text-white" : "text-[#7c6858]"
                    }`}
                  />
                ) : null}

                {channel.id === "shopee" ? (
                  <HandbagIcon
                    className={`mb-3 size-7 ${
                      isActive ? "text-white" : "text-[#7c6858]"
                    }`}
                  />
                ) : null}

                {channel.id === "amazon" ? (
                  <AmazonIcon
                    className={`mb-3 size-7 ${
                      isActive ? "text-white" : "text-[#7c6858]"
                    }`}
                  />
                ) : null}

                {channel.id === "direct" ? (
                  <DirectSaleIcon
                    className={`mb-3 size-7 ${
                      isActive ? "text-white" : "text-[#7c6858]"
                    }`}
                  />
                ) : null}

                {channel.id === "consignment" ? (
                  <DirectSaleIcon
                    className={`mb-3 size-7 ${
                      isActive ? "text-white" : "text-[#7c6858]"
                    }`}
                  />
                ) : null}

                <strong
                  className={`block text-sm font-semibold tracking-[-0.02em] ${
                    isActive ? "text-white" : "text-[#18120d]"
                  }`}
                >
                  {channel.name}
                </strong>

                <span className="text-xs text-[#7c6858]">
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
              label="Taxa aplicada"
              value={effectiveMarketplaceFeePercentage.toFixed(1).replace(".", ",")}
              onChange={() => undefined}
              suffix="%"
              disabled
              note="Baseada na categoria selecionada e no tipo de anuncio."
            />

            <MercadoLivreCategoryPicker
              selectedCategoryId={form.mercadoLivreOfficialCategoryId}
              selectedCategoryName={
                form.mercadoLivreOfficialCategoryName.trim() ||
                mercadoLivrePredictedCategoryName ||
                ""
              }
              onSelect={onMercadoLivreOfficialCategorySelect}
              onClear={onMercadoLivreOfficialCategoryClear}
            />

            <div className="border-t border-black/8 pt-6">
              <SectionEyebrow label="Custo de envio (Envios ML 2026)" />

              <div className="mt-4 flex items-center justify-between gap-4 rounded-[20px] border border-black/8 bg-white px-4 py-4">
                <div>
                  <p className="text-sm text-[#18120d]">
                    Perfil de embalagem usado na simulacao
                  </p>
                  <p className="mt-1 text-xs text-[#7c6858]">
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
                  className="rounded-full border border-black/8 bg-white px-4 py-2 text-sm text-[#18120d] transition hover:border-[#ff6a00]/30 hover:bg-[#ff6a00]"
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
                      ? "[&_input]:border-[#ff6a00]/30 [&_input]:bg-[#ff6a00]"
                      : undefined
                  }
                />
              </div>

              <div className="mt-3 space-y-2">
                {!form.mercadoLivreFreeShipping ? (
                  <p className="text-xs text-[#7c6858]">
                    Frete grátis desligado. O custo do envio no cálculo fica em{" "}
                    {currencySymbol} 0,00 até você informar um valor manual.
                  </p>
                ) : null}

                {form.mercadoLivreFreeShipping &&
                mercadoLivreOfficialLookupError ? (
                  <p className="text-xs text-[#d84f00]">
                    Não foi possível calcular o frete automático do Mercado
                    Livre: {mercadoLivreOfficialLookupError}
                  </p>
                ) : null}

                {form.mercadoLivreFreeShipping &&
                mercadoLivreOfficialLookupError ? (
                  <p className="text-xs text-[#d84f00]">
                    Use o campo <strong>Frete no cálculo</strong> para informar
                    manualmente o valor que o vendedor precisa absorver.
                  </p>
                ) : null}

                {form.mercadoLivreFreeShipping &&
                !mercadoLivreOfficialLookupError &&
                !mercadoLivreOfficialLookupReady ? (
                  <p className="text-xs text-[#7c6858]">
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
                <p className="mt-4 text-xs text-[#7c6858]">
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
              <div className="rounded-[20px] border-l border-[#ff6a00] pl-4">
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
              <p className="mt-3 font-mono text-sm text-[#7c6858]">
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
        </FormSection>

        <FormSection id="section-3" className="border-t border-black/8">
        <NumberEyebrow index="3" label="Preço & lucro" />
        <SectionLead
          title="Estratégia de preço"
          description="Aqui você decide se quer partir de um valor manual ou de uma margem-alvo."
        />

        <div className="mt-8">
          <p className="text-xs uppercase tracking-[0.28em] text-[#7c6858]">
            Modo de precificação
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <PillButton
              label="Digitar preço de venda"
              active={form.pricingMode === "manual"}
              onClick={() => onChange("pricingMode", "manual")}
            />

            <PillButton
              label="Margem de lucro"
              active={form.pricingMode === "margin"}
              onClick={() => onChange("pricingMode", "margin")}
            />
          </div>

          {form.pricingMode === "manual" ? (
            <div className="mt-6">
              <Field
                label={salePriceFieldLabel}
                value={displayMoney(form.manualSalePrice)}
                onChange={(value) => handleMoneyChange("manualSalePrice", value)}
                inputKind="money"
                prefix={currencySymbol}
                note={salePriceFieldNote}
              />
            </div>
          ) : (
            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-[#18120d]">Lucro desejado</p>
                  <p className="mt-1 text-xs text-[#7c6858]">
                    % de lucro líquido sobre o preço de venda após custos, taxas e imposto
                  </p>
                </div>

                <strong className="text-3xl font-semibold text-[#d84f00]">
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
                    #ff6a00 0%,
                    #ff6a00 ${form.profitMarginPercentage}%,
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
                  [&::-webkit-slider-thumb]:border-[#ff6a00]
                  [&::-webkit-slider-thumb]:bg-white
                  [&::-moz-range-thumb]:h-5
                  [&::-moz-range-thumb]:w-5
                  [&::-moz-range-thumb]:rounded-full
                  [&::-moz-range-thumb]:border-2
                  [&::-moz-range-thumb]:border-[#ff6a00]
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
        </FormSection>

        <FormSection id="section-4" className="border-t border-black/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <NumberEyebrow index="4" label="Impressora & energia" />

          <span className="rounded-md border border-black/8 px-3 py-1 font-mono text-[10px] text-[#7c6858]">
            Bambu Lab + outras
          </span>
        </div>
        <SectionLead
          title="Capacidade de produção"
          description="Tempo, potência e múltiplas peças no mesmo ciclo definem custo operacional e produtividade."
        />

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
              label={printTimeHoursLabel}
              value={form.printTimeHours}
              onChange={(value) => onChange("printTimeHours", value)}
              note={printTimeNote}
            />

            <Field
              label={printTimeMinutesLabel}
              value={form.printTimeMinutes}
              onChange={(value) => onChange("printTimeMinutes", value)}
            />
          </div>

          <ToggleRow
            label="Produz varias pecas no mesmo ciclo?"
            note="Isso rateia custo e produtividade por unidade. Nao transforma o anuncio em kit."
            checked={form.multiplePiecesEnabled}
            onToggle={() =>
              onChange("multiplePiecesEnabled", !form.multiplePiecesEnabled)
            }
          />

          {form.multiplePiecesEnabled ? (
            <div className="border-l border-[#ff6a00] pl-6">
              <div className="max-w-[160px]">
                <Field
                  label="Peças na mesa"
                  value={form.quantity}
                  onChange={(value) => onChange("quantity", value)}
                />
              </div>

              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
                Como interpretar os campos
              </p>

              <div className="mt-4 space-y-4">
                <ToggleRow
                  label="Tempo informado ja e do ciclo"
                  note={`Ative so se as ${lotQuantity} peca(s) sairem juntas nesse mesmo tempo.`}
                  checked={form.dividePrintTimeByPieces}
                  onToggle={() =>
                    onChange(
                      "dividePrintTimeByPieces",
                      !form.dividePrintTimeByPieces
                    )
                  }
                />

                <ToggleRow
                  label="Filamento informado ja e do ciclo"
                  note={`Ative so se o peso digitado ja somar as ${lotQuantity} peca(s).`}
                  checked={form.divideFilamentByPieces}
                  onToggle={() =>
                    onChange(
                      "divideFilamentByPieces",
                      !form.divideFilamentByPieces
                    )
                  }
                />
              </div>

              <p className="mt-4 text-xs leading-6 text-[#7c6858]">
                Se voce vende em kit, informe os itens por kit. Quando a mesa
                nao fecha o kit inteiro em um ciclo, a precificadora passa a
                multiplicar tempo, filamento e rateio produtivo para completar
                esse kit.
              </p>
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
        </FormSection>

        <FormSection id="section-5" className="border-t border-black/8">
        <NumberEyebrow index="5" label="Filamento" />
        <SectionLead
          title="Material principal"
          description="Peso e custo do filamento entram direto no custo base. A composição por cor fica recolhível logo abaixo."
        />

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
            label={weightLabel}
            value={form.weightGrams}
            onChange={(value) => onChange("weightGrams", value)}
            suffix="g"
            note={weightNote}
          />
        </div>

        <SectionDisclosure
          className="mt-6"
          title="Composição por cor e dados para ERP"
          description={`Os pesos seguem a mesma regra do campo de filamento: ${filamentRequirementsReferenceLabel}.`}
          defaultOpen={false}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-sm text-[#7c6858]">
              Use apenas se precisar detalhar materiais e cores usados no produto.
            </div>

            <button
              type="button"
              onClick={onAddFilamentRequirement}
              className="rounded-full border border-[#ff6a00] bg-[#ff6a00] px-4 py-3 text-sm font-medium text-white transition hover:brightness-110"
            >
              Adicionar cor
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {form.filamentRequirements.map((requirement, index) => (
              <FilamentRequirementCard
                key={requirement.id ?? `filament-${index}`}
                index={index}
                requirement={requirement}
                canRemove={form.filamentRequirements.length > 1}
                onChange={onFilamentRequirementChange}
                onRemove={onRemoveFilamentRequirement}
              />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-4">
            <div>
              <p className="text-sm text-[#18120d]">
                Soma das cores: {filamentRequirementsTotal.toFixed(2)} g
              </p>
              <p className="mt-1 text-xs text-[#7c6858]">
                Peso total informado: {form.weightGrams.toFixed(2)} g
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filamentRequirementsMatch
                  ? "bg-[#ff6a00] text-white"
                  : "bg-[#ff6a00] text-white"
              }`}
            >
              {filamentRequirementsMatch
                ? "Pesos conferem"
                : `Ajuste ${filamentRequirementsDifference.toFixed(2)} g`}
            </span>
          </div>
        </SectionDisclosure>
        </FormSection>

        <FormSection id="section-6" className="border-t border-black/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <NumberEyebrow index="6" label="Demais custos" />
          <span className="rounded-full border border-black/8 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#7c6858]">
            opcional
          </span>
        </div>
        <SectionLead
          title="Custos operacionais"
          description="Imposto, perdas, embalagem e manutenção entram como ajustes que refinam o preço final."
        />

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
            label="Manutencao por hora"
            value={displayMoney(form.maintenanceCostPerHour)}
            onChange={(value) =>
              handleMoneyChange("maintenanceCostPerHour", value)
            }
            inputKind="money"
            prefix={currencySymbol}
            note="Rateio de manutencao da maquina por hora impressa"
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
        </FormSection>

      {isDirect ? (
        <FormSection className="border-t border-black/8">
          <NumberEyebrow index="7" label="Forma de pagamento" />
          <SectionLead
            title="Recebimento na venda direta"
            description="Configuração complementar para Pix, cartão e taxa manual da maquininha."
          />

          <SectionDisclosure
            className="mt-5"
            title="Abrir regras de pagamento"
            description="Pix, cartão e taxa manual da maquininha."
            defaultOpen={false}
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

            <div className="mt-6 grid gap-4 border-t border-black/8 pt-6 md:grid-cols-2">
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
          </SectionDisclosure>
        </FormSection>
      ) : null}
      </section>
    </form>
  );
}

function FormSection({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`bg-transparent px-5 py-6 sm:px-6 sm:py-7 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionLead({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-5 max-w-[760px]">
      <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#18120d]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-7 text-[#7c6858]">
        {description}
      </p>
    </div>
  );
}

function SectionDisclosure({
  title,
  description,
  children,
  defaultOpen = false,
  className = "",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={`group rounded-[24px] border border-black/8 bg-white ${className}`}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 marker:content-none">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#18120d]">{title}</p>
          <p className="mt-1 text-xs text-[#7c6858]">{description}</p>
        </div>

        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-black/8 bg-[#ff6a00] text-sm text-white transition-transform duration-200 group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="border-t border-black/8 px-4 py-4">{children}</div>
    </details>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#d84f00]">
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
      <span className="inline-flex size-8 items-center justify-center rounded-2xl border border-[#ff6a00] bg-[#ff6a00] text-sm font-semibold text-white">
        {index}
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#7c6858]">
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
      className={`rounded-[18px] border px-4 text-left transition ${
        compact ? "py-3" : "py-4"
      } ${
        active
          ? "border-[#ff6a00] bg-[#ff6a00]"
          : "border-[#d6c8bb] bg-[#fcfaf8] hover:border-[#bdaa99] hover:bg-white"
      }`}
    >
      <strong
        className={`block text-sm font-semibold tracking-[-0.02em] ${
          active ? "text-white" : "text-[#18120d]"
        }`}
      >
        {title}
      </strong>
      <span className={`mt-1 block text-xs ${active ? "text-white/85" : "text-[#7c6858]"}`}>
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
      ? "border-[#ff6a00] bg-[#ff6a00]"
      : "border-[#ff6a00] bg-[#ff6a00]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[18px] border px-4 py-4 text-left transition ${
        active
          ? activeClassName
          : "border-[#d6c8bb] bg-[#fcfaf8] hover:border-[#bdaa99] hover:bg-white"
      }`}
    >
      <strong className={`block text-base font-semibold tracking-[-0.03em] ${active ? "text-white" : "text-[#18120d]"}`}>
        {title}
      </strong>
      <span className={`mt-2 block text-sm ${active ? "text-white/85" : "text-[#7c6858]"}`}>
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
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-[#ff6a00] bg-[#ff6a00] text-white"
          : "border-[#cfbeaf] bg-[#faf6f2] text-[#5f4d40] hover:border-[#bdaa99] hover:bg-white hover:text-[#18120d]"
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
      className={`rounded-full border px-4 py-3 text-center text-sm transition ${
        active
          ? "border-[#ff6a00] bg-[#ff6a00] text-white"
          : "border-[#cfbeaf] bg-[#faf6f2] text-[#5f4d40] hover:border-[#bdaa99] hover:bg-white hover:text-[#18120d]"
      }`}
    >
      {label}
    </button>
  );
}

function FilamentRequirementCard({
  index,
  requirement,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  requirement: FilamentRequirementInput;
  canRemove: boolean;
  onChange: (
    index: number,
    field: keyof FilamentRequirementInput,
    value: string | number,
  ) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="rounded-[24px] border border-black/8 bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-medium text-[#18120d]">Cor {index + 1}</p>

        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-full border border-black/8 px-3 py-2 text-xs font-medium text-[#7c6858] transition hover:border-[#ff6a00]/30 hover:bg-[#ff6a00] hover:text-white"
          >
            Remover
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_180px_140px_140px]">
        <Field
          label="Nome da cor"
          value={requirement.colorName}
          onChange={(value) => onChange(index, "colorName", value)}
          inputKind="text"
          note="Ex.: Branco, Preto, Azul translúcido"
        />

        <Field
          label="Material"
          value={requirement.material}
          onChange={(value) => onChange(index, "material", value)}
          inputKind="text"
          note="Ex.: PLA, PETG, ABS"
        />

        <label>
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
            Hex
          </span>

          <div className="mt-2 flex h-[50px] items-center gap-3 rounded-2xl border border-black/8 bg-white px-4">
            <input
              type="color"
              value={normalizeColorHex(requirement.colorHex)}
              onChange={(event) =>
                onChange(index, "colorHex", event.target.value)
              }
              className="size-8 rounded-lg border border-black/8 bg-transparent"
            />

            <input
              type="text"
              value={requirement.colorHex}
              onChange={(event) =>
                onChange(index, "colorHex", event.target.value)
              }
              className="min-w-0 flex-1 bg-transparent text-sm text-[#18120d] outline-none"
            />
          </div>
        </label>

        <Field
          label="Peso"
          value={requirement.weightGrams}
          onChange={(value) => onChange(index, "weightGrams", value)}
          suffix="g"
        />
      </div>
    </div>
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
    <div
      className={`flex items-center justify-between gap-4 rounded-[24px] border border-[#d6c8bb] bg-[#fcfaf8] px-4 py-4 ${className}`}
    >
      <div className="pr-3">
        <p className="text-sm font-medium text-[#18120d]">{label}</p>
        <p className="mt-1 text-xs text-[#7c6858]">{note}</p>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
          checked
            ? "border-[#ff6a00] bg-[#ff6a00]"
            : "border-[#bdaa99] bg-[#d9cec4]"
        }`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full border border-black/10 bg-white shadow-sm transition ${
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
  const isRequired = label.includes("*");
  const normalizedLabel = label.replace("*", "").trim();

  return (
    <label className={className}>
      <span className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        <span>{normalizedLabel}</span>
        {isRequired ? (
          <span className="rounded-full border border-[#ff6a00] bg-[#ff6a00] px-2 py-0.5 text-[10px] tracking-[0.14em] text-white">
            obrigatório
          </span>
        ) : null}
      </span>

      <div className="mt-2 flex items-center overflow-hidden rounded-2xl border border-[#d6c8bb] bg-white transition focus-within:border-[#ff6a00]/45 focus-within:ring-2 focus-within:ring-[#ff6a00]">
        {prefix ? (
          <span className="border-r border-[#e1d4c9] bg-[#faf6f2] px-4 py-3 text-sm text-[#6b584a]">
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
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base text-[#18120d] outline-none placeholder:text-[#8a7768] disabled:bg-[#faf6f2] disabled:text-[#9a4a1c]"
        />

        {suffix ? (
          <span className="border-l border-[#e1d4c9] bg-[#faf6f2] px-4 py-3 text-sm text-[#6b584a]">
            {suffix}
          </span>
        ) : null}
      </div>

      {note ? <p className="mt-2 text-xs text-[#7c6858]">{note}</p> : null}
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
      <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#d6c8bb] bg-white px-4 py-3 text-base text-[#18120d] outline-none transition focus:border-[#ff6a00]/45 focus:ring-2 focus:ring-[#ff6a00]"
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
      className={`rounded-[24px] border p-5 font-mono text-sm leading-8 ${
        tone === "amber"
          ? "border-[#ff6a00] bg-[#ff6a00] text-white"
          : "border-[#d6c8bb] bg-[#fcfaf8] text-[#18120d]"
      }`}
    >
      <p className="mb-3 uppercase tracking-[0.2em] text-[#7c6858]">
        {title}
      </p>
      {children}
    </div>
  );
}
