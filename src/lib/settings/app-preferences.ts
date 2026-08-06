import type { DisplayCurrency } from "@/lib/currency/display-currency";
import type { PricingFormState } from "@/lib/pricing/initial-pricing-form";

export type BusinessPresetId = "maker" | "studio" | "farm";

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
  businessPresetId: BusinessPresetId;
  defaultDisplayCurrency: DisplayCurrency;
  applyPresetToNewCalculations: boolean;
  onboardingCompleted: boolean;
  pricingDefaults: PricingPolicyDefaults;
};

export type BusinessPreset = {
  id: BusinessPresetId;
  label: string;
  description: string;
  audience: string;
  defaults: PricingPolicyDefaults;
};

const STORAGE_KEY = "dabi-price-3d:app-preferences";
const PREFERENCES_EVENT = "dabi-price-3d:app-preferences-updated";

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
      expansionReserveCostPerHour: 1,
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
      expansionReserveCostPerHour: 3,
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
      expansionReserveCostPerHour: 5,
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
  businessPresetId: "studio",
  defaultDisplayCurrency: "BRL",
  applyPresetToNewCalculations: true,
  onboardingCompleted: false,
  pricingDefaults: clonePricingPolicyDefaults(
    getBusinessPreset("studio").defaults,
  ),
};

let cachedPreferencesRawValue: string | null | undefined;
let cachedPreferencesSnapshot = defaultAppPreferences;

export function getBusinessPreset(presetId: BusinessPresetId) {
  return (
    businessPresets.find((preset) => preset.id === presetId) ??
    businessPresets[0]
  );
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
  if (typeof window === "undefined") {
    return defaultAppPreferences;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (rawValue === cachedPreferencesRawValue) {
      return cachedPreferencesSnapshot;
    }

    const parsedPreferences = normalizeAppPreferences(
      rawValue ? (JSON.parse(rawValue) as Partial<AppPreferences>) : null,
    );

    cachedPreferencesRawValue = rawValue;
    cachedPreferencesSnapshot = parsedPreferences;

    return parsedPreferences;
  } catch {
    cachedPreferencesRawValue = null;
    cachedPreferencesSnapshot = defaultAppPreferences;
    return defaultAppPreferences;
  }
}

export function writeAppPreferences(preferences: AppPreferences) {
  if (typeof window === "undefined") {
    return preferences;
  }

  const normalizedPreferences = normalizeAppPreferences(preferences);
  const serializedPreferences = JSON.stringify(normalizedPreferences);

  cachedPreferencesRawValue = serializedPreferences;
  cachedPreferencesSnapshot = normalizedPreferences;
  window.localStorage.setItem(STORAGE_KEY, serializedPreferences);
  window.dispatchEvent(new Event(PREFERENCES_EVENT));

  return normalizedPreferences;
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

  return {
    workspaceName: sanitizeText(
      basePreferences.workspaceName,
      defaultAppPreferences.workspaceName,
    ),
    operatorName: sanitizeText(basePreferences.operatorName),
    operatorEmail: sanitizeText(basePreferences.operatorEmail),
    businessPresetId: fallbackPreset.id,
    defaultDisplayCurrency:
      basePreferences.defaultDisplayCurrency === "USD" ||
      basePreferences.defaultDisplayCurrency === "EUR"
        ? basePreferences.defaultDisplayCurrency
        : "BRL",
    applyPresetToNewCalculations:
      basePreferences.applyPresetToNewCalculations !== false,
    onboardingCompleted: basePreferences.onboardingCompleted === true,
    pricingDefaults,
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
