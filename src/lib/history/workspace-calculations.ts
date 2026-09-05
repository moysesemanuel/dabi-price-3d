import type {
  DisplayCurrency,
  ExchangeRateSnapshot,
} from "../currency/display-currency.ts";
import { defaultExchangeRateSnapshot } from "../currency/display-currency.ts";
import {
  hydrateConfectioneryPricingFormState,
  LEGACY_CONFECTIONERY_PRICING_MODEL,
  type ConfectioneryPricingFormState,
} from "../confectionery/calculate-confectionery-price.ts";
import {
  hydratePricingFormState,
  type PricingFormState,
} from "../pricing/initial-pricing-form.ts";

export type CalculationType = "3d" | "confectionery";

export type CalculationSummary = {
  salePrice: number;
  totalCost: number;
  profit: number;
  marginPercentage: number;
  profitPerHour: number;
};

type CalculationLinks = {
  erpProduct?: {
    id: string | null;
    sku: string | null;
    syncedAt: string;
  };
  siteProduct?: {
    id: string;
    slug: string;
    url: string | null;
    publishedAt: string;
  };
};

type BaseSavedCalculation = CalculationLinks & {
  id: string;
  kind: CalculationType;
  savedAt: string;
  productName: string;
  salesChannelId: string;
  salesChannelLabel: string;
  displayCurrency: DisplayCurrency;
  exchangeRateSnapshot: ExchangeRateSnapshot;
  summary: CalculationSummary;
};

export type Saved3DCalculation = BaseSavedCalculation & {
  kind: "3d";
  formSnapshot: PricingFormState;
};

export type SavedConfectioneryCalculation = BaseSavedCalculation & {
  kind: "confectionery";
  confectionerySnapshot: ConfectioneryPricingFormState;
};

export type SavedCalculation = Saved3DCalculation | SavedConfectioneryCalculation;

export function is3DCalculation(
  value: SavedCalculation | null | undefined,
): value is Saved3DCalculation {
  return value?.kind === "3d";
}

export function isConfectioneryCalculation(
  value: SavedCalculation | null | undefined,
): value is SavedConfectioneryCalculation {
  return value?.kind === "confectionery";
}

export function normalizeSavedCalculation(value: unknown): SavedCalculation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<SavedCalculation> & {
    formSnapshot?: PricingFormState;
    confectionerySnapshot?: ConfectioneryPricingFormState;
  };
  const kind = item.kind === "confectionery" ? "confectionery" : "3d";
  const baseCalculation = {
    id: typeof item.id === "string" ? item.id.trim() : "",
    kind,
    savedAt: normalizeDate(item.savedAt),
    productName:
      typeof item.productName === "string" && item.productName.trim().length > 0
        ? item.productName.trim()
        : "Sem nome",
    salesChannelId:
      typeof item.salesChannelId === "string" ? item.salesChannelId : "",
    salesChannelLabel:
      typeof item.salesChannelLabel === "string" && item.salesChannelLabel.trim().length > 0
        ? item.salesChannelLabel.trim()
        : kind === "confectionery"
          ? "Venda direta"
          : "Canal não informado",
    displayCurrency:
      item.displayCurrency === "USD" || item.displayCurrency === "EUR"
        ? item.displayCurrency
        : "BRL",
    exchangeRateSnapshot: normalizeExchangeRateSnapshot(item.exchangeRateSnapshot),
    summary: normalizeCalculationSummary(item.summary),
    erpProduct: normalizeErpProduct(item.erpProduct),
    siteProduct: normalizeSiteProduct(item.siteProduct),
  } satisfies BaseSavedCalculation;

  if (!baseCalculation.id) {
    return null;
  }

  if (kind === "confectionery") {
    return {
      ...baseCalculation,
      kind: "confectionery",
      // Registro sem pricingModel foi salvo antes de 05/09/2026: reabre no
      // modelo daquela epoca, para o preco continuar sendo o que a pessoa
      // cobrou. O resumo guardado nunca e recalculado.
      confectionerySnapshot: hydrateConfectioneryPricingFormState({
        ...item.confectionerySnapshot,
        pricingModel:
          item.confectionerySnapshot?.pricingModel ??
          LEGACY_CONFECTIONERY_PRICING_MODEL,
      }),
    };
  }

  return {
    ...baseCalculation,
    kind: "3d",
    formSnapshot: hydratePricingFormState(item.formSnapshot),
  };
}

function normalizeDate(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : new Date().toISOString();
}

function normalizeCalculationSummary(value: unknown): CalculationSummary {
  const summary = (value ?? {}) as Partial<CalculationSummary>;

  return {
    salePrice: normalizeNumber(summary.salePrice),
    totalCost: normalizeNumber(summary.totalCost),
    profit: normalizeNumber(summary.profit),
    marginPercentage: normalizeNumber(summary.marginPercentage),
    profitPerHour: normalizeNumber(summary.profitPerHour),
  };
}

function normalizeExchangeRateSnapshot(value: unknown): ExchangeRateSnapshot {
  const snapshot = value as Partial<ExchangeRateSnapshot> | null | undefined;

  if (
    snapshot &&
    typeof snapshot === "object" &&
    typeof snapshot.date === "string" &&
    snapshot.rates &&
    typeof snapshot.rates === "object"
  ) {
    return {
      base: "BRL",
      date: snapshot.date,
      rates: {
        BRL: normalizeNumber(snapshot.rates.BRL, 1),
        USD: normalizeNumber(snapshot.rates.USD, defaultExchangeRateSnapshot.rates.USD),
        EUR: normalizeNumber(snapshot.rates.EUR, defaultExchangeRateSnapshot.rates.EUR),
      },
      sourceLabel:
        typeof snapshot.sourceLabel === "string"
          ? snapshot.sourceLabel
          : defaultExchangeRateSnapshot.sourceLabel,
      sourceUrl:
        typeof snapshot.sourceUrl === "string"
          ? snapshot.sourceUrl
          : defaultExchangeRateSnapshot.sourceUrl,
    };
  }

  return defaultExchangeRateSnapshot;
}

function normalizeErpProduct(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const erpProduct = value as {
    id?: string | null;
    sku?: string | null;
    syncedAt?: string;
  };

  return {
    id: typeof erpProduct.id === "string" ? erpProduct.id : null,
    sku: typeof erpProduct.sku === "string" ? erpProduct.sku : null,
    syncedAt: normalizeDate(erpProduct.syncedAt),
  };
}

function normalizeSiteProduct(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const siteProduct = value as {
    id?: string;
    slug?: string;
    url?: string | null;
    publishedAt?: string;
  };

  if (typeof siteProduct.id !== "string" || typeof siteProduct.slug !== "string") {
    return undefined;
  }

  return {
    id: siteProduct.id,
    slug: siteProduct.slug,
    url: typeof siteProduct.url === "string" ? siteProduct.url : null,
    publishedAt: normalizeDate(siteProduct.publishedAt),
  };
}

function normalizeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
