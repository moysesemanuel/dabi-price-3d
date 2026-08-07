import type { Calculate3DPriceResult } from "@/lib/pricing/calculate-3d-price";
import type { PricingFormState } from "@/lib/pricing/initial-pricing-form";

export type PricingViewModel = {
  displayedSalePrice: number;
  baseSalePrice: number;
  promotionalSalePrice: number | null;
  parsedPromoDiscount: number;
  kitQuantity: number;
  piecesPerCycle: number;
  piecesPerSaleUnit: number;
  cyclesPerSaleUnit: number;
  saleUnitsPerCycle: number;
  printTimePerCycleHours: number;
  salePricePerKitItem: number;
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
  unitThirdPartyCost: number;
  unitOperationalReserveCost: number;
  unitProfit: number;
  totalCostPerKitItem: number;
  profitPerKitItem: number;
  lotProfit: number;
  realMarginPercentage: number;
  profitPerHour: number;
  lotsPerDay: number;
  unitsPerDay: number;
  kitItemsPerDay: number;
  estimatedDailyProfit: number;
  lotsPerMonth: number;
  unitsPerMonth: number;
  kitItemsPerMonth: number;
  estimatedMonthlyProfit: number;
  materialGrams: number;
  safeQuantity: number;
};

export function buildPricingViewModel(
  form: PricingFormState,
  result: Calculate3DPriceResult,
): PricingViewModel {
  const kitQuantity = form.isKit ? Math.max(form.kitQuantity, 1) : 1;
  const safeQuantity = result.saleUnitsPerCycle > 0 ? result.saleUnitsPerCycle : 1;

  const baseSalePrice = result.commercialUnitPrice;
  const promotionalSalePrice = result.promotionalUnitPrice;
  const displayedSalePrice = result.finalPrice;
  const parsedPromoDiscount = result.promoDiscountPercentage;

  const unitMarketplaceFee = result.marketplaceFee;
  const unitMarketplaceFixedFee = result.marketplaceFixedFeeCost;
  const unitTaxCost = result.taxCost;
  const unitEnergyCost = result.energyCost;
  const unitShippingCost = result.shippingTotalCost;
  const unitMaterialCost = result.materialCost;
  const unitPackagingCost = result.packagingTotalCost;
  const unitMaintenanceCost = result.maintenanceCost;
  const unitLaborCost = result.laborTotalCost;
  const unitLossCost = Math.max(result.costWithLoss - result.baseCost, 0);

  const unitProductionCost = result.costWithLoss;
  const unitTotalCost =
    unitProductionCost +
    unitMarketplaceFee +
    unitMarketplaceFixedFee +
    unitTaxCost;
  const unitThirdPartyCost =
    unitMaterialCost +
    unitEnergyCost +
    unitPackagingCost +
    unitShippingCost +
    unitMarketplaceFee +
    unitMarketplaceFixedFee +
    unitTaxCost;
  const unitOperationalReserveCost = unitMaintenanceCost + unitLossCost;

  const unitProfit = result.unitNetProfit;
  const salePricePerKitItem = displayedSalePrice / kitQuantity;
  const totalCostPerKitItem = unitTotalCost / kitQuantity;
  const profitPerKitItem = unitProfit / kitQuantity;
  const lotProfit = result.totalNetProfit * result.saleUnitsPerCycle;
  const realMarginPercentage =
    displayedSalePrice > 0 ? (unitProfit / displayedSalePrice) * 100 : 0;

  const profitPerHour = result.profitPerHour;

  const lotsPerDay =
    result.printTimePerCycleHours > 0 ? 20 / result.printTimePerCycleHours : 0;
  const unitsPerDay = lotsPerDay * result.saleUnitsPerCycle;
  const kitItemsPerDay = unitsPerDay * kitQuantity;
  const estimatedDailyProfit = unitsPerDay * unitProfit;
  const lotsPerMonth = lotsPerDay * 30;
  const unitsPerMonth = unitsPerDay * 30;
  const kitItemsPerMonth = kitItemsPerDay * 30;
  const estimatedMonthlyProfit = estimatedDailyProfit * 30;

  const materialGrams =
    result.costPerGram > 0
      ? Math.round(result.materialCost / result.costPerGram)
      : 0;

  return {
    displayedSalePrice,
    baseSalePrice,
    promotionalSalePrice,
    parsedPromoDiscount,
    kitQuantity,
    piecesPerCycle: result.piecesPerCycle,
    piecesPerSaleUnit: result.piecesPerSaleUnit,
    cyclesPerSaleUnit: result.cyclesPerSaleUnit,
    saleUnitsPerCycle: result.saleUnitsPerCycle,
    printTimePerCycleHours: result.printTimePerCycleHours,
    salePricePerKitItem,
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
    unitThirdPartyCost,
    unitOperationalReserveCost,
    unitProfit,
    totalCostPerKitItem,
    profitPerKitItem,
    lotProfit,
    realMarginPercentage,
    profitPerHour,
    lotsPerDay,
    unitsPerDay,
    kitItemsPerDay,
    estimatedDailyProfit,
    lotsPerMonth,
    unitsPerMonth,
    kitItemsPerMonth,
    estimatedMonthlyProfit,
    materialGrams,
    safeQuantity,
  };
}
