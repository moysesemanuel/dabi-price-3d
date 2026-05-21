import type { Calculate3DPriceResult } from "@/lib/pricing/calculate-3d-price";
import type { PricingFormState } from "@/lib/pricing/initial-pricing-form";

export type PricingViewModel = {
  displayedSalePrice: number;
  baseSalePrice: number;
  promotionalSalePrice: number | null;
  parsedPromoDiscount: number;
  unitMarketplaceFee: number;
  unitMarketplaceFixedFee: number;
  unitTaxCost: number;
  unitEnergyCost: number;
  unitShippingCost: number;
  unitMaterialCost: number;
  unitPackagingCost: number;
  unitMaintenanceCost: number;
  unitLaborCost: number;
  unitLossCost: number;
  unitProductionCost: number;
  unitTotalCost: number;
  unitProfit: number;
  lotProfit: number;
  realMarginPercentage: number;
  profitPerHour: number;
  lotsPerDay: number;
  unitsPerDay: number;
  estimatedDailyProfit: number;
  lotsPerMonth: number;
  unitsPerMonth: number;
  estimatedMonthlyProfit: number;
  materialGrams: number;
  safeQuantity: number;
};

export function buildPricingViewModel(
  form: PricingFormState,
  result: Calculate3DPriceResult,
): PricingViewModel {
  const safeQuantity = result.quantity > 0 ? result.quantity : 1;
  const parsedManualSalePrice = parseDecimal(form.manualSalePrice);
  const parsedPromoDiscount = parseDecimal(form.promoDiscountPercentage);

  const baseSalePrice =
    form.pricingMode === "manual" && parsedManualSalePrice > 0
      ? parsedManualSalePrice
      : result.commercialUnitPrice;

  const promotionalSalePrice =
    form.promoEnabled && parsedPromoDiscount > 0
      ? baseSalePrice * (1 - parsedPromoDiscount / 100)
      : null;

  const displayedSalePrice = promotionalSalePrice ?? baseSalePrice;

  const unitMarketplaceFee = result.marketplaceFee / safeQuantity;
  const unitMarketplaceFixedFee = result.marketplaceFixedFeeCost / safeQuantity;
  const unitTaxCost = result.taxCost / safeQuantity;
  const unitEnergyCost = result.energyCost / safeQuantity;
  const unitShippingCost = result.shippingTotalCost / safeQuantity;
  const unitMaterialCost = result.materialCost / safeQuantity;
  const unitPackagingCost = result.packagingTotalCost / safeQuantity;
  const unitMaintenanceCost = result.maintenanceCost / safeQuantity;
  const unitLaborCost = result.laborTotalCost / safeQuantity;
  const unitLossCost =
    Math.max(result.costWithLoss - result.baseCost, 0) / safeQuantity;

  const unitProductionCost = result.costWithLoss / safeQuantity;
  const unitTotalCost =
    unitProductionCost +
    unitMarketplaceFee +
    unitMarketplaceFixedFee +
    unitTaxCost;

  const unitProfit = result.unitNetProfit;
  const lotProfit = result.totalNetProfit;
  const realMarginPercentage =
    displayedSalePrice > 0 ? (unitProfit / displayedSalePrice) * 100 : 0;

  const profitPerHour =
    result.printTimeTotalHours > 0
      ? result.totalNetProfit / result.printTimeTotalHours
      : result.profitPerHour;

  const lotsPerDay =
    result.printTimeTotalHours > 0 ? 20 / result.printTimeTotalHours : 0;
  const unitsPerDay = lotsPerDay * safeQuantity;
  const estimatedDailyProfit = profitPerHour * 20;
  const lotsPerMonth = lotsPerDay * 30;
  const unitsPerMonth = unitsPerDay * 30;
  const estimatedMonthlyProfit = estimatedDailyProfit * 30;

  const materialGrams =
    result.costPerGram > 0
      ? Math.round(result.materialCost / result.costPerGram / safeQuantity)
      : 0;

  return {
    displayedSalePrice,
    baseSalePrice,
    promotionalSalePrice,
    parsedPromoDiscount,
    unitMarketplaceFee,
    unitMarketplaceFixedFee,
    unitTaxCost,
    unitEnergyCost,
    unitShippingCost,
    unitMaterialCost,
    unitPackagingCost,
    unitMaintenanceCost,
    unitLaborCost,
    unitLossCost,
    unitProductionCost,
    unitTotalCost,
    unitProfit,
    lotProfit,
    realMarginPercentage,
    profitPerHour,
    lotsPerDay,
    unitsPerDay,
    estimatedDailyProfit,
    lotsPerMonth,
    unitsPerMonth,
    estimatedMonthlyProfit,
    materialGrams,
    safeQuantity,
  };
}

function parseDecimal(value: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalizedValue = value.replace(",", ".");
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}
