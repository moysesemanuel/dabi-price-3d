export type ConfectioneryIngredientUnit = "g" | "ml" | "un";

export type ConfectioneryIngredientInput = {
  id: string;
  name: string;
  purchaseQuantity: number;
  purchaseUnit: ConfectioneryIngredientUnit;
  purchaseCost: number;
  usageQuantity: number;
};

export type ConfectioneryPricingFormState = {
  productName: string;
  fixedMonthlyCosts: number;
  desiredMonthlySalary: number;
  workHoursPerDay: number;
  workDaysPerWeek: number;
  ingredients: ConfectioneryIngredientInput[];
  packagingCost: number;
  productionTimeMinutes: number;
  unitsProduced: number;
  marginPercentage: number;
};

export type ConfectioneryPricingResult = {
  monthlyHours: number;
  hourlyCost: number;
  productionTimeHours: number;
  ingredientCost: number;
  ingredientBreakdown: Array<
    ConfectioneryIngredientInput & {
      unitCost: number;
      totalCost: number;
    }
  >;
  timeCost: number;
  totalBatchCost: number;
  unitCost: number;
  suggestedUnitPrice: number;
  suggestedBatchRevenue: number;
  unitProfit: number;
  batchProfit: number;
};

export const initialConfectioneryPricingForm: ConfectioneryPricingFormState = {
  productName: "Bolo de Chocolate",
  fixedMonthlyCosts: 1200,
  desiredMonthlySalary: 3000,
  workHoursPerDay: 8,
  workDaysPerWeek: 5,
  ingredients: [
    {
      id: "ingredient-1",
      name: "Farinha de trigo",
      purchaseQuantity: 1000,
      purchaseUnit: "g",
      purchaseCost: 6,
      usageQuantity: 300,
    },
    {
      id: "ingredient-2",
      name: "Chocolate em pó",
      purchaseQuantity: 1000,
      purchaseUnit: "g",
      purchaseCost: 40,
      usageQuantity: 200,
    },
    {
      id: "ingredient-3",
      name: "Ovos",
      purchaseQuantity: 12,
      purchaseUnit: "un",
      purchaseCost: 7.8,
      usageQuantity: 8,
    },
  ],
  packagingCost: 2,
  productionTimeMinutes: 120,
  unitsProduced: 1,
  marginPercentage: 40,
};

export function createConfectioneryIngredientInput(
  overrides?: Partial<ConfectioneryIngredientInput>,
): ConfectioneryIngredientInput {
  const nextId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ingredient-${Date.now()}-${Math.round(Math.random() * 1000)}`;

  return {
    id: nextId,
    name: "",
    purchaseQuantity: 1000,
    purchaseUnit: "g",
    purchaseCost: 0,
    usageQuantity: 0,
    ...overrides,
  };
}

export function hydrateConfectioneryPricingFormState(
  input?: Partial<ConfectioneryPricingFormState> | null,
): ConfectioneryPricingFormState {
  return {
    productName: sanitizeText(
      input?.productName,
      initialConfectioneryPricingForm.productName,
    ),
    fixedMonthlyCosts: sanitizeNumber(
      input?.fixedMonthlyCosts,
      initialConfectioneryPricingForm.fixedMonthlyCosts,
    ),
    desiredMonthlySalary: sanitizeNumber(
      input?.desiredMonthlySalary,
      initialConfectioneryPricingForm.desiredMonthlySalary,
    ),
    workHoursPerDay: sanitizeNumber(
      input?.workHoursPerDay,
      initialConfectioneryPricingForm.workHoursPerDay,
    ),
    workDaysPerWeek: sanitizeNumber(
      input?.workDaysPerWeek,
      initialConfectioneryPricingForm.workDaysPerWeek,
    ),
    ingredients: normalizeIngredients(input?.ingredients),
    packagingCost: sanitizeNumber(
      input?.packagingCost,
      initialConfectioneryPricingForm.packagingCost,
    ),
    productionTimeMinutes: sanitizeNumber(
      input?.productionTimeMinutes,
      initialConfectioneryPricingForm.productionTimeMinutes,
    ),
    unitsProduced: Math.max(
      1,
      Math.round(
        sanitizeNumber(
          input?.unitsProduced,
          initialConfectioneryPricingForm.unitsProduced,
        ),
      ),
    ),
    marginPercentage: sanitizeNumber(
      input?.marginPercentage,
      initialConfectioneryPricingForm.marginPercentage,
    ),
  };
}

export function calculateConfectioneryPrice(
  input: ConfectioneryPricingFormState,
): ConfectioneryPricingResult {
  const monthlyHours =
    Math.max(0, input.workHoursPerDay) * Math.max(0, input.workDaysPerWeek) * 4;
  const hourlyCost =
    monthlyHours > 0
      ? (Math.max(0, input.fixedMonthlyCosts) +
          Math.max(0, input.desiredMonthlySalary)) /
        monthlyHours
      : 0;
  const productionTimeHours = Math.max(0, input.productionTimeMinutes) / 60;
  const ingredientBreakdown = input.ingredients.map((ingredient) => {
    const unitCost =
      ingredient.purchaseQuantity > 0
        ? ingredient.purchaseCost / ingredient.purchaseQuantity
        : 0;
    const totalCost = unitCost * ingredient.usageQuantity;

    return {
      ...ingredient,
      unitCost,
      totalCost,
    };
  });
  const ingredientCost = ingredientBreakdown.reduce(
    (total, ingredient) => total + ingredient.totalCost,
    0,
  );
  const timeCost = productionTimeHours * hourlyCost;
  const totalBatchCost =
    ingredientCost + Math.max(0, input.packagingCost) + timeCost;
  const unitCost = input.unitsProduced > 0 ? totalBatchCost / input.unitsProduced : 0;
  const suggestedUnitPrice =
    unitCost * (1 + Math.max(-100, input.marginPercentage) / 100);
  const suggestedBatchRevenue = suggestedUnitPrice * input.unitsProduced;
  const unitProfit = suggestedUnitPrice - unitCost;
  const batchProfit = suggestedBatchRevenue - totalBatchCost;

  return {
    monthlyHours,
    hourlyCost,
    productionTimeHours,
    ingredientCost,
    ingredientBreakdown,
    timeCost,
    totalBatchCost,
    unitCost,
    suggestedUnitPrice,
    suggestedBatchRevenue,
    unitProfit,
    batchProfit,
  };
}

function normalizeIngredients(value: unknown): ConfectioneryIngredientInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    return initialConfectioneryPricingForm.ingredients.map((ingredient) => ({
      ...ingredient,
    }));
  }

  return value.map((ingredient, index) => {
    const item = ingredient as Partial<ConfectioneryIngredientInput>;

    return createConfectioneryIngredientInput({
      id:
        typeof item.id === "string" && item.id.trim().length > 0
          ? item.id
          : `ingredient-${index + 1}`,
      name: sanitizeText(item.name),
      purchaseQuantity: sanitizeNumber(item.purchaseQuantity, 1000),
      purchaseUnit: normalizeIngredientUnit(item.purchaseUnit),
      purchaseCost: sanitizeNumber(item.purchaseCost, 0),
      usageQuantity: sanitizeNumber(item.usageQuantity, 0),
    });
  });
}

function normalizeIngredientUnit(value: unknown): ConfectioneryIngredientUnit {
  return value === "ml" || value === "un" ? value : "g";
}

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function sanitizeNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value.replace(",", "."));

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return fallback;
}
