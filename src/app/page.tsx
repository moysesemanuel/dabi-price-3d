"use client";

import { useEffect, useMemo, useState } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { PricingForm } from "@/components/pricing/pricing-form";
import { PricingResult } from "@/components/pricing/pricing-result";
import { SiteProductPublisher } from "@/components/pricing/site-product-publisher";
import {
  convertFromBRL,
  defaultExchangeRateSnapshot,
  type DisplayCurrency,
  type ExchangeRateSnapshot,
} from "@/lib/currency/display-currency";
import {
  attachSiteProductToCalculation,
  consumeQueuedCalculationEditId,
  getCalculationFromHistory,
  saveCalculationToHistory,
  upsertCalculationInHistory,
} from "@/lib/history/calculation-history";
import { getMercadoLivreFeePreview } from "@/lib/marketplaces/mercado-livre";
import { calculate3DPrice } from "@/lib/pricing/calculate-3d-price";
import { buildPricingViewModel } from "@/lib/pricing/build-pricing-view-model";
import {
  initialPricingForm,
  type PricingFormState,
} from "@/lib/pricing/initial-pricing-form";
import {
  findSalesChannelById,
  salesChannels,
} from "@/lib/pricing/sales-channels";
import {
  MAX_SITE_PRODUCT_PUBLISH_PAYLOAD_BYTES,
  getJsonSizeInBytes,
} from "@/lib/site-products/payload-size";
import type {
  ErpProductSaveRequest,
  ErpProductSaveResponse,
} from "@/lib/erp-products/types";
import type {
  SiteProductPublishRequest,
  SiteProductPublishResponse,
} from "@/lib/site-products/types";

type MercadoLivreAutomationState = {
  feePercentage: number | null;
  fixedFee: number | null;
  shippingEstimate: number | null;
  predictedCategoryName: string | null;
  predictedCategoryId: string | null;
  officialLookupReady: boolean;
  officialLookupError: string | null;
};

type SaveState = "idle" | "saved";

