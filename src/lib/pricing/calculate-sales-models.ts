export type DirectSaleSummary = {
  customerPrice: number;
  amountReturnedToYou: number;
  costTotal: number;
  grossProfit: number;
  marginPercentage: number;
  safeMinimumPrice: number;
  isWorthIt: boolean;
};

export type ConsignmentSummary = {
  customerPrice: number;
  storeCommissionPercentage: number;
  storeCommissionValue: number;
  amountReturnedToYou: number;
  costTotal: number;
  grossProfit: number;
  marginPercentage: number;
  isWorthIt: boolean;
  recommendation: string;
  tone: "good" | "warning" | "danger";
};

export type WholesaleTier = {
  units: number;
  label: string;
  multiplier: number;
  unitPrice: number;
  totalPrice: number;
  unitProfit: number;
  totalProfit: number;
  isCloseToCost: boolean;
};

export type WholesaleSummary = {
  costTotal: number;
  safeMinimumPrice: number;
  tiers: WholesaleTier[];
};

type WholesaleTierConfig = {
  units: number;
  multiplier: number;
};

const WHOLESALE_TIERS: WholesaleTierConfig[] = [
  { units: 10, multiplier: 2.1 },
  { units: 20, multiplier: 2.0 },
  { units: 50, multiplier: 1.8 },
];

export function calculateProfitMargin(price: number, cost: number) {
  if (price <= 0) {
    return 0;
  }

  return ((price - cost) / price) * 100;
}

export function calculateSafeMinimumPrice(costTotal: number, multiplier = 1.8) {
  const safeCost = sanitizeNumber(costTotal);
  const safeMultiplier = Math.max(sanitizeNumber(multiplier), 1);
  const suggestedPrice = safeCost * safeMultiplier;

  return Math.max(safeCost, roundToHalfStep(suggestedPrice));
}

export function calculateChannelSafeMinimumPrice(input: {
  baseCost: number;
  variableFeePercentage: number;
  fixedFee: number;
  multiplier?: number;
}) {
  const safeBaseCost = sanitizeNumber(input.baseCost);
  const safeVariableFeeRate = clamp(
    sanitizeNumber(input.variableFeePercentage) / 100,
    0,
    0.99,
  );
  const safeFixedFee = sanitizeNumber(input.fixedFee);
  const safeMultiplier = Math.max(sanitizeNumber(input.multiplier ?? 1.8), 1);
  const targetNetAmount = safeBaseCost * safeMultiplier + safeFixedFee;
  const suggestedPrice =
    safeVariableFeeRate < 1
      ? targetNetAmount / (1 - safeVariableFeeRate)
      : safeBaseCost;

  return Math.max(safeBaseCost, roundToHalfStep(suggestedPrice));
}

export function calculateDirectSale(input: {
  customerPrice: number;
  costTotal: number;
}): DirectSaleSummary {
  const customerPrice = sanitizeNumber(input.customerPrice);
  const costTotal = sanitizeNumber(input.costTotal);
  const grossProfit = customerPrice - costTotal;

  return {
    customerPrice,
    amountReturnedToYou: customerPrice,
    costTotal,
    grossProfit,
    marginPercentage: calculateProfitMargin(customerPrice, costTotal),
    safeMinimumPrice: calculateSafeMinimumPrice(costTotal),
    isWorthIt: grossProfit > 0,
  };
}

export function calculateConsignment(input: {
  customerPrice: number;
  costTotal: number;
  commissionPercentage: number;
}): ConsignmentSummary {
  const customerPrice = sanitizeNumber(input.customerPrice);
  const costTotal = sanitizeNumber(input.costTotal);
  const storeCommissionPercentage = clamp(
    sanitizeNumber(input.commissionPercentage),
    0,
    100,
  );
  const storeCommissionValue =
    customerPrice * (storeCommissionPercentage / 100);
  const amountReturnedToYou = customerPrice - storeCommissionValue;
  const grossProfit = amountReturnedToYou - costTotal;
  const marginPercentage =
    customerPrice > 0 ? (grossProfit / customerPrice) * 100 : 0;

  let recommendation = `Consignado viável. Você ainda fica com ${formatMoney(
    grossProfit,
  )} de lucro por unidade.`;
  let tone: ConsignmentSummary["tone"] = "good";

  if (grossProfit <= 0) {
    recommendation =
      "Atenção: nesse formato você empata ou perde dinheiro após a comissão.";
    tone = "danger";
  } else if (grossProfit < costTotal * 0.35 || marginPercentage < 15) {
    recommendation =
      "Atenção: a comissão está deixando sua margem muito baixa.";
    tone = "warning";
  }

  return {
    customerPrice,
    storeCommissionPercentage,
    storeCommissionValue,
    amountReturnedToYou,
    costTotal,
    grossProfit,
    marginPercentage,
    isWorthIt: grossProfit > 0,
    recommendation,
    tone,
  };
}

export function calculateWholesale(input: {
  costTotal: number;
}): WholesaleSummary {
  const costTotal = sanitizeNumber(input.costTotal);
  const safeMinimumPrice = calculateSafeMinimumPrice(costTotal);

  return {
    costTotal,
    safeMinimumPrice,
    tiers: WHOLESALE_TIERS.map((tier) => {
      const rawUnitPrice = costTotal * tier.multiplier;
      const unitPrice = Math.max(costTotal, roundToHalfStep(rawUnitPrice));
      const unitProfit = unitPrice - costTotal;

      return {
        units: tier.units,
        label: `${tier.units} unidades`,
        multiplier: tier.multiplier,
        unitPrice,
        totalPrice: unitPrice * tier.units,
        unitProfit,
        totalProfit: unitProfit * tier.units,
        isCloseToCost: unitProfit <= costTotal * 0.2,
      };
    }),
  };
}

function roundToHalfStep(value: number) {
  return Math.round(sanitizeNumber(value) * 2) / 2;
}

function sanitizeNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(sanitizeNumber(value));
}
