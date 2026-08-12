import type { DisplayCurrency } from "@/lib/currency/display-currency";
import { isClientLocalPersistenceMode } from "@/lib/client/persistence-mode";
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
export type BusinessType =
  | "3d_printing"
  | "confectionery"
  | "crafts"
  | "resale";
export type CompanyPaymentMethod =
  | "pix"
  | "credit_card"
  | "debit_card"
  | "boleto"
  | "cash"
  | "bank_transfer";
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
  operatorPhone: string;
  businessType: BusinessType | null;
  companyLogoUrl: string;
  brandAccentHex: string;
  addressLine: string;
  city: string;
  state: string;
  paymentMethods: CompanyPaymentMethod[];
  websiteUrl: string;
  instagramHandle: string;
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
const BUSINESS_TYPE_COOKIE = "dabi-price-3d:business-type";
export { getWorkspacePlan, workspaceRoleMeta, workspacePlans };
export const businessTypeCookieName = BUSINESS_TYPE_COOKIE;

export const companyPaymentMethodMeta: Record<
  CompanyPaymentMethod,
  { label: string; description: string }
> = {
  pix: {
    label: "PIX",
    description: "Pagamento instantâneo para pedidos rápidos e aprovação ágil.",
  },
  credit_card: {
    label: "Cartão de crédito",
    description: "Venda parcelada ou à vista no cartão.",
  },
  debit_card: {
    label: "Cartão de débito",
    description: "Recebimento imediato no débito.",
  },
  boleto: {
    label: "Boleto",
    description: "Cobrança bancária para clientes PJ e faturamento.",
  },
  cash: {
    label: "Dinheiro",
    description: "Pagamento presencial em espécie.",
  },
  bank_transfer: {
    label: "Transferência bancária",
    description: "TED, DOC ou transferência entre contas.",
  },
};

export const businessTypeMeta: Record<
  BusinessType,
  {
    label: string;
    shortLabel: string;
    description: string;
    onboardingHint: string;
    previewMaterialLabel: string;
    previewMaterialValue: string;
    templatesSummary: string;
    calculatorReady: boolean;
  }
