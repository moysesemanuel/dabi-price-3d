import {
  calculateSuggestedPrice,
  isSuggestedPriceViable,
} from "../pricing/suggested-price.ts";

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
  /** Percentual de perda de producao, aplicado sobre o custo do lote. */
  lossPercentage: number;
  /** Taxas proporcionais ao preco de venda (marketplace, tributos). */
  salesFeePercentage: number;
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
  lossCost: number;
  totalBatchCostWithLoss: number;
  unitCost: number;
  suggestedUnitPrice: number;
  suggestedBatchRevenue: number;
  salesFeeValue: number;
  unitProfit: number;
  batchProfit: number;
  effectiveMarginPercentage: number;
  /** false quando taxas + margem consomem 100% do preco. */
  isPricingViable: boolean;
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
  lossPercentage: 0,
  salesFeePercentage: 0,
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
    // Calculos salvos antes destes campos existirem hidratam com zero, o que
    // preserva o custo; o preco muda porque o modelo de margem mudou.
    lossPercentage: sanitizeNumber(input?.lossPercentage, 0),
    salesFeePercentage: sanitizeNumber(input?.salesFeePercentage, 0),
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
  const lossRate = Math.min(Math.max(0, input.lossPercentage), 100) / 100;
  const lossCost = totalBatchCost * lossRate;
  const totalBatchCostWithLoss = totalBatchCost + lossCost;
  const unitCost =
    input.unitsProduced > 0 ? totalBatchCostWithLoss / input.unitsProduced : 0;

  const variableFeeRate = Math.min(Math.max(0, input.salesFeePercentage), 100) / 100;
  const marginRate = Math.max(0, input.marginPercentage) / 100;
  const isPricingViable = isSuggestedPriceViable({ variableFeeRate, marginRate });
  const suggestedUnitPrice = calculateSuggestedPrice({
    costWithLoss: unitCost,
    variableFeeRate,
    marginRate,
  });

  const suggestedBatchRevenue = suggestedUnitPrice * input.unitsProduced;
  const salesFeeValue = suggestedUnitPrice * variableFeeRate;
  const unitProfit = suggestedUnitPrice - unitCost - salesFeeValue;
  const batchProfit = unitProfit * input.unitsProduced;
  const effectiveMarginPercentage =
    suggestedUnitPrice > 0 ? (unitProfit / suggestedUnitPrice) * 100 : 0;

  return {
    monthlyHours,
    hourlyCost,
    productionTimeHours,
    ingredientCost,
    ingredientBreakdown,
    timeCost,
    totalBatchCost,
    lossCost,
    totalBatchCostWithLoss,
    unitCost,
    suggestedUnitPrice,
    suggestedBatchRevenue,
    salesFeeValue,
    unitProfit,
    batchProfit,
    effectiveMarginPercentage,
    isPricingViable,
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
