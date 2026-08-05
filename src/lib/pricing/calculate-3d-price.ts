export type PricingMode = "manual" | "margin";

export type Calculate3DPriceInput = {
  productName: string;

  pricingMode?: PricingMode;
  manualSalePrice?: number;
  promoEnabled?: boolean;
  promoDiscountPercentage?: number;
  isKit?: boolean;
  kitQuantity?: number;

  multiplePiecesEnabled?: boolean;
  dividePrintTimeByPieces?: boolean;
  divideFilamentByPieces?: boolean;

  weightGrams: number;
  quantity: number;
  printTimeHours: number;
  printTimeMinutes: number;

  shippingCost: number;
  filamentSpoolPrice: number;
  filamentSpoolWeightGrams: number;
  printerPowerWatts: number;
  kwhPrice: number;
  packagingCost: number;
  laborTimeHours: number;
  laborTimeMinutes: number;
  laborCostPerHour: number;
  maintenanceCostPerHour: number;
  expansionReserveCostPerHour: number;
  lossPercentage: number;
  lossLaborSharePercentage: number;
  profitMarginPercentage: number;
  marketplaceFeePercentage: number;
  marketplaceFixedFee: number;
  taxPercentage: number;
};

export type Calculate3DPriceResult = {
  isValid: boolean;
  errorMessage?: string;

  quantity: number;
  piecesPerCycle: number;
  piecesPerSaleUnit: number;
  cyclesPerSaleUnit: number;
  saleUnitsPerCycle: number;
  printTimePerCycleHours: number;

  costPerGram: number;
  materialCost: number;
  printTimeTotalHours: number;
  laborTimeTotalHours: number;
  energyCost: number;
  maintenanceCost: number;
  expansionReserveCost: number;
  packagingTotalCost: number;
  shippingTotalCost: number;
  laborTotalCost: number;
  baseCost: number;
  lossAffectedLaborCost: number;
  lossAffectedCostBase: number;
  lossReserveCost: number;
  costWithLoss: number;

  targetPriceBeforeFees: number;
  finalPrice: number;
  unitFinalPrice: number;
  totalFinalPrice: number;

  commercialUnitPrice: number;
  commercialTotalPrice: number;
  extraProfitWithCommercialPrice: number;

  marketplaceFee: number;
  marketplaceFixedFeeCost: number;
  taxCost: number;

  netProfit: number;
  unitNetProfit: number;
  totalNetProfit: number;
  variableFeesPercentage: number;
  desiredMarginPercentage: number;
  realMarginPercentage: number;
  profitPerHour: number;

  pricingMode: PricingMode;
  saleUnitPriceBeforePromotion: number;
  promotionalUnitPrice: number | null;
  promoDiscountPercentage: number;
};

