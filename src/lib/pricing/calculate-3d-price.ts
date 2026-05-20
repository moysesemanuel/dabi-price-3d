export type PricingMode = "manual" | "margin";

export type Calculate3DPriceInput = {
  productName: string;

  pricingMode?: PricingMode;
  manualSalePrice?: number;
  promoEnabled?: boolean;
  promoDiscountPercentage?: number;

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
  laborCost: number;
  maintenanceCostPerHour: number;
  lossPercentage: number;
  profitMarginPercentage: number;
  marketplaceFeePercentage: number;
  marketplaceFixedFee: number;
  taxPercentage: number;
};

export type Calculate3DPriceResult = {
  isValid: boolean;
  errorMessage?: string;

  quantity: number;

  costPerGram: number;
  materialCost: number;
  printTimeTotalHours: number;
  energyCost: number;
  maintenanceCost: number;
  packagingTotalCost: number;
  shippingTotalCost: number;
  laborTotalCost: number;
  baseCost: number;
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

  const quantity = multiplePiecesEnabled ? Math.max(input.quantity, 1) : 1;

  const unitPrintTimeHours =
    sanitizeNumber(input.printTimeHours) + sanitizeNumber(input.printTimeMinutes) / 60;

  const printTimeTotalHours =
    multiplePiecesEnabled && dividePrintTimeByPieces
      ? unitPrintTimeHours
      : unitPrintTimeHours * quantity;

  const costPerGram =
    input.filamentSpoolWeightGrams > 0
      ? sanitizeNumber(input.filamentSpoolPrice) /
        sanitizeNumber(input.filamentSpoolWeightGrams)
      : 0;

  const totalWeightGrams =
    multiplePiecesEnabled && divideFilamentByPieces
      ? sanitizeNumber(input.weightGrams)
      : sanitizeNumber(input.weightGrams) * quantity;

  const materialCost = totalWeightGrams * costPerGram;

  const energyCost =
    (sanitizeNumber(input.printerPowerWatts) / 1000) *
    printTimeTotalHours *
    sanitizeNumber(input.kwhPrice);

  const maintenanceCost =
    printTimeTotalHours * sanitizeNumber(input.maintenanceCostPerHour);

  const packagingTotalCost = sanitizeNumber(input.packagingCost) * quantity;
  const shippingTotalCost = sanitizeNumber(input.shippingCost) * quantity;
  const laborTotalCost = sanitizeNumber(input.laborCost);

  const baseCost =
    materialCost +
    energyCost +
    maintenanceCost +
    packagingTotalCost +
    shippingTotalCost +
    laborTotalCost;

  const costWithLoss =
    baseCost * (1 + sanitizeNumber(input.lossPercentage) / 100);

  const marketplaceRate = sanitizeNumber(input.marketplaceFeePercentage) / 100;
  const taxRate = sanitizeNumber(input.taxPercentage) / 100;
  const desiredMarginRate = sanitizeNumber(input.profitMarginPercentage) / 100;

  const marketplaceFixedFeeCost =
    sanitizeNumber(input.marketplaceFixedFee) * quantity;

  const variableFeesPercentage = marketplaceRate + taxRate;

  const isValidFees =
    pricingMode === "manual"
      ? variableFeesPercentage < 1
      : variableFeesPercentage + desiredMarginRate < 1;

  const targetPriceBeforeFees = costWithLoss;

  const priceByMargin = isValidFees
    ? (costWithLoss + marketplaceFixedFeeCost) /
      (1 - variableFeesPercentage - desiredMarginRate)
    : 0;

  const manualTotalPrice =
    sanitizeNumber(input.manualSalePrice) > 0
      ? sanitizeNumber(input.manualSalePrice) * quantity
      : 0;

  const totalPriceBeforePromotion =
    pricingMode === "manual" && manualTotalPrice > 0
      ? manualTotalPrice
      : priceByMargin;

  const saleUnitPriceBeforePromotion =
    quantity > 0 ? totalPriceBeforePromotion / quantity : 0;

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

  const commercialTotalPrice = commercialUnitPrice * quantity;

  const promotionalUnitPrice =
    promoRate > 0 ? commercialUnitPrice * (1 - promoRate) : null;

  const effectiveUnitSalePrice = promotionalUnitPrice ?? commercialUnitPrice;
  const finalPrice = effectiveUnitSalePrice * quantity;

  const unitFinalPrice = quantity > 0 ? finalPrice / quantity : 0;
  const totalFinalPrice = finalPrice;

  const marketplaceFee = finalPrice * marketplaceRate;
  const taxCost = finalPrice * taxRate;

  const netProfit =
    finalPrice -
    marketplaceFee -
    taxCost -
    marketplaceFixedFeeCost -
    costWithLoss;

  const unitNetProfit = quantity > 0 ? netProfit / quantity : 0;
  const totalNetProfit = netProfit;

  const realMarginPercentage =
    finalPrice > 0 ? (netProfit / finalPrice) * 100 : 0;

  const profitPerHour =
    printTimeTotalHours > 0 ? netProfit / printTimeTotalHours : 0;

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

    costPerGram,
    materialCost,
    printTimeTotalHours,
    energyCost,
    maintenanceCost,
    packagingTotalCost,
    shippingTotalCost,
    laborTotalCost,
    baseCost,
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

  const roundedBase = Math.floor(value);

  if (value <= roundedBase + 0.9) {
    return roundedBase + 0.9;
  }

  return roundedBase + 1.9;
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