export default function Home() {
  const [form, setForm] = useState<PricingFormState>(initialPricingForm);
  const [displayCurrency, setDisplayCurrency] =
    useState<DisplayCurrency>("BRL");
  const [exchangeRateSnapshot, setExchangeRateSnapshot] =
    useState<ExchangeRateSnapshot>(defaultExchangeRateSnapshot);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [editingCalculationId, setEditingCalculationId] = useState<
    string | null
  >(null);

  const [mercadoLivreAutomation, setMercadoLivreAutomation] =
    useState<MercadoLivreAutomationState>({
      feePercentage: null,
      fixedFee: null,
      shippingEstimate: null,
      predictedCategoryName: null,
      predictedCategoryId: null,
      officialLookupReady: false,
      officialLookupError: null,
    });

  const mercadoLivreFeePreview = useMemo(() => {
    if (form.salesChannelId !== "mercado-livre") {
      return null;
    }

    return getMercadoLivreFeePreview({
      rootCategoryKey: form.mercadoLivreRootCategoryKey,
      listingTypeId: form.mercadoLivreListingTypeId,
    });
  }, [
    form.mercadoLivreListingTypeId,
    form.mercadoLivreRootCategoryKey,
    form.salesChannelId,
  ]);

  const effectiveMarketplaceFeePercentage =
    form.salesChannelId === "mercado-livre"
      ? mercadoLivreAutomation.feePercentage ??
        mercadoLivreFeePreview?.appliedFeePercentage ??
        form.marketplaceFeePercentage
      : form.salesChannelId === "consignment"
        ? form.consignmentCommissionPercentage
      : form.marketplaceFeePercentage;

  const effectiveMarketplaceFixedFee =
    form.salesChannelId === "mercado-livre"
      ? mercadoLivreAutomation.fixedFee ?? form.marketplaceFixedFee
      : form.marketplaceFixedFee;

  const effectiveForm = useMemo(
    () => ({
      ...form,
      marketplaceFeePercentage: effectiveMarketplaceFeePercentage,
      marketplaceFixedFee: effectiveMarketplaceFixedFee,
      laborCost:
        form.salesChannelId === "direct" || form.salesChannelId === "consignment"
          ? form.laborCost
          : 0,
    }),
    [effectiveMarketplaceFeePercentage, effectiveMarketplaceFixedFee, form],
  );

  const result = useMemo(() => calculate3DPrice(effectiveForm), [effectiveForm]);
  const viewModel = useMemo(
    () => buildPricingViewModel(form, result),
    [form, result],
  );

  const selectedChannel = findSalesChannelById(form.salesChannelId);
  const selectedChannelLabel = selectedChannel?.name ?? salesChannels[0].name;
  const resolvedMercadoLivreCategoryName =
    form.mercadoLivreOfficialCategoryName.trim() ||
    mercadoLivreAutomation.predictedCategoryName ||
    null;
  const resolvedMercadoLivreCategoryId =
    form.mercadoLivreOfficialCategoryId.trim() ||
    mercadoLivreAutomation.predictedCategoryId ||
    null;
  const heroSaleModeValue = form.isKit
    ? `Kit com ${form.kitQuantity} item(ns)`
    : "Unidade avulsa";
  const heroProductionValue = form.multiplePiecesEnabled
    ? `${form.quantity} peça(s) por ciclo`
    : "1 peça por ciclo";

  useEffect(() => {
    let isMounted = true;

    async function loadExchangeRates() {
      try {
        const response = await fetch("/api/exchange-rates", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as ExchangeRateSnapshot;

        if (isMounted) {
          setExchangeRateSnapshot(payload);
        }
      } catch {
        if (isMounted) {
          setExchangeRateSnapshot(defaultExchangeRateSnapshot);
        }
      }
    }

    loadExchangeRates();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const queuedId = consumeQueuedCalculationEditId();

    if (!queuedId) {
      return;
    }

    const queuedCalculation = getCalculationFromHistory(queuedId);

    if (!queuedCalculation) {
      return;
    }

    queueMicrotask(() => {
      setForm({
        ...initialPricingForm,
        ...queuedCalculation.formSnapshot,
      });
      setDisplayCurrency(queuedCalculation.displayCurrency);
      setExchangeRateSnapshot(queuedCalculation.exchangeRateSnapshot);
      setEditingCalculationId(queuedCalculation.id);
      setSaveState("idle");
    });
  }, []);

  useEffect(() => {
    if (form.salesChannelId !== "mercado-livre") {
      return;
    }

    const price = result.commercialUnitPrice;

    if (price <= 0 || form.productName.trim().length < 3) {
      return;
    }

    const controller = new AbortController();

    const params = new URLSearchParams({
      rootCategoryKey: form.mercadoLivreRootCategoryKey,
      listingTypeId: form.mercadoLivreListingTypeId,
      price: String(price),
      productName: form.productName,
      packageHeightCm: String(form.mercadoLivrePackageHeightCm),
      packageWidthCm: String(form.mercadoLivrePackageWidthCm),
      packageLengthCm: String(form.mercadoLivrePackageLengthCm),
      packageWeightKg: String(form.mercadoLivrePackageWeightKg),
      freeShipping: String(form.mercadoLivreFreeShipping),
    });

    if (form.mercadoLivreOfficialCategoryId) {
      params.set("officialCategoryId", form.mercadoLivreOfficialCategoryId);
    }

    async function run() {
      try {
        const shippingParams = new URLSearchParams({
          height: String(form.mercadoLivrePackageHeightCm),
          width: String(form.mercadoLivrePackageWidthCm),
          length: String(form.mercadoLivrePackageLengthCm),
          weight: String(Math.round(form.mercadoLivrePackageWeightKg * 1000)),
          price: String(price),
          listingTypeId: form.mercadoLivreListingTypeId,
          productName: form.productName,
          freeShipping: String(form.mercadoLivreFreeShipping),
        });

        if (form.mercadoLivreOfficialCategoryId) {
          shippingParams.set("categoryId", form.mercadoLivreOfficialCategoryId);
        }

        const [feesResponse, shippingResponse] = await Promise.all([
          fetch(`/api/marketplaces/mercado-livre/fees?${params.toString()}`, {
            signal: controller.signal,
          }),
          fetch(`/api/meli/free-shipping-cost?${shippingParams.toString()}`, {
            signal: controller.signal,
          }),
        ]);

        if (!feesResponse.ok) {
          return;
        }

        const payload = (await feesResponse.json()) as {
          feePercentage?: number | null;
          fixedFee?: number | null;
          predictedCategory?: {
            id?: string;
            name?: string;
          } | null;
          categoryId?: string;
        };
        const shippingSuccessPayload = shippingResponse.ok
          ? ((await shippingResponse.json()) as {
              freeShippingCost?: number | null;
              categoryId?: string;
            })
          : null;
        const shippingErrorPayload = shippingResponse.ok
          ? null
          : ((await shippingResponse.json().catch(() => null)) as {
              error?: string;
            } | null);
        const shippingFreeCost =
          typeof shippingSuccessPayload?.freeShippingCost === "number"
            ? shippingSuccessPayload.freeShippingCost
            : null;
        const shippingCategoryId =
          typeof shippingSuccessPayload?.categoryId === "string"
            ? shippingSuccessPayload.categoryId
            : null;
        const shippingErrorMessage = shippingErrorPayload?.error ?? null;

        setMercadoLivreAutomation({
          feePercentage:
            typeof payload.feePercentage === "number"
              ? payload.feePercentage
              : null,
          fixedFee:
            typeof payload.fixedFee === "number" ? payload.fixedFee : null,
          shippingEstimate: shippingFreeCost,
          predictedCategoryName: payload.predictedCategory?.name ?? null,
          predictedCategoryId:
            payload.categoryId ??
            shippingCategoryId ??
            payload.predictedCategory?.id ??
            null,
          officialLookupReady: shippingResponse.ok,
          officialLookupError: shippingResponse.ok
            ? null
            : shippingErrorMessage ??
              "Falha ao consultar o frete grátis do Mercado Livre.",
        });

        setForm((current) => {
          const nextCategoryId =
            current.mercadoLivreOfficialCategoryId ||
            payload.categoryId ||
            shippingCategoryId ||
            payload.predictedCategory?.id ||
            "";

          const nextShippingCost = shippingFreeCost ?? current.shippingCost;

          const nextFixedFee =
            typeof payload.fixedFee === "number"
              ? payload.fixedFee
              : current.marketplaceFixedFee;

          if (
            nextCategoryId === current.mercadoLivreOfficialCategoryId &&
            nextShippingCost === current.shippingCost &&
            nextFixedFee === current.marketplaceFixedFee
          ) {
            return current;
          }

          return {
            ...current,
            mercadoLivreOfficialCategoryId: nextCategoryId,
            shippingCost: nextShippingCost,
            marketplaceFixedFee: nextFixedFee,
          };
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMercadoLivreAutomation((current) => ({
            ...current,
            feePercentage:
              current.feePercentage ??
              mercadoLivreFeePreview?.appliedFeePercentage ??
              null,
            officialLookupError:
              current.officialLookupError ??
              "Falha ao consultar o Mercado Livre.",
          }));
        }
      }
    }

    run();

    return () => controller.abort();
  }, [
    form.mercadoLivreListingTypeId,
    form.mercadoLivreOfficialCategoryId,
    form.mercadoLivrePackageHeightCm,
    form.mercadoLivrePackageLengthCm,
    form.mercadoLivrePackageWeightKg,
    form.mercadoLivrePackageWidthCm,
    form.mercadoLivreFreeShipping,
    form.mercadoLivreRootCategoryKey,
    form.productName,
    form.salesChannelId,
    mercadoLivreFeePreview?.appliedFeePercentage,
    result.commercialUnitPrice,
  ]);

  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }

    const timeoutId = window.setTimeout(() => setSaveState("idle"), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [saveState]);

  function updateField(
    field: keyof PricingFormState,
    value: string | number | boolean,
  ) {
    setForm((current) => {
      if (field === "salesChannelId") {
        const nextChannel = findSalesChannelById(String(value));

        return {
          ...current,
          salesChannelId: value as PricingFormState["salesChannelId"],
          marketplaceFeePercentage:
            nextChannel?.marketplaceFeePercentage ??
            current.marketplaceFeePercentage,
          marketplaceFixedFee:
            nextChannel?.marketplaceFixedFee ?? current.marketplaceFixedFee,
        };
      }

      if (field === "productName") {
        return {
          ...current,
          productName: String(value),
          mercadoLivreOfficialCategoryId: "",
          mercadoLivreOfficialCategoryName: "",
        };
      }

      if (field === "pricingMode") {
        return {
          ...current,
          pricingMode: value as PricingFormState["pricingMode"],
        };
      }

      if (field === "printerModel") {
        return {
          ...current,
          printerModel: String(value),
        };
      }

      if (field === "mercadoLivreRootCategoryKey") {
        return {
          ...current,
          mercadoLivreRootCategoryKey:
            value as PricingFormState["mercadoLivreRootCategoryKey"],
          mercadoLivreOfficialCategoryId: "",
          mercadoLivreOfficialCategoryName: "",
        };
      }

      if (field === "mercadoLivreListingTypeId") {
        return {
          ...current,
          mercadoLivreListingTypeId:
            value as PricingFormState["mercadoLivreListingTypeId"],
        };
      }

      if (field === "mercadoLivreOfficialCategoryId") {
        return {
          ...current,
          mercadoLivreOfficialCategoryId: String(value),
        };
      }

      if (field === "mercadoLivreOfficialCategoryName") {
        return {
          ...current,
          mercadoLivreOfficialCategoryName: String(value),
        };
      }

      const currentValue = current[field];

      if (typeof currentValue === "boolean") {
        return {
          ...current,
          [field]: Boolean(value),
        };
      }

      if (typeof currentValue === "number") {
        return {
          ...current,
          [field]: Number(String(value).replace(",", ".")) || 0,
        };
      }

      return {
        ...current,
        [field]: String(value),
      };
    });
  }

  function handleMercadoLivreOfficialCategorySelect(selection: {
    id: string;
    name: string;
    rootCategoryKey: PricingFormState["mercadoLivreRootCategoryKey"] | null;
  }) {
    setForm((current) => ({
      ...current,
      mercadoLivreOfficialCategoryId: selection.id,
      mercadoLivreOfficialCategoryName: selection.name,
      mercadoLivreRootCategoryKey:
        selection.rootCategoryKey ?? current.mercadoLivreRootCategoryKey,
    }));
  }

  function clearMercadoLivreOfficialCategory() {
    setForm((current) => ({
      ...current,
      mercadoLivreOfficialCategoryId: "",
      mercadoLivreOfficialCategoryName: "",
    }));
  }

  function handleSaveCalculation() {
    persistCalculation();
  }

  function persistCalculation() {
    const existingCalculation = editingCalculationId
      ? getCalculationFromHistory(editingCalculationId)
      : null;
    const nextId =
      editingCalculationId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `calc-${Date.now()}`);
    const nextItem = {
      id: nextId,
      savedAt: new Date().toISOString(),
      productName: form.productName.trim() || "Sem nome",
      salesChannelId: form.salesChannelId,
      salesChannelLabel: selectedChannelLabel,
      displayCurrency,
      exchangeRateSnapshot,
      formSnapshot: form,
      summary: {
        salePrice: convertFromBRL(
          viewModel.displayedSalePrice,
          displayCurrency,
          exchangeRateSnapshot.rates,
        ),
        totalCost: convertFromBRL(
          viewModel.unitTotalCost,
          displayCurrency,
          exchangeRateSnapshot.rates,
        ),
        profit: convertFromBRL(
          viewModel.unitProfit,
          displayCurrency,
          exchangeRateSnapshot.rates,
        ),
        marginPercentage: viewModel.realMarginPercentage,
        profitPerHour: convertFromBRL(
          viewModel.profitPerHour,
          displayCurrency,
          exchangeRateSnapshot.rates,
        ),
      },
      siteProduct: existingCalculation?.siteProduct,
    };

    if (editingCalculationId) {
      upsertCalculationInHistory(nextItem);
    } else {
      saveCalculationToHistory(nextItem);
      setEditingCalculationId(nextId);
    }

    setSaveState("saved");

    return nextItem;
  }

  async function handlePublishSiteProduct(
    payload: Omit<SiteProductPublishRequest, "sourceCalculationId">,
  ) {
    const savedCalculation = persistCalculation();
    const requestPayload = {
      ...payload,
      sourceCalculationId: savedCalculation.id,
    };

    if (
      getJsonSizeInBytes(requestPayload) > MAX_SITE_PRODUCT_PUBLISH_PAYLOAD_BYTES
    ) {
      throw new Error(
        "As imagens deixaram a publicacao grande demais para o deploy atual. Remova algumas imagens ou use arquivos menores.",
      );
    }

    const response = await fetch("/api/site-products/publish", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const responsePayload = (await response.json().catch(() => null)) as
      | SiteProductPublishResponse
      | { error?: string }
      | null;

    if (!response.ok || !responsePayload || !("product" in responsePayload)) {
      throw new Error(
        responsePayload && "error" in responsePayload
          ? responsePayload.error ?? "Falha ao criar produto no site."
          : "Falha ao criar produto no site.",
      );
    }

    attachSiteProductToCalculation(savedCalculation.id, {
      id: responsePayload.product.id,
      slug: responsePayload.product.slug,
      url: responsePayload.productUrl,
      publishedAt: new Date().toISOString(),
    });

    return responsePayload;
  }

  async function saveProductToErp(
    payload: Omit<ErpProductSaveRequest, "sourceCalculationId">,
  ) {
    const savedCalculation = persistCalculation();
    const requestPayload: ErpProductSaveRequest = {
      ...payload,
      sourceCalculationId: savedCalculation.id,
    };

    const response = await fetch("/api/erp-products", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });

    const responsePayload = (await response.json().catch(() => null)) as
      | ErpProductSaveResponse
      | { error?: string }
      | null;

    if (!response.ok || !responsePayload || !("product" in responsePayload)) {
      throw new Error(
        responsePayload && "error" in responsePayload
          ? responsePayload.error ?? "Falha ao enviar produto ao ERP."
          : "Falha ao enviar produto ao ERP.",
      );
    }

    return responsePayload;
  }

  return (
    <main className="app-shell min-h-screen text-white">
      <div className="min-h-screen transition-[padding] duration-300 lg:pl-[var(--app-sidebar-width)]">
        <AppSidebar />

        <div>
          <div className="mx-auto max-w-[1720px] px-4 py-6 sm:px-6 xl:px-8">
            <header className="mb-8 border-b border-white/6 pb-6">
              <div className="max-w-[720px]">
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                  Precificadora
                </h1>

                <p className="mt-2 text-sm text-[var(--muted)]">
                  Taxas reais 2026 . {selectedChannelLabel} . simulador de
                  margem
                </p>
              </div>

              <div className="mt-5 grid gap-3 rounded-[24px] border border-white/8 bg-[var(--panel)]/72 p-4 sm:grid-cols-2 xl:grid-cols-3">
                <HeaderMeta
                  label="Canal ativo"
                  value={selectedChannelLabel}
                  tone="accent"
                />
                <HeaderMeta
                  label="Formato de venda"
                  value={heroSaleModeValue}
                />
                <HeaderMeta
                  label="Produção"
                  value={heroProductionValue}
                  tone="success"
                />
              </div>
            </header>

            <section className="grid gap-8 xl:grid-cols-[minmax(0,1.16fr)_minmax(430px,0.84fr)] 2xl:grid-cols-[minmax(0,1fr)_500px]">
              <div className="space-y-6">
                <PricingForm
                  form={form}
                  onChange={updateField}
                  suggestedPrice={viewModel.displayedSalePrice}
                  effectiveMarketplaceFeePercentage={
                    effectiveMarketplaceFeePercentage
                  }
                  mercadoLivrePredictedCategoryName={
                    resolvedMercadoLivreCategoryName
                  }
                  mercadoLivreShippingEstimate={
                    mercadoLivreAutomation.shippingEstimate ?? form.shippingCost
                  }
                  mercadoLivreOfficialLookupReady={
                    mercadoLivreAutomation.officialLookupReady
                  }
                  mercadoLivreOfficialLookupError={
                    mercadoLivreAutomation.officialLookupError
                  }
                  displayCurrency={displayCurrency}
                  onDisplayCurrencyChange={setDisplayCurrency}
                  exchangeRateSnapshot={exchangeRateSnapshot}
                  onMercadoLivreOfficialCategorySelect={
                    handleMercadoLivreOfficialCategorySelect
                  }
                  onMercadoLivreOfficialCategoryClear={
                    clearMercadoLivreOfficialCategory
                  }
                />

                <SiteProductPublisher
                  pricingContext={{
                    productName: form.productName.trim() || "Sem nome",
                    salePriceInCents: Math.round(
                      viewModel.displayedSalePrice * 100,
                    ),
                    totalCostInCents: Math.round(viewModel.unitTotalCost * 100),
                    marginPercentage: viewModel.realMarginPercentage,
                    salesChannelLabel: selectedChannelLabel,
                    productType: form.productType,
                    mercadoLivreCategoryId:
                      resolvedMercadoLivreCategoryId,
                    mercadoLivreCategoryName: resolvedMercadoLivreCategoryName,
                  }}
                  onPublish={handlePublishSiteProduct}
                  onSaveToErp={saveProductToErp}
                />
              </div>

              <PricingResult
                productName={form.productName}
                form={form}
                result={result}
                onFieldChange={updateField}
                selectedChannelLabel={selectedChannelLabel}
                effectiveMarketplaceFeePercentage={
                  effectiveMarketplaceFeePercentage
                }
                mercadoLivrePredictedCategoryName={
                  resolvedMercadoLivreCategoryName
                }
                displayCurrency={displayCurrency}
                exchangeRates={exchangeRateSnapshot.rates}
                onSave={handleSaveCalculation}
                saveButtonLabel={
                  saveState === "saved"
                    ? editingCalculationId
                      ? "Cálculo atualizado"
                      : "Cálculo salvo"
                    : editingCalculationId
                      ? "Atualizar cálculo"
                      : "Salvar cálculo"
                }
              />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

type HeaderMetaProps = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "success";
};

function HeaderMeta({ label, value, tone = "default" }: HeaderMetaProps) {
  const toneClassName = {
    default: "border-white/8 bg-black/10 text-white",
    accent:
      "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]",
    success: "border-[#6fd3ea]/25 bg-[#6fd3ea]/10 text-[#8fe3f6]",
  }[tone];

  return (
    <div className={`rounded-[20px] border px-4 py-4 sm:px-5 ${toneClassName}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--muted)]">
        {label}
      </p>

      <strong className="mt-2 block text-base font-semibold tracking-[-0.03em] sm:text-lg">
        {value}
      </strong>
    </div>
  );
}
