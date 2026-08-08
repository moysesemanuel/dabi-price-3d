import type { DisplayCurrency } from "@/lib/currency/display-currency";
import {
  defaultProfitDestinationPercentages,
  normalizeProfitDestinationPercentages,
  type ProfitDestinationPercentages,
} from "@/lib/pricing/profit-destination";
import type { PricingFormState } from "@/lib/pricing/initial-pricing-form";
import {
  getWorkspacePlan,
  workspaceRoleMeta,
  workspacePlans,
  type SubscriptionStatus,
  type WorkspacePlan,
  type WorkspacePlanId,
  type WorkspaceRole,
  type WorkspaceSubscription,
} from "../workspace/catalog";

export type BusinessPresetId = "maker" | "studio" | "farm";
export type {
  SubscriptionStatus,
  WorkspacePlan,
  WorkspacePlanId,
  WorkspaceRole,
  WorkspaceSubscription,
};

export type PricingPolicyDefaults = Pick<
  PricingFormState,
  | "pricingMode"
  | "profitMarginPercentage"
  | "healthyMarginTargetPercentage"
  | "lossPercentage"
  | "lossLaborSharePercentage"
  | "maintenanceCostPerHour"
  | "expansionReserveCostPerHour"
  | "taxPercentage"
  | "laborCostPerHour"
  | "kwhPrice"
>;

export type AppPreferences = {
  workspaceName: string;
  operatorName: string;
  operatorEmail: string;
  operatorRole: WorkspaceRole;
  businessPresetId: BusinessPresetId;
  defaultDisplayCurrency: DisplayCurrency;
  applyPresetToNewCalculations: boolean;
  onboardingCompleted: boolean;
  subscription: WorkspaceSubscription;
  pricingDefaults: PricingPolicyDefaults;
  profitDestinations: ProfitDestinationPercentages;
};

export type BusinessPreset = {
  id: BusinessPresetId;
  label: string;
  description: string;
  audience: string;
  defaults: PricingPolicyDefaults;
};

const PREFERENCES_EVENT = "dabi-price-3d:app-preferences-updated";
const STORAGE_KEY = "dabi-price-3d:app-preferences";
export { getWorkspacePlan, workspaceRoleMeta, workspacePlans };

export const businessPresets: readonly BusinessPreset[] = [
  {
    id: "maker",
    label: "Maker Enxuto",
    description: "Operação pequena, baixa estrutura fixa e giro mais manual.",
    audience: "Autônomos e produção sob encomenda em menor escala.",
    defaults: {
      pricingMode: "margin",
      profitMarginPercentage: 35,
      healthyMarginTargetPercentage: 25,
      lossPercentage: 4,
      lossLaborSharePercentage: 20,
      maintenanceCostPerHour: 2,
      expansionReserveCostPerHour: 0,
      taxPercentage: 0,
      laborCostPerHour: 25,
      kwhPrice: 0.9,
    },
  },
  {
    id: "studio",
    label: "Estúdio Profissional",
    description: "Operação equilibrada com proteção de margem e caixa de crescimento.",
    audience: "Negócios de produção recorrente com atendimento e acabamento próprios.",
    defaults: {
      pricingMode: "margin",
      profitMarginPercentage: 50,
      healthyMarginTargetPercentage: 30,
      lossPercentage: 8,
      lossLaborSharePercentage: 30,
      maintenanceCostPerHour: 4,
      expansionReserveCostPerHour: 0,
      taxPercentage: 6,
      laborCostPerHour: 31.25,
      kwhPrice: 0.9,
    },
  },
  {
    id: "farm",
    label: "Fábrica 3D",
    description: "Operação com maior estrutura, reposição de parque e margem mais conservadora.",
    audience: "Equipes com volume recorrente, múltiplas máquinas e gestão de capacidade.",
    defaults: {
      pricingMode: "margin",
      profitMarginPercentage: 55,
      healthyMarginTargetPercentage: 35,
      lossPercentage: 10,
      lossLaborSharePercentage: 35,
      maintenanceCostPerHour: 6,
      expansionReserveCostPerHour: 0,
      taxPercentage: 8,
      laborCostPerHour: 38,
      kwhPrice: 0.95,
    },
  },
] as const;

