"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BusinessSetupModal } from "@/components/app/business-setup-modal";
import { ConfectioneryPricingWorkspace } from "@/components/confectionery/confectionery-pricing-workspace";
import { PricingForm } from "@/components/pricing/pricing-form";
import { PricingResult } from "@/components/pricing/pricing-result";
import { SiteProductPublisher } from "@/components/pricing/site-product-publisher";
import {
  appendRequestIdToMessage,
  buildApiErrorMessage,
  extractApiRequestId,
} from "@/lib/client/api-feedback";
import {
  convertFromBRL,
  defaultExchangeRateSnapshot,
  type DisplayCurrency,
  type ExchangeRateSnapshot,
} from "@/lib/currency/display-currency";
import {
  attachErpProductToCalculation,
  consumeQueuedCalculationEditId,
  getCalculationFromHistory,
  loadCalculationHistory,
  saveCalculationToHistory,
  upsertCalculationInHistory,
} from "@/lib/history/calculation-history";
import {
  is3DCalculation,
  isConfectioneryCalculation,
  type SavedConfectioneryCalculation,
} from "@/lib/history/workspace-calculations";
import { getMercadoLivreFeePreview } from "@/lib/marketplaces/mercado-livre";
import { resolveShopeeFeeConfigForPrice } from "@/lib/marketplaces/shopee";
import { calculate3DPrice } from "@/lib/pricing/calculate-3d-price";
import { buildPricingViewModel } from "@/lib/pricing/build-pricing-view-model";
import {
  hydratePricingFormState,
  initialPricingForm,
  type FilamentRequirementInput,
  type PricingFormState,
} from "@/lib/pricing/initial-pricing-form";
import {
  buildErpFilamentRequirements,
  createFilamentRequirementInput,
  getFilamentRequirementsValidationMessage,
  normalizeFilamentRequirementInputs,
  sumFilamentRequirementInputWeights,
} from "@/lib/pricing/filament-requirements";
import {
  findSalesChannelById,
} from "@/lib/pricing/sales-channels";
import {
  ERP_PRODUCT_PAYLOAD_VERSION,
  type ErpProductSaveRequest,
  type ErpProductSaveResponse,
} from "@/lib/erp-products/types";
import {
  applyPreferencesToForm,
  businessTypeMeta,
  getBusinessPreset,
  loadAppPreferences,
  readAppPreferences,
  subscribeAppPreferences,
  writeAppPreferences,
  type AppPreferences,
} from "@/lib/settings/app-preferences";

type MercadoLivreAutomationState = {
  isLoading: boolean;
  feePercentage: number | null;
  fixedFee: number | null;
  shippingEstimate: number | null;
  predictedCategoryName: string | null;
  predictedCategoryId: string | null;
  officialLookupReady: boolean;
  officialLookupError: string | null;
  officialLookupRequestId: string | null;
};

type MercadoLivreManualOverrides = {
  feePercentage: boolean;
  shippingCost: boolean;
};

type MercadoLivreLookupContext = {
  canRun: boolean;
  missingRequirements: string[];
};

type SaveState = "idle" | "saved";

function resolveShopeeFeeConfig(form: PricingFormState) {
  let currentConfig = resolveShopeeFeeConfigForPrice({
    salePrice: form.manualSalePrice > 0 ? form.manualSalePrice : 79.99,
    sellerType: form.shopeeSellerType,
    featuredCampaign: form.shopeeFeaturedCampaign,
  });

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const simulatedResult = calculate3DPrice({
      ...form,
      marketplaceFeePercentage: currentConfig.percentage,
      marketplaceFixedFee: currentConfig.fixedFee,
    });

    const simulatedSalePrice = simulatedResult.finalPrice;
    const nextConfig = resolveShopeeFeeConfigForPrice({
      salePrice: simulatedSalePrice,
      sellerType: form.shopeeSellerType,
      featuredCampaign: form.shopeeFeaturedCampaign,
    });

    if (
      nextConfig.percentage === currentConfig.percentage &&
      nextConfig.fixedFee === currentConfig.fixedFee
    ) {
      return nextConfig;
    }

    currentConfig = nextConfig;
  }

  return currentConfig;
}

