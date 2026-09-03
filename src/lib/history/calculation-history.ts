import type {
  DisplayCurrency,
  ExchangeRateSnapshot,
} from "@/lib/currency/display-currency";
import { isClientLocalPersistenceMode } from "@/lib/client/persistence-mode";
import {
  normalizeSavedCalculation,
  type CalculationType,
  type SavedCalculation,
} from "@/lib/history/workspace-calculations";

export type { SavedCalculation } from "@/lib/history/workspace-calculations";

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

export function readCalculationHistoryByKind(kind: CalculationType) {
  return readCalculationHistory().filter((item) => item.kind === kind);
}

export function hydrateCalculationHistory(items: SavedCalculation[]) {
  const normalizedItems = items
    .map((item) => normalizeSavedCalculation(item))
    .filter((item): item is SavedCalculation => item !== null);

  writeCalculationHistory(normalizedItems);
  return normalizedItems;
}

export async function loadCalculationHistory() {
  if (typeof window === "undefined") {
    return cachedHistorySnapshot;
  }

  if (isClientLocalPersistenceMode()) {
    return readLocalCalculationHistory();
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
  siteProduct: {
    id: string;
    slug: string;
    url: string | null;
    publishedAt: string;
  },
) {
  const currentItem = getCalculationFromHistory(calculationId);

  if (!currentItem || currentItem.kind !== "3d") {
    return null;
  }

  const nextItem: SavedCalculation = {
    ...currentItem,
    siteProduct,
  };

  await upsertCalculationInHistory(nextItem);

  return nextItem;
}

export async function attachErpProductToCalculation(
  calculationId: string,
  erpProduct: {
    id: string | null;
    sku: string | null;
    syncedAt: string;
  },
) {
  const currentItem = getCalculationFromHistory(calculationId);

  if (!currentItem || currentItem.kind !== "3d") {
    return null;
  }

  const nextItem: SavedCalculation = {
    ...currentItem,
    erpProduct,
  };

  await upsertCalculationInHistory(nextItem);

  return nextItem;
}

export async function clearCalculationHistory(kind?: CalculationType) {
  if (typeof window === "undefined") {
    return;
  }

  if (isClientLocalPersistenceMode()) {
    const nextItems =
      kind === undefined
        ? EMPTY_HISTORY
        : readLocalCalculationHistory().filter((item) => item.kind !== kind);

    if (nextItems.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
    }

    writeCalculationHistory(nextItems);
    return;
  }

  if (!kind) {
    const response = await fetch("/api/workspace/calculations", {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Falha ao limpar o histórico.");
    }

    writeCalculationHistory(EMPTY_HISTORY);
    return;
  }

  const matchingItems = readCalculationHistory().filter((item) => item.kind === kind);

  for (const item of matchingItems) {
    const response = await fetch(
      `/api/workspace/calculations/${encodeURIComponent(item.id)}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Falha ao limpar o histórico.");
    }
  }

  writeCalculationHistory(
    readCalculationHistory().filter((item) => item.kind !== kind),
  );
}

export async function deleteCalculationFromHistory(id: string) {
  if (typeof window === "undefined") {
    return cachedHistorySnapshot;
  }

  if (isClientLocalPersistenceMode()) {
    const nextItems = readLocalCalculationHistory().filter((item) => item.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
    writeCalculationHistory(nextItems);
    return nextItems;
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

async function persistCalculationItem(item: SavedCalculation) {
  if (typeof window === "undefined") {
    return readCalculationHistory();
  }

  const normalizedItem = normalizeSavedCalculation(item);

  if (!normalizedItem) {
    throw new Error("Cálculo inválido para persistência.");
  }

  if (isClientLocalPersistenceMode()) {
    return persistLocalCalculationItem(normalizedItem);
  }

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

  const nextItem = normalizeSavedCalculation(payload);

  if (!nextItem) {
    return persistLocalCalculationItem(normalizedItem);
  }

  const currentItems = readCalculationHistory().filter(
    (currentItem) => currentItem.id !== nextItem.id,
  );
  // The server owns commercial retention. Keep the optimistic cache intact
  // until the following authoritative history load reconciles it.
  const nextItems = [nextItem, ...currentItems];

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
  const nextItems = [item, ...currentItems].slice(0, MAX_ITEMS);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
  writeCalculationHistory(nextItems);

  return nextItems;
}

export type {
  CalculationType,
  DisplayCurrency,
  ExchangeRateSnapshot,
};