export function calculate3DPrice(
  input: Calculate3DPriceInput
): Calculate3DPriceResult {
  const pricingMode = input.pricingMode ?? "margin";

  const multiplePiecesEnabled = input.multiplePiecesEnabled ?? false;
  const dividePrintTimeByPieces = input.dividePrintTimeByPieces ?? true;
  const divideFilamentByPieces = input.divideFilamentByPieces ?? true;
  const isKit = input.isKit ?? false;
  const kitQuantity = isKit ? Math.max(input.kitQuantity ?? 1, 1) : 1;
  const piecesPerCycle = multiplePiecesEnabled ? Math.max(input.quantity, 1) : 1;
  const piecesPerSaleUnit = kitQuantity;
  const cyclesPerSaleUnit = piecesPerSaleUnit / piecesPerCycle;
  const saleUnitsPerCycle = piecesPerSaleUnit > 0 ? 1 / cyclesPerSaleUnit : 1;
  const quantity = 1;

  const unitPrintTimeHours =
    sanitizeNumber(input.printTimeHours) + sanitizeNumber(input.printTimeMinutes) / 60;

  const printTimePerCycleHours =
    multiplePiecesEnabled && dividePrintTimeByPieces
      ? unitPrintTimeHours
      : unitPrintTimeHours * piecesPerCycle;

  const printTimeTotalHours = printTimePerCycleHours * cyclesPerSaleUnit;
  const laborTimeTotalHours =
    sanitizeNumber(input.laborTimeHours) +
    sanitizeNumber(input.laborTimeMinutes) / 60;

  const costPerGram =
    input.filamentSpoolWeightGrams > 0
      ? sanitizeNumber(input.filamentSpoolPrice) /
        sanitizeNumber(input.filamentSpoolWeightGrams)
      : 0;

  const weightPerCycleGrams =
    multiplePiecesEnabled && divideFilamentByPieces
      ? sanitizeNumber(input.weightGrams)
      : sanitizeNumber(input.weightGrams) * piecesPerCycle;

  const totalWeightGrams = weightPerCycleGrams * cyclesPerSaleUnit;

  const materialCost = totalWeightGrams * costPerGram;

  const energyCost =
    (sanitizeNumber(input.printerPowerWatts) / 1000) *
    printTimeTotalHours *
    sanitizeNumber(input.kwhPrice);

  const maintenanceCost =
    printTimeTotalHours * sanitizeNumber(input.maintenanceCostPerHour);
  const expansionReserveCost =
    printTimeTotalHours * sanitizeNumber(input.expansionReserveCostPerHour);

  const packagingTotalCost = sanitizeNumber(input.packagingCost);
  const shippingTotalCost = sanitizeNumber(input.shippingCost);
  const laborTotalCost =
    laborTimeTotalHours * sanitizeNumber(input.laborCostPerHour);

  const baseCost =
    materialCost +
    energyCost +
    maintenanceCost +
    expansionReserveCost +
    packagingTotalCost +
    shippingTotalCost +
    laborTotalCost;

  // Losses should affect only costs that tend to repeat in a reprint cycle.
  const lossLaborShareRate =
    clamp(sanitizeNumber(input.lossLaborSharePercentage), 0, 100) / 100;
  const lossAffectedLaborCost = laborTotalCost * lossLaborShareRate;
  const lossAffectedCostBase =
    materialCost +
    energyCost +
    maintenanceCost +
    lossAffectedLaborCost;
  const lossReserveCost =
    lossAffectedCostBase * (sanitizeNumber(input.lossPercentage) / 100);
  const costWithLoss = baseCost + lossReserveCost;

  const marketplaceRate = sanitizeNumber(input.marketplaceFeePercentage) / 100;
  const taxRate = sanitizeNumber(input.taxPercentage) / 100;
  const desiredMarginRate = sanitizeNumber(input.profitMarginPercentage) / 100;

  const marketplaceFixedFeeCost = sanitizeNumber(input.marketplaceFixedFee);

  const variableFeeRate = marketplaceRate + taxRate;

  const isValidFees =
    pricingMode === "manual"
      ? variableFeeRate < 1
      : variableFeeRate + desiredMarginRate < 1;

  const targetPriceBeforeFees = costWithLoss;

  const priceByMargin = isValidFees
    ? (costWithLoss + marketplaceFixedFeeCost) /
      (1 - variableFeeRate - desiredMarginRate)
    : 0;

  const manualTotalPrice =
    sanitizeNumber(input.manualSalePrice) > 0 ? sanitizeNumber(input.manualSalePrice) : 0;

  const totalPriceBeforePromotion =
    pricingMode === "manual" && manualTotalPrice > 0
      ? manualTotalPrice
      : priceByMargin;

  const saleUnitPriceBeforePromotion = totalPriceBeforePromotion;

  const promoDiscountPercentage =
    input.promoEnabled === true
      ? clamp(sanitizeNumber(input.promoDiscountPercentage), 0, 99)
      : 0;

  const promoRate = promoDiscountPercentage / 100;

  const commercialUnitPrice =
    promoRate > 0
      ? roundUpToCommercialPrice(saleUnitPriceBeforePromotion / (1 - promoRate))
      : pricingMode === "manual"
        ? saleUnitPriceBeforePromotion
        : roundUpToCommercialPrice(saleUnitPriceBeforePromotion);

  const commercialTotalPrice = commercialUnitPrice;

  const promotionalUnitPrice =
    promoRate > 0 ? commercialUnitPrice * (1 - promoRate) : null;

  const effectiveUnitSalePrice = promotionalUnitPrice ?? commercialUnitPrice;
  const finalPrice = effectiveUnitSalePrice;

  const unitFinalPrice = finalPrice;
  const totalFinalPrice = finalPrice;

  const marketplaceFee = finalPrice * marketplaceRate;
  const taxCost = finalPrice * taxRate;

  const netProfit =
    finalPrice -
    marketplaceFee -
    taxCost -
    marketplaceFixedFeeCost -
    costWithLoss;

  const unitNetProfit = netProfit;
  const totalNetProfit = netProfit;
  const variableFeesPercentage = variableFeesPercentageToPercent(variableFeeRate);
  const desiredMarginPercentage = desiredMarginRate * 100;

  const realMarginPercentage =
    finalPrice > 0 ? (netProfit / finalPrice) * 100 : 0;

  const profitPerHour =
    laborTimeTotalHours > 0 ? netProfit / laborTimeTotalHours : 0;

  const extraProfitWithCommercialPrice =
    commercialTotalPrice - totalPriceBeforePromotion;

  return {
    isValid: isValidFees,
    errorMessage: isValidFees
      ? undefined
      : pricingMode === "manual"
        ? "A soma da taxa do marketplace com o imposto precisa ser menor que 100%."
        : "A soma da taxa do marketplace, imposto e margem desejada precisa ser menor que 100%.",

    quantity,
    piecesPerCycle,
    piecesPerSaleUnit,
    cyclesPerSaleUnit,
    saleUnitsPerCycle,
    printTimePerCycleHours,

    costPerGram,
    materialCost,
    printTimeTotalHours,
    laborTimeTotalHours,
    energyCost,
    maintenanceCost,
    expansionReserveCost,
    packagingTotalCost,
    shippingTotalCost,
    laborTotalCost,
    baseCost,
    lossAffectedLaborCost,
    lossAffectedCostBase,
    lossReserveCost,
    costWithLoss,

    targetPriceBeforeFees,
    finalPrice,
    unitFinalPrice,
    totalFinalPrice,

    commercialUnitPrice,
    commercialTotalPrice,
    extraProfitWithCommercialPrice,

    marketplaceFee,
    marketplaceFixedFeeCost,
    taxCost,

    netProfit,
    unitNetProfit,
    totalNetProfit,
    variableFeesPercentage,
    desiredMarginPercentage,
    realMarginPercentage,
    profitPerHour,

    pricingMode,
    saleUnitPriceBeforePromotion,
    promotionalUnitPrice,
    promoDiscountPercentage,
  };
}

function roundUpToCommercialPrice(value: number) {
  if (value <= 0) {
    return 0;
  }

  // Very low ticket items need cent-level or deci-level rounding,
  // otherwise the UI gets "stuck" on 0,90 / 1,90 and the desired
  // contribution margin appears to not react.
  if (value < 1) {
    return roundUpToStep(value, 0.01);
  }

  if (value < 10) {
    return roundUpToStep(value, 0.1);
  }

  const roundedBase = Math.floor(value);

  if (value <= roundedBase + 0.9) {
    return roundedBase + 0.9;
  }

  return roundedBase + 1.9;
}

function roundUpToStep(value: number, step: number) {
  return Math.ceil(value / step) * step;
}

function sanitizeNumber(value: number | undefined | null) {
  if (typeof value !== "number") {
    return 0;
  }

  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function variableFeesPercentageToPercent(rate: number) {
  return rate * 100;
}