> = {
  "3d_printing": {
    label: "Impressão 3D",
    shortLabel: "3D",
    description:
      "Cálculos baseados em filamento ou resina, tempo de máquina, energia, falha e acabamento.",
    onboardingHint:
      "Ideal para operações com STL, filamento, resina e produção por ciclo.",
    previewMaterialLabel: "Processo",
    previewMaterialValue: "Filamento / resina / acabamento",
    templatesSummary:
      "Modelos focados em peça, material, prazo, acabamento e valor final.",
    calculatorReady: true,
  },
  confectionery: {
    label: "Confeitaria",
    shortLabel: "Confeitaria",
    description:
      "Custos por receita, insumos, rendimento, embalagem, tempo manual e entrega.",
    onboardingHint:
      "Pensado para doces, bolos, encomendas personalizadas e produção sob pedido.",
    previewMaterialLabel: "Base de custo",
    previewMaterialValue: "Receita / embalagem / tempo manual",
    templatesSummary:
      "Modelos pensados para itens sob encomenda, sabores, quantidade e entrega.",
    calculatorReady: true,
  },
  crafts: {
    label: "Artesanato",
    shortLabel: "Artesanato",
    description:
      "Composição por matéria-prima, tempo manual, personalização, embalagem e frete.",
    onboardingHint:
      "Funciona bem para produção manual, peças personalizadas e pequenos lotes.",
    previewMaterialLabel: "Base de custo",
    previewMaterialValue: "Matéria-prima / mão de obra / personalização",
    templatesSummary:
      "Modelos preparados para peça manual, personalização e apresentação comercial.",
    calculatorReady: false,
  },
  resale: {
    label: "Produto normal",
    shortLabel: "Revenda",
    description:
      "Margem sobre compra de fornecedor, frete, taxa de canal, impostos e comissão.",
    onboardingHint:
      "Indicado para revenda simples, catálogo comprado de fornecedor e operação comercial.",
    previewMaterialLabel: "Base de custo",
    previewMaterialValue: "Fornecedor / frete / comissão / impostos",
    templatesSummary:
      "Modelos orientados para revenda, quantidade, condições de pagamento e entrega.",
    calculatorReady: false,
  },
};

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
  operatorPhone: "",
  businessType: null,
  companyLogoUrl: "",
  brandAccentHex: "#ff6a00",
  addressLine: "",
  city: "",
  state: "",
  paymentMethods: ["pix"],
  websiteUrl: "",
  instagramHandle: "",
  operatorRole: "owner",
  businessPresetId: "studio",
  defaultDisplayCurrency: "BRL",
  applyPresetToNewCalculations: true,
  onboardingCompleted: false,
  subscription: {
    planId: "growth",
    status: "internal",
    seatsUsed: 1,
    mercadoPagoSubscriptionId: null,
    checkoutStartedAt: null,
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

export function getCompanyProfileChecklist(preferences: AppPreferences) {
  return [
    {
      id: "businessType",
      label: "Ramo principal",
      done: preferences.businessType !== null,
    },
    {
      id: "workspaceName",
      label: "Nome da empresa",
      done: preferences.workspaceName.trim().length > 0,
    },
    {
      id: "operatorEmail",
      label: "E-mail operacional",
      done: preferences.operatorEmail.trim().length > 0,
    },
    {
      id: "operatorPhone",
      label: "Telefone / WhatsApp",
      done: preferences.operatorPhone.trim().length > 0,
    },
    {
      id: "city",
      label: "Cidade",
      done: preferences.city.trim().length > 0,
    },
  ] as const;
}

export function isCompanyProfileComplete(preferences: AppPreferences) {
  return getCompanyProfileChecklist(preferences).every((item) => item.done);
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
  syncBusinessTypeCookie(normalizedPreferences.businessType);

  return normalizedPreferences;
}

export async function loadAppPreferences() {
  if (typeof window === "undefined") {
    return cachedPreferencesSnapshot;
  }

  if (isClientLocalPersistenceMode()) {
    return readLocalAppPreferences();
  }

  const response = await fetch("/api/workspace/preferences", {
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | Partial<AppPreferences>
    | { error?: string }
    | null;

  if (!response.ok) {
    if (shouldUseLocalPreferencesFallback(response.status, payload)) {
      return readLocalAppPreferences();
    }

    throw new Error(
      isPreferencesErrorPayload(payload)
        ? payload.error ?? "Falha ao carregar preferências do workspace."
        : "Falha ao carregar preferências do workspace.",
    );
  }

  const normalizedPreferences = hydrateAppPreferences(
    normalizeAppPreferences(payload as Partial<AppPreferences>),
  );
  window.dispatchEvent(new Event(PREFERENCES_EVENT));

  return normalizedPreferences;
}

export async function writeAppPreferences(preferences: AppPreferences) {
  if (typeof window === "undefined") {
    return normalizeAppPreferences(preferences);
  }

  const normalizedPreferences = normalizeAppPreferences(preferences);

  if (isClientLocalPersistenceMode()) {
    return persistLocalAppPreferences(normalizedPreferences);
  }

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
    if (shouldUseLocalPreferencesFallback(response.status, payload)) {
      return persistLocalAppPreferences(normalizedPreferences);
    }

    throw new Error(
      isPreferencesErrorPayload(payload)
        ? payload.error ?? "Falha ao salvar preferências do workspace."
        : "Falha ao salvar preferências do workspace.",
    );
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
    operatorPhone: sanitizeText(basePreferences.operatorPhone),
    businessType: normalizeBusinessType(basePreferences.businessType),
    companyLogoUrl: sanitizeText(basePreferences.companyLogoUrl),
    brandAccentHex: sanitizeColor(
      basePreferences.brandAccentHex,
      defaultAppPreferences.brandAccentHex,
    ),
    addressLine: sanitizeText(basePreferences.addressLine),
    city: sanitizeText(basePreferences.city),
    state: sanitizeState(basePreferences.state),
    paymentMethods: normalizePaymentMethods(basePreferences.paymentMethods),
    websiteUrl: sanitizeText(basePreferences.websiteUrl),
    instagramHandle: sanitizeText(basePreferences.instagramHandle),
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
export { normalizeBusinessType as normalizePersistedBusinessType };

function normalizeOperatorRole(value: unknown): WorkspaceRole {
  if (value === "finance") {
    return "operator";
  }

  return typeof value === "string" && value in workspaceRoleMeta
    ? (value as WorkspaceRole)
    : defaultAppPreferences.operatorRole;
}

function normalizeBusinessType(value: unknown): BusinessType | null {
  return typeof value === "string" && value in businessTypeMeta
    ? (value as BusinessType)
    : null;
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
    syncBusinessTypeCookie(parsedPreferences.businessType);

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

function syncBusinessTypeCookie(businessType: BusinessType | null) {
  if (typeof document === "undefined") {
    return;
  }

  if (!businessType) {
    document.cookie = `${BUSINESS_TYPE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return;
  }

  document.cookie = `${BUSINESS_TYPE_COOKIE}=${encodeURIComponent(
    businessType,
  )}; path=/; max-age=31536000; samesite=lax`;
}

function shouldUseLocalPreferencesFallback(
  status: number,
  payload: Partial<AppPreferences> | { error?: string } | null,
) {
  if (status !== 503) {
    return false;
  }

  return (
    isPreferencesErrorPayload(payload) &&
    payload.error === "Persistência de workspace indisponível sem DATABASE_URL."
  );
}

function isPreferencesErrorPayload(
  payload: Partial<AppPreferences> | { error?: string } | null,
): payload is { error?: string } {
  return !!payload && typeof payload === "object" && "error" in payload;
}

function normalizeWorkspaceSubscription(
  subscription: Partial<WorkspaceSubscription> | undefined,
): WorkspaceSubscription {
  const plan = getWorkspacePlan(
    subscription?.planId ?? defaultAppPreferences.subscription.planId,
  );

  const status =
    subscription?.status === "trial" ||
    subscription?.status === "pending" ||
    subscription?.status === "active" ||
    subscription?.status === "paused" ||
    subscription?.status === "canceled"
      ? subscription.status
      : defaultAppPreferences.subscription.status;

  const mercadoPagoSubscriptionId =
    typeof subscription?.mercadoPagoSubscriptionId === "string" &&
    subscription.mercadoPagoSubscriptionId.trim()
      ? subscription.mercadoPagoSubscriptionId.trim()
      : null;

  const checkoutStartedAt =
  typeof subscription?.checkoutStartedAt === "string" &&
  subscription.checkoutStartedAt.trim()
    ? subscription.checkoutStartedAt.trim()
    : null;

  return {
    planId: plan.id,
    status,
    seatsUsed: Math.max(
      1,
      Math.round(
        sanitizeNumber(
          subscription?.seatsUsed,
          defaultAppPreferences.subscription.seatsUsed,
        ),
      ),
    ),
    mercadoPagoSubscriptionId,
    checkoutStartedAt,
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

function sanitizeColor(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalizedValue = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalizedValue) ? normalizedValue : fallback;
}

function sanitizeState(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 2).toUpperCase();
}

function normalizePaymentMethods(
  value: unknown,
): CompanyPaymentMethod[] {
  if (!Array.isArray(value)) {
    return defaultAppPreferences.paymentMethods;
  }

  const validMethods = value.filter(
    (item): item is CompanyPaymentMethod =>
      typeof item === "string" && item in companyPaymentMethodMeta,
  );

  return validMethods.length > 0 ? validMethods : defaultAppPreferences.paymentMethods;
}

function sanitizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