export default function Home() {
  const [form, setForm] = useState<PricingFormState>(() => {
    const preferences = readAppPreferences();
    const hydratedForm = {
      ...hydratePricingFormState(),
      filamentRequirements: normalizeFilamentRequirementInputs(
        initialPricingForm.filamentRequirements,
        initialPricingForm.weightGrams,
      ),
    };

    return applyPreferencesToForm(hydratedForm, preferences);
  });
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>(
    () => readAppPreferences().defaultDisplayCurrency,
  );
  const [exchangeRateSnapshot, setExchangeRateSnapshot] =
    useState<ExchangeRateSnapshot>(defaultExchangeRateSnapshot);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [editingCalculationId, setEditingCalculationId] = useState<
    string | null
  >(null);
  const [editingConfectioneryCalculation, setEditingConfectioneryCalculation] =
    useState<SavedConfectioneryCalculation | null>(null);
  const [appPreferences, setAppPreferences] = useState<AppPreferences>(() =>
    readAppPreferences(),
  );
  const [isBusinessSetupOpen, setIsBusinessSetupOpen] = useState(
    () =>
      !readAppPreferences().onboardingCompleted ||
      readAppPreferences().businessType === null,
  );

  const [mercadoLivreAutomation, setMercadoLivreAutomation] =
    useState<MercadoLivreAutomationState>({
      isLoading: false,
      feePercentage: null,
      fixedFee: null,
      shippingEstimate: null,
      predictedCategoryName: null,
      predictedCategoryId: null,
      officialLookupReady: false,
      officialLookupError: null,
      officialLookupRequestId: null,
    });
  const [mercadoLivreManualOverrides, setMercadoLivreManualOverrides] =
    useState<MercadoLivreManualOverrides>({
      feePercentage: false,
      shippingCost: false,
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

  const shopeeFeeConfig = useMemo(() => {
    if (form.salesChannelId !== "shopee") {
      return null;
    }

    return resolveShopeeFeeConfig(form);
  }, [form]);

  const effectiveMarketplaceFeePercentage =
    form.salesChannelId === "mercado-livre"
      ? form.marketplaceFeePercentage
      : form.salesChannelId === "shopee"
        ? shopeeFeeConfig?.percentage ?? form.marketplaceFeePercentage
        : form.salesChannelId === "consignment"
        ? form.consignmentCommissionPercentage
      : form.marketplaceFeePercentage;

  const effectiveMarketplaceFixedFee =
    form.salesChannelId === "mercado-livre"
      ? mercadoLivreAutomation.fixedFee ?? form.marketplaceFixedFee
      : form.salesChannelId === "shopee"
        ? shopeeFeeConfig?.fixedFee ?? form.marketplaceFixedFee
      : form.marketplaceFixedFee;

  const effectiveForm = useMemo(
    () => ({
      ...form,
      marketplaceFeePercentage: effectiveMarketplaceFeePercentage,
      marketplaceFixedFee: effectiveMarketplaceFixedFee,
    }),
    [effectiveMarketplaceFeePercentage, effectiveMarketplaceFixedFee, form],
  );

  const result = useMemo(() => calculate3DPrice(effectiveForm), [effectiveForm]);
  const viewModel = useMemo(
    () => buildPricingViewModel(form, result),
    [form, result],
  );
  const filamentRequirementsForErp = useMemo(
    () => buildErpFilamentRequirements(form),
    [form],
  );
  const filamentRequirementsValidationMessage = useMemo(
    () => getFilamentRequirementsValidationMessage(form),
    [form],
  );
  const filamentRequirementsInputWeightTotal = useMemo(
    () => sumFilamentRequirementInputWeights(form.filamentRequirements),
    [form.filamentRequirements],
  );
  const preferredFilamentRequirement = useMemo(
    () =>
      form.filamentRequirements.find(
        (requirement) =>
          requirement.material.trim().length > 0 ||
          requirement.colorHex.trim().length > 0,
      ) ?? null,
    [form.filamentRequirements],
  );

  const selectedChannel = findSalesChannelById(form.salesChannelId);
  const selectedChannelLabel = selectedChannel?.name ?? "Selecione o canal";
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
  const activeBusinessType = appPreferences.businessType;
  const activeBusinessMeta = activeBusinessType
    ? businessTypeMeta[activeBusinessType]
    : null;
  const mercadoLivreLookupContext = useMemo<MercadoLivreLookupContext>(() => {
    const missingRequirements: string[] = [];

    if (form.productName.trim().length < 3) {
      missingRequirements.push("nome do produto com pelo menos 3 caracteres");
    }

    if (viewModel.displayedSalePrice <= 0) {
      missingRequirements.push("preço de venda maior que zero");
    }

    if (form.mercadoLivrePackageHeightCm <= 0) {
      missingRequirements.push("altura da embalagem");
    }

    if (form.mercadoLivrePackageWidthCm <= 0) {
      missingRequirements.push("largura da embalagem");
    }

    if (form.mercadoLivrePackageLengthCm <= 0) {
      missingRequirements.push("comprimento da embalagem");
    }

    if (form.mercadoLivrePackageWeightKg <= 0) {
      missingRequirements.push("peso com embalagem");
    }

    return {
      canRun:
        form.salesChannelId === "mercado-livre" &&
        missingRequirements.length === 0,
      missingRequirements,
    };
  }, [
    form.mercadoLivrePackageHeightCm,
    form.mercadoLivrePackageLengthCm,
    form.mercadoLivrePackageWeightKg,
    form.mercadoLivrePackageWidthCm,
    form.productName,
    form.salesChannelId,
    viewModel.displayedSalePrice,
  ]);

  useEffect(() => {
    let isMounted = true;

    void loadAppPreferences()
      .then((preferences) => {
        if (!isMounted) {
          return;
        }

        setAppPreferences(preferences);
        setDisplayCurrency(preferences.defaultDisplayCurrency);
        setIsBusinessSetupOpen(
          !preferences.onboardingCompleted || preferences.businessType === null,
        );
        setForm((current) =>
          editingCalculationId || current.productName.trim().length > 0
            ? current
            : applyPreferencesToForm(current, preferences),
        );
      })
      .catch(() => undefined);

    const unsubscribe = subscribeAppPreferences(() => {
      const preferences = readAppPreferences();

      setAppPreferences(preferences);
      setIsBusinessSetupOpen(
        !preferences.onboardingCompleted || preferences.businessType === null,
      );
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [editingCalculationId]);

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
    let isMounted = true;

    void (async () => {
      const queuedId = consumeQueuedCalculationEditId();

      if (!queuedId) {
        return;
      }

      await loadCalculationHistory().catch(() => undefined);

      const queuedCalculation = getCalculationFromHistory(queuedId);

      if (!queuedCalculation || !isMounted) {
        return;
      }

      queueMicrotask(() => {
        if (isConfectioneryCalculation(queuedCalculation)) {
          setEditingConfectioneryCalculation(queuedCalculation);
          setEditingCalculationId(null);
          setSaveState("idle");
          return;
        }

        if (!is3DCalculation(queuedCalculation)) {
          return;
        }

        const hydratedSnapshot = hydratePricingFormState(
          queuedCalculation.formSnapshot,
        );

        setForm({
          ...hydratedSnapshot,
          filamentRequirements: normalizeFilamentRequirementInputs(
            hydratedSnapshot.filamentRequirements,
            hydratedSnapshot.weightGrams,
          ),
        });
        setDisplayCurrency(queuedCalculation.displayCurrency);
        setExchangeRateSnapshot(queuedCalculation.exchangeRateSnapshot);
        setEditingCalculationId(queuedCalculation.id);
        setEditingConfectioneryCalculation(null);
        setMercadoLivreManualOverrides({
          feePercentage: true,
          shippingCost: true,
        });
        setSaveState("idle");
      });
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mercadoLivreLookupContext.canRun) {
      return;
    }

    const price = viewModel.displayedSalePrice;

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
      setMercadoLivreAutomation((current) => ({
        ...current,
        isLoading: true,
        officialLookupError: null,
        officialLookupRequestId: null,
      }));

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
          shippingEstimate?: number | null;
          officialLookupReady?: boolean;
          officialLookupError?: string | null;
          requestId?: string | null;
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
              requestId?: string | null;
            })
          : null;
        const shippingErrorPayload = shippingResponse.ok
          ? null
          : ((await shippingResponse.json().catch(() => null)) as {
              error?: string;
              requestId?: string | null;
            } | null);
        const shippingFreeCostFromDedicatedRoute =
          typeof shippingSuccessPayload?.freeShippingCost === "number"
            ? shippingSuccessPayload.freeShippingCost
            : null;
        const shippingFreeCostFromFeesRoute =
          typeof payload.shippingEstimate === "number"
            ? payload.shippingEstimate
            : null;
        const shippingFreeCost =
          shippingFreeCostFromDedicatedRoute ?? shippingFreeCostFromFeesRoute;
        const nextFeePercentage =
          typeof payload.feePercentage === "number"
            ? payload.feePercentage
            : (mercadoLivreFeePreview?.appliedFeePercentage ?? null);
        const shippingCategoryId =
          typeof shippingSuccessPayload?.categoryId === "string"
            ? shippingSuccessPayload.categoryId
            : null;
        const shippingErrorMessage = shippingErrorPayload?.error ?? null;
        const feesRequestId = extractApiRequestId(feesResponse, payload);
        const shippingRequestId = shippingResponse.ok
          ? extractApiRequestId(shippingResponse, shippingSuccessPayload)
          : extractApiRequestId(shippingResponse, shippingErrorPayload);
        const resolvedOfficialLookupError =
          payload.officialLookupError
            ? appendRequestIdToMessage(payload.officialLookupError, feesRequestId)
            : shippingResponse.ok
              ? null
              : appendRequestIdToMessage(
                  shippingErrorMessage ??
                    "Falha ao consultar o frete grátis do Mercado Livre.",
                  shippingRequestId,
                );
        const resolvedOfficialLookupRequestId =
          (payload.officialLookupError ? feesRequestId : null) ??
          (!shippingResponse.ok ? shippingRequestId : null) ??
          null;

        setMercadoLivreAutomation({
          isLoading: false,
          feePercentage: nextFeePercentage,
          fixedFee:
            typeof payload.fixedFee === "number" ? payload.fixedFee : null,
          shippingEstimate: shippingFreeCost,
          predictedCategoryName: payload.predictedCategory?.name ?? null,
          predictedCategoryId:
            payload.categoryId ??
            shippingCategoryId ??
            payload.predictedCategory?.id ??
            null,
          officialLookupReady:
            payload.officialLookupReady === true || shippingResponse.ok,
          officialLookupError: resolvedOfficialLookupError,
          officialLookupRequestId: resolvedOfficialLookupRequestId,
        });

        setForm((current) => {
          const nextCategoryId =
            current.mercadoLivreOfficialCategoryId ||
            payload.categoryId ||
            shippingCategoryId ||
            payload.predictedCategory?.id ||
            "";
          const nextShippingCost = mercadoLivreManualOverrides.shippingCost
            ? current.shippingCost
            : (shippingFreeCost ?? current.shippingCost);
          const nextMarketplaceFeePercentage =
            mercadoLivreManualOverrides.feePercentage
              ? current.marketplaceFeePercentage
              : (nextFeePercentage ?? current.marketplaceFeePercentage);

          const nextFixedFee =
            typeof payload.fixedFee === "number"
              ? payload.fixedFee
              : current.marketplaceFixedFee;

          if (
            nextCategoryId === current.mercadoLivreOfficialCategoryId &&
            nextMarketplaceFeePercentage === current.marketplaceFeePercentage &&
            nextShippingCost === current.shippingCost &&
            nextFixedFee === current.marketplaceFixedFee
          ) {
            return current;
          }

          return {
            ...current,
            mercadoLivreOfficialCategoryId: nextCategoryId,
            marketplaceFeePercentage: nextMarketplaceFeePercentage,
            shippingCost: nextShippingCost,
            marketplaceFixedFee: nextFixedFee,
          };
        });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMercadoLivreAutomation((current) => ({
            ...current,
            isLoading: false,
            feePercentage:
              current.feePercentage ??
              mercadoLivreFeePreview?.appliedFeePercentage ??
              null,
            officialLookupRequestId: current.officialLookupRequestId,
            officialLookupError:
              current.officialLookupError ??
              "Falha ao consultar o Mercado Livre.",
          }));
        }
      } finally {
        setMercadoLivreAutomation((current) =>
          current.isLoading ? { ...current, isLoading: false } : current,
        );
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
    mercadoLivreFeePreview?.appliedFeePercentage,
    mercadoLivreLookupContext.canRun,
    mercadoLivreManualOverrides.feePercentage,
    mercadoLivreManualOverrides.shippingCost,
    viewModel.displayedSalePrice,
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
        setMercadoLivreManualOverrides({
          feePercentage: false,
          shippingCost: false,
        });

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

      if (field === "marketplaceFeePercentage") {
        setMercadoLivreManualOverrides((currentOverrides) => ({
          ...currentOverrides,
          feePercentage: true,
        }));
      }

      if (field === "shippingCost") {
        setMercadoLivreManualOverrides((currentOverrides) => ({
          ...currentOverrides,
          shippingCost: true,
        }));
      }

      if (typeof currentValue === "boolean") {
        return {
          ...current,
          [field]: Boolean(value),
        };
      }

      if (typeof currentValue === "number") {
        const normalizedValue = Number(String(value).replace(",", ".")) || 0;

        return {
          ...current,
          [field]: normalizedValue,
          ...(field === "weightGrams" && current.filamentRequirements.length === 1
            ? {
                filamentRequirements: [
                  {
                    ...current.filamentRequirements[0],
                    weightGrams: normalizedValue,
                  },
                ],
              }
            : {}),
        };
      }

      return {
        ...current,
        [field]: String(value),
      };
    });
  }

  function updateFilamentRequirement(
    index: number,
    field: keyof FilamentRequirementInput,
    value: string | number,
  ) {
    setForm((current) => ({
      ...current,
      filamentRequirements: current.filamentRequirements.map(
        (requirement, requirementIndex) => {
          if (requirementIndex !== index) {
            return requirement;
          }

          if (field === "weightGrams") {
            return {
              ...requirement,
              weightGrams: Number(String(value).replace(",", ".")) || 0,
            };
          }

          return {
            ...requirement,
            [field]: String(value),
          };
        },
      ),
    }));
  }

  function addFilamentRequirement() {
    setForm((current) => ({
      ...current,
      filamentRequirements: [
        ...current.filamentRequirements,
        createFilamentRequirementInput(),
      ],
    }));
  }

  function removeFilamentRequirement(index: number) {
    setForm((current) => {
      const nextRequirements = current.filamentRequirements.filter(
        (_, requirementIndex) => requirementIndex !== index,
      );

      if (nextRequirements.length === 0) {
        return {
          ...current,
          filamentRequirements: [
            createFilamentRequirementInput(current.weightGrams),
          ],
        };
      }

      if (nextRequirements.length === 1) {
        const [singleRequirement] = nextRequirements;

        return {
          ...current,
          filamentRequirements: [
            {
              ...singleRequirement,
              weightGrams:
                singleRequirement.weightGrams > 0
                  ? singleRequirement.weightGrams
                  : current.weightGrams,
            },
          ],
        };
      }

      return {
        ...current,
        filamentRequirements: nextRequirements,
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
    void persistCalculation();
  }

  async function persistCalculation() {
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
      kind: "3d" as const,
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
      erpProduct: is3DCalculation(existingCalculation)
        ? existingCalculation.erpProduct
        : undefined,
      siteProduct: is3DCalculation(existingCalculation)
        ? existingCalculation.siteProduct
        : undefined,
    };

    if (editingCalculationId) {
      await upsertCalculationInHistory(nextItem);
    } else {
      await saveCalculationToHistory(nextItem);
      setEditingCalculationId(nextId);
    }

    setSaveState("saved");

    return nextItem;
  }

  async function saveProductToErp(
    payload: Omit<ErpProductSaveRequest, "sourceCalculationId">,
  ) {
    const savedCalculation = await persistCalculation();
    const requestPayload: ErpProductSaveRequest = {
      ...payload,
      sourceCalculationId: savedCalculation.id,
      payloadVersion: ERP_PRODUCT_PAYLOAD_VERSION,
      pricingMetadata: {
        calculatedAt: savedCalculation.savedAt,
        sourceSalesChannelId: form.salesChannelId || null,
        sourceSalesChannelLabel: selectedChannelLabel,
        displayCurrency,
        exchangeRateDate: exchangeRateSnapshot.date,
        productType: form.productType,
        salePriceInCents: Math.round(viewModel.displayedSalePrice * 100),
        totalCostInCents: Math.round(viewModel.unitTotalCost * 100),
        profitInCents: Math.round(viewModel.unitProfit * 100),
        profitPerHourInCents: Math.round(viewModel.profitPerHour * 100),
        marginPercentage: viewModel.realMarginPercentage,
      },
      tenantContext: null,
      publishToMercadoLivre: payload.publishToMercadoLivre === true,
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
      | { error?: string; requestId?: string | null }
      | null;

    if (!response.ok || !responsePayload || !("product" in responsePayload)) {
      throw new Error(
        buildApiErrorMessage({
          response,
          payload:
            responsePayload && "error" in responsePayload ? responsePayload : null,
          fallback: "Falha ao enviar produto ao ERP.",
        }),
      );
    }

    await attachErpProductToCalculation(savedCalculation.id, {
      id:
        typeof responsePayload.product.id === "string"
          ? responsePayload.product.id
          : null,
      sku:
        typeof responsePayload.product.sku === "string"
          ? responsePayload.product.sku
          : null,
      syncedAt: new Date().toISOString(),
    });

    return responsePayload;
  }

  return (
    <>
      <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 xl:px-8 xl:py-8">
        <header className="mb-8 border-b border-[var(--panel-border)] pb-6">
          <div className="max-w-[860px]">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-[var(--accent)]">
              {appPreferences.workspaceName}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[var(--foreground)] sm:text-5xl">
              {activeBusinessMeta
                ? `Precificadora de ${activeBusinessMeta.label}`
                : "Precificadora"}
            </h1>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {activeBusinessMeta ? (
              <HeroChip
                label={`Ramo: ${activeBusinessMeta.label}`}
                tone="accent"
              />
            ) : null}
            <HeroChip
              label={`Perfil: ${getBusinessPreset(appPreferences.businessPresetId).label}`}
              tone="default"
            />
            {selectedChannel ? (
              <HeroChip label={`Canal: ${selectedChannelLabel}`} tone="accent" />
            ) : null}
            <HeroChip label={heroSaleModeValue} />
            <HeroChip label={heroProductionValue} tone="success" />
          </div>
        </header>

        {activeBusinessType === "confectionery" && activeBusinessMeta ? (
          <ConfectioneryWorkspacePreview
            key={editingConfectioneryCalculation?.id ?? "confectionery-new"}
            workspaceName={appPreferences.workspaceName}
            profileLabel={getBusinessPreset(appPreferences.businessPresetId).label}
            defaultMarginPercentage={
              appPreferences.pricingDefaults.profitMarginPercentage
            }
            initialCalculation={editingConfectioneryCalculation}
            onPersisted={(calculation) => {
              setEditingConfectioneryCalculation(calculation);
            }}
          />
        ) : activeBusinessMeta && !activeBusinessMeta.calculatorReady ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.06fr)_360px]">
            <div className="app-card p-6 sm:p-7">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                Estrutura do ramo
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                {activeBusinessMeta.label} já está definido para esta conta
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                O workspace foi configurado para {activeBusinessMeta.label.toLowerCase()}.
                Como os nichos são distintos, eu preservo essa escolha e não mostro
                a calculadora de impressão 3D em cima de um negócio de outro ramo.
              </p>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <BusinessTypeInfoCard
                  label="Como este ramo precifica"
                  value={activeBusinessMeta.description}
                />
                <BusinessTypeInfoCard
                  label="Templates planejados"
                  value={activeBusinessMeta.templatesSummary}
                />
              </div>
            </div>

            <aside className="app-card-soft p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                Próximos destinos
              </p>
              <div className="mt-4 grid gap-3">
                <InlineActionCard
                  href="/app/modelos-orcamento"
                  title="Modelos do ramo"
                  description="Os modelos da conta já podem seguir a linguagem do nicho escolhido."
                />
                <InlineActionCard
                  href="/app/perfil-empresa"
                  title="Perfil da empresa"
                  description="Complete logo, contato, cidade e dados comerciais do negócio."
                />
                <InlineActionCard
                  href="/app/preferencias"
                  title="Política comercial"
                  description="Ajuste moeda, preset e parâmetros operacionais padrão."
                />
              </div>
            </aside>
          </section>
        ) : (
          <section className="grid gap-8 xl:grid-cols-[minmax(0,1.14fr)_minmax(420px,0.86fr)] 2xl:grid-cols-[minmax(0,1fr)_500px]">
            <div className="space-y-6">
              <PricingForm
                form={form}
                onChange={updateField}
                onFilamentRequirementChange={updateFilamentRequirement}
                onAddFilamentRequirement={addFilamentRequirement}
                onRemoveFilamentRequirement={removeFilamentRequirement}
                suggestedPrice={viewModel.displayedSalePrice}
                effectiveMarketplaceFeePercentage={
                  effectiveMarketplaceFeePercentage
                }
                mercadoLivreSuggestedFeePercentage={
                  mercadoLivreAutomation.feePercentage ??
                  mercadoLivreFeePreview?.appliedFeePercentage ??
                  null
                }
                mercadoLivrePredictedCategoryName={resolvedMercadoLivreCategoryName}
                mercadoLivreShippingEstimate={mercadoLivreAutomation.shippingEstimate}
                mercadoLivreIsLoading={mercadoLivreAutomation.isLoading}
                mercadoLivreCanRunLookup={mercadoLivreLookupContext.canRun}
                mercadoLivreMissingLookupRequirements={
                  mercadoLivreLookupContext.missingRequirements
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
                  salePriceInCents: Math.round(viewModel.displayedSalePrice * 100),
                  totalCostInCents: Math.round(viewModel.unitTotalCost * 100),
                  profitInCents: Math.round(viewModel.unitProfit * 100),
                  marginPercentage: viewModel.realMarginPercentage,
                  salesChannelLabel: selectedChannelLabel,
                  salesChannelId: form.salesChannelId,
                  productType: form.productType,
                  displayCurrency,
                  exchangeRateDate: exchangeRateSnapshot.date,
                  filamentRequirements: filamentRequirementsForErp,
                  filamentRequirementsValidationMessage:
                    filamentRequirementsValidationMessage,
                  filamentRequirementsInputWeightTotal:
                    filamentRequirementsInputWeightTotal,
                  filamentWeightReferenceGrams: form.weightGrams,
                  preferredFilamentMaterial:
                    preferredFilamentRequirement?.material ?? null,
                  mercadoLivreCategoryId: resolvedMercadoLivreCategoryId,
                  mercadoLivreCategoryName: resolvedMercadoLivreCategoryName,
                }}
                onSaveToErp={saveProductToErp}
              />
            </div>

            <PricingResult
              productName={form.productName}
              form={form}
              result={result}
              profitDestinations={appPreferences.profitDestinations}
              onFieldChange={updateField}
              selectedChannelLabel={selectedChannelLabel}
              effectiveMarketplaceFeePercentage={effectiveMarketplaceFeePercentage}
              effectiveMarketplaceFixedFee={effectiveMarketplaceFixedFee}
              mercadoLivrePredictedCategoryName={resolvedMercadoLivreCategoryName}
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
        )}
      </div>

      <BusinessSetupModal
        open={isBusinessSetupOpen}
        onComplete={(preferences) => {
          void (async () => {
            const savedPreferences = await writeAppPreferences(preferences);

            setAppPreferences(savedPreferences);
            setDisplayCurrency(savedPreferences.defaultDisplayCurrency);
            setForm((current) => applyPreferencesToForm(current, savedPreferences));
            setIsBusinessSetupOpen(false);
          })();
        }}
      />
    </>
  );
}

