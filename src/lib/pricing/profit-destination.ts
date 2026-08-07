export type ProfitDestinationPercentages = {
  expansionPercentage: number;
  cashReservePercentage: number;
  ownerDistributionPercentage: number;
};

export type ProfitDestinationValidation = {
  isValid: boolean;
  totalPercentage: number;
  errorMessage: string | null;
};

export type ProfitDestinationBreakdown = ProfitDestinationValidation & {
  estimatedProfit: number;
  distributableProfit: number;
  expansionAmount: number;
  cashReserveAmount: number;
  ownerDistributionAmount: number;
};

export const defaultProfitDestinationPercentages: ProfitDestinationPercentages = {
  expansionPercentage: 40,
  cashReservePercentage: 40,
  ownerDistributionPercentage: 20,
};

export function normalizeProfitDestinationPercentages(
  value?: Partial<ProfitDestinationPercentages> | null,
): ProfitDestinationPercentages {
  return {
    expansionPercentage: sanitizePercentage(
      value?.expansionPercentage,
      defaultProfitDestinationPercentages.expansionPercentage,
    ),
    cashReservePercentage: sanitizePercentage(
      value?.cashReservePercentage,
      defaultProfitDestinationPercentages.cashReservePercentage,
    ),
    ownerDistributionPercentage: sanitizePercentage(
      value?.ownerDistributionPercentage,
      defaultProfitDestinationPercentages.ownerDistributionPercentage,
    ),
  };
}

export function validateProfitDestinationPercentages(
  value: ProfitDestinationPercentages,
): ProfitDestinationValidation {
  const totalPercentage =
    sanitizePercentage(value.expansionPercentage, 0) +
    sanitizePercentage(value.cashReservePercentage, 0) +
    sanitizePercentage(value.ownerDistributionPercentage, 0);
  const isValid = Math.abs(totalPercentage - 100) < 0.001;

  return {
    isValid,
    totalPercentage,
    errorMessage: isValid
      ? null
      : "A soma da destinação do lucro precisa ser exatamente 100%.",
  };
}

export function calculateProfitDestinationBreakdown(input: {
  estimatedProfit: number;
  percentages: ProfitDestinationPercentages;
}): ProfitDestinationBreakdown {
  const percentages = normalizeProfitDestinationPercentages(input.percentages);
  const validation = validateProfitDestinationPercentages(percentages);
  const estimatedProfit = sanitizeMoney(input.estimatedProfit);
  const distributableProfit = Math.max(estimatedProfit, 0);

  return {
    ...validation,
    estimatedProfit,
    distributableProfit,
    expansionAmount:
      distributableProfit * (percentages.expansionPercentage / 100),
    cashReserveAmount:
      distributableProfit * (percentages.cashReservePercentage / 100),
    ownerDistributionAmount:
      distributableProfit * (percentages.ownerDistributionPercentage / 100),
  };
}

function sanitizePercentage(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function sanitizeMoney(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
