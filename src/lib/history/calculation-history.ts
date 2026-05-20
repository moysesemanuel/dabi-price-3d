import type {
  DisplayCurrency,
  ExchangeRateSnapshot,
} from "@/lib/currency/display-currency";
import type { PricingFormState } from "@/lib/pricing/initial-pricing-form";

export type SavedCalculation = {
  id: string;
  savedAt: string;
  productName: string;
  salesChannelId: PricingFormState["salesChannelId"];
  salesChannelLabel: string;
  displayCurrency: DisplayCurrency;
  exchangeRateSnapshot: ExchangeRateSnapshot;
  formSnapshot: PricingFormState;
  summary: {
    salePrice: number;
    totalCost: number;
    profit: number;
    marginPercentage: number;
    profitPerHour: number;
  };
};

const STORAGE_KEY = "dabi-price-3d:calculation-history";
const MAX_ITEMS = 100;

export function readCalculationHistory() {
  if (typeof window === "undefined") {
    return [] as SavedCalculation[];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [] as SavedCalculation[];
    }

    const parsedValue = JSON.parse(rawValue) as SavedCalculation[];

    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [] as SavedCalculation[];
  }
}

export function saveCalculationToHistory(item: SavedCalculation) {
  const currentItems = readCalculationHistory();
  const nextItems = [item, ...currentItems].slice(0, MAX_ITEMS);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));

  return nextItems;
}

export function clearCalculationHistory() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