function HeroChip({
  label,
  tone = "default",
}: {
  label: string;
  tone?: "default" | "accent" | "success";
}) {
  const toneClassName = {
    default: "border-[var(--panel-border)] bg-[rgba(255,255,255,0.86)] text-[var(--foreground)]",
    accent:
      "border-[var(--accent)] bg-[var(--accent)] text-white",
    success: "border-[var(--panel-border)] bg-[var(--panel-soft)] text-[var(--foreground)]",
  }[tone];

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-2 text-sm ${toneClassName}`}
    >
      {label}
    </span>
  );
}

function BusinessTypeInfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] px-5 py-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-3 text-sm leading-7 text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function ConfectioneryWorkspacePreview({
  workspaceName,
  profileLabel,
  defaultMarginPercentage,
  initialCalculation,
  onPersisted,
}: {
  workspaceName: string;
  profileLabel: string;
  defaultMarginPercentage: number;
  initialCalculation?: SavedConfectioneryCalculation | null;
  onPersisted?: (calculation: SavedConfectioneryCalculation) => void;
}) {
  return (
    <ConfectioneryPricingWorkspace
      workspaceName={workspaceName}
      profileLabel={profileLabel}
      defaultMarginPercentage={defaultMarginPercentage}
      initialCalculation={initialCalculation}
      onPersisted={onPersisted}
    />
  );
}

function InlineActionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[22px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-4 transition hover:border-[var(--accent)]"
    >
      <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
