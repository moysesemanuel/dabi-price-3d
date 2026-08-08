import type {
  DisplayCurrency,
  ExchangeRateSnapshot,
} from "@/lib/currency/display-currency";
import type { PricingFormState } from "@/lib/pricing/initial-pricing-form";
import { readAppPreferences, resolveCalculationHistoryLimit } from "@/lib/settings/app-preferences";

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

const STORAGE_KEY = "dabi-price-3d:calculation-history";
const EDITING_ID_STORAGE_KEY = "dabi-price-3d:editing-calculation-id";
const HISTORY_EVENT = "dabi-price-3d:calculation-history-updated";
const MAX_ITEMS = 100;
const EMPTY_HISTORY: SavedCalculation[] = [];

let cachedHistorySnapshot: SavedCalculation[] = EMPTY_HISTORY;

function writeCalculationHistory(items: SavedCalculation[]) {
  cachedHistorySnapshot = items;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HISTORY_EVENT));
  }
}

export function readCalculationHistory() {
  if (typeof window !== "undefined" && cachedHistorySnapshot === EMPTY_HISTORY) {
    return readLocalCalculationHistory();
  }

  return cachedHistorySnapshot;
}

export function hydrateCalculationHistory(items: SavedCalculation[]) {
  const normalizedItems = items.map((item) => ({
    ...item,
    productName: item.productName.trim() || "Sem nome",
  }));

  writeCalculationHistory(normalizedItems);
  return normalizedItems;
}

export async function loadCalculationHistory() {
  if (typeof window === "undefined") {
    return cachedHistorySnapshot;
  }

  const response = await fetch("/api/workspace/calculations", {
    cache: "no-store",
  });

  if (!response.ok) {
    return readLocalCalculationHistory();
  }

  const payload = (await response.json()) as SavedCalculation[];
  return hydrateCalculationHistory(Array.isArray(payload) ? payload : EMPTY_HISTORY);
}

export async function saveCalculationToHistory(item: SavedCalculation) {
  return persistCalculationItem(item);
}

export async function upsertCalculationInHistory(item: SavedCalculation) {
  return persistCalculationItem(item);
}

export async function attachSiteProductToCalculation(
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

  await upsertCalculationInHistory(nextItem);

  return nextItem;
}

export async function attachErpProductToCalculation(
  calculationId: string,
  erpProduct: NonNullable<SavedCalculation["erpProduct"]>,
) {
  const currentItem = getCalculationFromHistory(calculationId);

  if (!currentItem) {
    return null;
  }

  const nextItem = {
    ...currentItem,
    erpProduct,
  };

  await upsertCalculationInHistory(nextItem);

  return nextItem;
}

export async function clearCalculationHistory() {
  if (typeof window === "undefined") {
    return;
  }

  const response = await fetch("/api/workspace/calculations", {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Falha ao limpar o histórico.");
  }

  cachedHistorySnapshot = EMPTY_HISTORY;
  window.dispatchEvent(new Event(HISTORY_EVENT));
}

export async function deleteCalculationFromHistory(id: string) {
  if (typeof window === "undefined") {
    return cachedHistorySnapshot;
  }

  const response = await fetch(
    `/api/workspace/calculations/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "Falha ao excluir o cálculo.");
  }

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

function resolveHistoryLimit() {
  if (typeof window === "undefined") {
    return MAX_ITEMS;
  }

  return resolveCalculationHistoryLimit(readAppPreferences());
}

async function persistCalculationItem(item: SavedCalculation) {
  if (typeof window === "undefined") {
    return readCalculationHistory();
  }

  const normalizedItem = {
    ...item,
    productName: item.productName.trim() || "Sem nome",
  };
  const response = await fetch("/api/workspace/calculations", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(normalizedItem),
  });
  const payload = (await response.json().catch(() => null)) as
    | SavedCalculation
    | { error?: string }
    | null;

  if (!response.ok || !payload || ("error" in payload && payload.error)) {
    return persistLocalCalculationItem(normalizedItem);
  }

  const nextItem = payload as SavedCalculation;
  const currentItems = readCalculationHistory().filter(
    (currentItem) => currentItem.id !== nextItem.id,
  );
  const nextItems = [nextItem, ...currentItems].slice(0, resolveHistoryLimit());

  writeCalculationHistory(nextItems);

  return nextItems;
}

function readLocalCalculationHistory() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return cachedHistorySnapshot;
    }

    const parsedValue = JSON.parse(rawValue) as SavedCalculation[];

    if (!Array.isArray(parsedValue)) {
      return cachedHistorySnapshot;
    }

    return hydrateCalculationHistory(parsedValue);
  } catch {
    return cachedHistorySnapshot;
  }
}

function persistLocalCalculationItem(item: SavedCalculation) {
  const currentItems = readLocalCalculationHistory().filter(
    (currentItem) => currentItem.id !== item.id,
  );
  const nextItems = [item, ...currentItems].slice(0, resolveHistoryLimit());

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  writeCalculationHistory(nextItems);

  return nextItems;
}