export const defaultAppPreferences: AppPreferences = {
  workspaceName: "Dabi Tech 3D",
  operatorName: "",
  operatorEmail: "",
  operatorRole: "owner",
  businessPresetId: "studio",
  defaultDisplayCurrency: "BRL",
  applyPresetToNewCalculations: true,
  onboardingCompleted: false,
  subscription: {
    planId: "growth",
    status: "internal",
    seatsUsed: 1,
  },
  profitDestinations: { ...defaultProfitDestinationPercentages },
  pricingDefaults: clonePricingPolicyDefaults(
    getBusinessPreset("studio").defaults,
  ),
};

let cachedPreferencesSnapshot = defaultAppPreferences;

export function getBusinessPreset(presetId: BusinessPresetId) {
  return (
    businessPresets.find((preset) => preset.id === presetId) ??
    businessPresets[0]
  );
}

export function resolveCalculationHistoryLimit(preferences: AppPreferences) {
  return getWorkspacePlan(preferences.subscription.planId).historyLimit;
}

export function clonePricingPolicyDefaults(
  defaults: PricingPolicyDefaults,
): PricingPolicyDefaults {
  return { ...defaults };
}

export function applyPreferencesToForm(
  form: PricingFormState,
  preferences: AppPreferences,
) {
  if (!preferences.applyPresetToNewCalculations) {
    return form;
  }

  return {
    ...form,
    ...preferences.pricingDefaults,
  };
}

export function readAppPreferences() {
  if (typeof window !== "undefined" && cachedPreferencesSnapshot === defaultAppPreferences) {
    return readLocalAppPreferences();
  }

  return cachedPreferencesSnapshot;
}

export function hydrateAppPreferences(preferences: AppPreferences) {
  const normalizedPreferences = normalizeAppPreferences(preferences);
  cachedPreferencesSnapshot = normalizedPreferences;

  return normalizedPreferences;
}

export async function loadAppPreferences() {
  if (typeof window === "undefined") {
    return cachedPreferencesSnapshot;
  }

  const response = await fetch("/api/workspace/preferences", {
    cache: "no-store",
  });

  if (!response.ok) {
    return readLocalAppPreferences();
  }

  const payload = (await response.json()) as Partial<AppPreferences>;
  const normalizedPreferences = hydrateAppPreferences(
    normalizeAppPreferences(payload),
  );
  window.dispatchEvent(new Event(PREFERENCES_EVENT));

  return normalizedPreferences;
}

export async function writeAppPreferences(preferences: AppPreferences) {
  if (typeof window === "undefined") {
    return normalizeAppPreferences(preferences);
  }

  const normalizedPreferences = normalizeAppPreferences(preferences);
  const response = await fetch("/api/workspace/preferences", {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(normalizedPreferences),
  });

  const payload = (await response.json().catch(() => null)) as
    | Partial<AppPreferences>
    | { error?: string }
    | null;

  if (!response.ok || !payload || ("error" in payload && payload.error)) {
    return persistLocalAppPreferences(normalizedPreferences);
  }

  const savedPreferences = hydrateAppPreferences(
    normalizeAppPreferences(payload as Partial<AppPreferences>),
  );
  window.dispatchEvent(new Event(PREFERENCES_EVENT));

  return savedPreferences;
}

