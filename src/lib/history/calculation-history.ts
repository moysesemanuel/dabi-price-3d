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
  siteProduct?: {
    id: string;
    slug: string;
    url: string | null;
    publishedAt: string;
  };
};

const STORAGE_KEY = "dabi-price-3d:calculation-history";
const EDITING_ID_STORAGE_KEY = "dabi-price-3d:editing-calculation-id";
const HISTORY_EVENT = "dabi-price-3d:calculation-history-updated";
const MAX_ITEMS = 100;

function writeCalculationHistory(items: SavedCalculation[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

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

  writeCalculationHistory(nextItems);

  return nextItems;
}

export function upsertCalculationInHistory(item: SavedCalculation) {
  const currentItems = readCalculationHistory().filter(
    (currentItem) => currentItem.id !== item.id,
  );
  const nextItems = [item, ...currentItems].slice(0, MAX_ITEMS);

  writeCalculationHistory(nextItems);

  return nextItems;
}

export function attachSiteProductToCalculation(
  calculationId: string,
  siteProduct: NonNullable<SavedCalculation["siteProduct"]>,
) {
  const currentItem = getCalculationFromHistory(calculationId);

  if (!currentItem) {
    return null;
  }

  const nextItem = {
    ...currentItem,
    siteProduct,
  };

  upsertCalculationInHistory(nextItem);

  return nextItem;
}

export function clearCalculationHistory() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export function deleteCalculationFromHistory(id: string) {
  const nextItems = readCalculationHistory().filter((item) => item.id !== id);

  writeCalculationHistory(nextItems);

  return nextItems;
}

export function getCalculationFromHistory(id: string) {
  return readCalculationHistory().find((item) => item.id === id) ?? null;
}

export function queueCalculationForEditing(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(EDITING_ID_STORAGE_KEY, id);
}

export function consumeQueuedCalculationEditId() {
  if (typeof window === "undefined") {
    return null;
  }

  const id = window.localStorage.getItem(EDITING_ID_STORAGE_KEY);

  if (!id) {
    return null;
  }

  window.localStorage.removeItem(EDITING_ID_STORAGE_KEY);

  return id;
}

export function subscribeCalculationHistory(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();
  window.addEventListener(HISTORY_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(HISTORY_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}
