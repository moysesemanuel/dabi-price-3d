import type {
  FilamentRequirementInput,
  PricingFormState,
} from "@/lib/pricing/initial-pricing-form";
import type { ErpProductFilamentRequirement } from "@/lib/erp-products/types";

const DEFAULT_FILAMENT_COLOR_HEX = "#FFFFFF";
const DEFAULT_FILAMENT_MATERIAL = "PLA";

export function createFilamentRequirementInput(
  weightGrams = 0,
): FilamentRequirementInput {
  return {
    id: createFilamentRequirementId(),
    colorName: "",
    colorHex: DEFAULT_FILAMENT_COLOR_HEX,
    material: DEFAULT_FILAMENT_MATERIAL,
    weightGrams,
  };
}

export function normalizeFilamentRequirementInputs(
  requirements: FilamentRequirementInput[] | undefined,
  fallbackWeightGrams = 0,
): FilamentRequirementInput[] {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return [createFilamentRequirementInput(fallbackWeightGrams)];
  }

  return requirements.map((requirement, index) => ({
    id: requirement.id ?? `filament-${index + 1}`,
    colorName:
      typeof requirement.colorName === "string" ? requirement.colorName : "",
    colorHex:
      typeof requirement.colorHex === "string"
        ? normalizeColorHex(requirement.colorHex)
        : DEFAULT_FILAMENT_COLOR_HEX,
    material:
      typeof requirement.material === "string"
        ? requirement.material
        : DEFAULT_FILAMENT_MATERIAL,
    weightGrams:
      typeof requirement.weightGrams === "number" &&
      Number.isFinite(requirement.weightGrams)
        ? requirement.weightGrams
        : 0,
  }));
}

export function sumFilamentRequirementInputWeights(
  requirements: FilamentRequirementInput[],
) {
  return requirements.reduce(
    (total, requirement) =>
      total + normalizeNonNegativeNumber(requirement.weightGrams),
    0,
  );
}

export function buildErpFilamentRequirements(
  form: PricingFormState,
): ErpProductFilamentRequirement[] {
  if (form.productType !== "3d") {
    return [];
  }

  const weightMultiplier = getFilamentWeightMultiplier(form);

  return form.filamentRequirements
    .map((requirement) => {
      const colorName = requirement.colorName.trim();
      const weightGrams = roundTo3(
        normalizeNonNegativeNumber(requirement.weightGrams) * weightMultiplier,
      );

      if (!colorName || weightGrams <= 0) {
        return null;
      }

      return {
        colorName,
        colorHex: normalizeColorHex(requirement.colorHex),
        material: normalizeFilamentMaterial(requirement.material),
        weightGrams,
      };
    })
    .filter((requirement) => requirement !== null);
}

export function getFilamentRequirementsValidationMessage(
  form: PricingFormState,
) {
  if (form.productType !== "3d") {
    return null;
  }

  const normalizedRequirements = form.filamentRequirements.filter(
    (requirement) =>
      requirement.material.trim().length > 0 ||
      requirement.colorName.trim().length > 0 ||
      normalizeNonNegativeNumber(requirement.weightGrams) > 0,
  );

  if (normalizedRequirements.length === 0) {
    return "Cadastre pelo menos uma cor de filamento para enviar o produto ao ERP.";
  }

  const totalInputWeight = sumFilamentRequirementInputWeights(
    form.filamentRequirements,
  );
  const expectedWeight = normalizeNonNegativeNumber(form.weightGrams);

  if (Math.abs(totalInputWeight - expectedWeight) > 0.01) {
    return "A soma dos pesos por cor precisa bater com o peso total do filamento.";
  }

  const hasInvalidRequirement = normalizedRequirements.some(
    (requirement) =>
      requirement.material.trim().length === 0 ||
      requirement.colorName.trim().length === 0 ||
      normalizeNonNegativeNumber(requirement.weightGrams) <= 0,
  );

  if (hasInvalidRequirement) {
    return "Preencha material, nome da cor e peso maior que zero para cada filamento usado.";
  }

  return null;
}

export function normalizeColorHex(value: string) {
  const trimmedValue = value.trim();

  if (/^#[0-9a-fA-F]{6}$/.test(trimmedValue)) {
    return trimmedValue.toUpperCase();
  }

  return DEFAULT_FILAMENT_COLOR_HEX;
}

export function normalizeFilamentMaterial(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue || DEFAULT_FILAMENT_MATERIAL;
}

function getFilamentWeightMultiplier(form: PricingFormState) {
  const kitQuantity = form.isKit ? Math.max(form.kitQuantity, 1) : 1;
  const piecesPerCycle = form.multiplePiecesEnabled
    ? Math.max(form.quantity, 1)
    : 1;
  const cyclesPerSaleUnit = kitQuantity / piecesPerCycle;

  return form.multiplePiecesEnabled && form.divideFilamentByPieces
    ? cyclesPerSaleUnit
    : piecesPerCycle * cyclesPerSaleUnit;
}

function normalizeNonNegativeNumber(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function roundTo3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function createFilamentRequirementId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `filament-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