export function subscribeAppPreferences(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();
  window.addEventListener(PREFERENCES_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(PREFERENCES_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

export function buildPreferencesFromPreset(
  presetId: BusinessPresetId,
  overrides?: Partial<AppPreferences>,
) {
  const preset = getBusinessPreset(presetId);

  return normalizeAppPreferences({
    ...defaultAppPreferences,
    ...overrides,
    businessPresetId: preset.id,
    subscription: overrides?.subscription ?? defaultAppPreferences.subscription,
    profitDestinations:
      overrides?.profitDestinations ?? defaultAppPreferences.profitDestinations,
    pricingDefaults: clonePricingPolicyDefaults(preset.defaults),
  });
}

function normalizeAppPreferences(
  preferences?: Partial<AppPreferences> | null,
): AppPreferences {
  const fallbackPreset = getBusinessPreset(
    preferences?.businessPresetId ?? defaultAppPreferences.businessPresetId,
  );
  const basePreferences = {
    ...defaultAppPreferences,
    ...preferences,
    businessPresetId: fallbackPreset.id,
  };
  const pricingDefaults = normalizePricingPolicyDefaults(
    basePreferences.pricingDefaults,
    fallbackPreset.defaults,
  );
  const subscription = normalizeWorkspaceSubscription(
    basePreferences.subscription,
  );
  const profitDestinations = normalizeProfitDestinationPercentages(
    basePreferences.profitDestinations,
  );

  return {
    workspaceName: sanitizeText(
      basePreferences.workspaceName,
      defaultAppPreferences.workspaceName,
    ),
    operatorName: sanitizeText(basePreferences.operatorName),
    operatorEmail: sanitizeText(basePreferences.operatorEmail),
    operatorRole: normalizeOperatorRole(basePreferences.operatorRole),
    businessPresetId: fallbackPreset.id,
    defaultDisplayCurrency:
      basePreferences.defaultDisplayCurrency === "USD" ||
      basePreferences.defaultDisplayCurrency === "EUR"
        ? basePreferences.defaultDisplayCurrency
        : "BRL",
    applyPresetToNewCalculations:
      basePreferences.applyPresetToNewCalculations !== false,
    onboardingCompleted: basePreferences.onboardingCompleted === true,
    subscription,
    pricingDefaults,
    profitDestinations,
  };
}

export { normalizeAppPreferences };

function normalizeOperatorRole(value: unknown): WorkspaceRole {
  if (value === "finance") {
    return "operator";
  }

  return typeof value === "string" && value in workspaceRoleMeta
    ? (value as WorkspaceRole)
    : defaultAppPreferences.operatorRole;
}

function readLocalAppPreferences() {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return cachedPreferencesSnapshot;
    }

    const parsedPreferences = normalizeAppPreferences(
      JSON.parse(rawValue) as Partial<AppPreferences>,
    );

    cachedPreferencesSnapshot = parsedPreferences;

    return parsedPreferences;
  } catch {
    return cachedPreferencesSnapshot;
  }
}

function persistLocalAppPreferences(preferences: AppPreferences) {
  const normalizedPreferences = hydrateAppPreferences(preferences);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedPreferences));
  window.dispatchEvent(new Event(PREFERENCES_EVENT));

  return normalizedPreferences;
}

function normalizeWorkspaceSubscription(
  subscription: Partial<WorkspaceSubscription> | undefined,
): WorkspaceSubscription {
  const plan = getWorkspacePlan(
    subscription?.planId ?? defaultAppPreferences.subscription.planId,
  );

  return {
    planId: plan.id,
    status:
      subscription?.status === "trial" || subscription?.status === "active"
        ? subscription.status
        : defaultAppPreferences.subscription.status,
    seatsUsed: Math.max(
      1,
      Math.round(
        sanitizeNumber(
          subscription?.seatsUsed,
          defaultAppPreferences.subscription.seatsUsed,
        ),
      ),
    ),
  };
}

function normalizePricingPolicyDefaults(
  defaults: Partial<PricingPolicyDefaults> | undefined,
  presetDefaults: PricingPolicyDefaults,
): PricingPolicyDefaults {
  return {
    pricingMode:
      defaults?.pricingMode === "manual" ? "manual" : presetDefaults.pricingMode,
    profitMarginPercentage: sanitizeNumber(
      defaults?.profitMarginPercentage,
      presetDefaults.profitMarginPercentage,
    ),
    healthyMarginTargetPercentage: sanitizeNumber(
      defaults?.healthyMarginTargetPercentage,
      presetDefaults.healthyMarginTargetPercentage,
    ),
    lossPercentage: sanitizeNumber(
      defaults?.lossPercentage,
      presetDefaults.lossPercentage,
    ),
    lossLaborSharePercentage: sanitizeNumber(
      defaults?.lossLaborSharePercentage,
      presetDefaults.lossLaborSharePercentage,
    ),
    maintenanceCostPerHour: sanitizeNumber(
      defaults?.maintenanceCostPerHour,
      presetDefaults.maintenanceCostPerHour,
    ),
    expansionReserveCostPerHour: sanitizeNumber(
      defaults?.expansionReserveCostPerHour,
      presetDefaults.expansionReserveCostPerHour,
    ),
    taxPercentage: sanitizeNumber(
      defaults?.taxPercentage,
      presetDefaults.taxPercentage,
    ),
    laborCostPerHour: sanitizeNumber(
      defaults?.laborCostPerHour,
      presetDefaults.laborCostPerHour,
    ),
    kwhPrice: sanitizeNumber(defaults?.kwhPrice, presetDefaults.kwhPrice),
  };
}

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function sanitizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
