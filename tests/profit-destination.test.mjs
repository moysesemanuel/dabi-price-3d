import assert from "node:assert/strict";
import test from "node:test";
import { calculate3DPrice } from "../src/lib/pricing/calculate-3d-price.ts";
import {
  calculateProfitDestinationBreakdown,
  validateProfitDestinationPercentages,
} from "../src/lib/pricing/profit-destination.ts";

function createInput(overrides = {}) {
  return {
    productName: "Suporte articulado",
    pricingMode: "manual",
    manualSalePrice: 80,
    promoEnabled: false,
    promoDiscountPercentage: 0,
    isKit: false,
    kitQuantity: 1,
    multiplePiecesEnabled: false,
    dividePrintTimeByPieces: false,
    divideFilamentByPieces: false,
    weightGrams: 80,
    quantity: 1,
    printTimeHours: 4,
    printTimeMinutes: 0,
    shippingCost: 0,
    filamentSpoolPrice: 100,
    filamentSpoolWeightGrams: 1000,
    printerPowerWatts: 100,
    kwhPrice: 1,
    packagingCost: 2,
    laborTimeHours: 0,
    laborTimeMinutes: 30,
    laborCostPerHour: 30,
    maintenanceCostPerHour: 2,
    expansionReserveCostPerHour: 15,
    lossPercentage: 5,
    lossLaborSharePercentage: 20,
    profitMarginPercentage: 50,
    marketplaceFeePercentage: 10,
    marketplaceFixedFee: 0,
    taxPercentage: 0,
    ...overrides,
  };
}

test("destinação do lucro calcula percentuais e valores sem alterar o preço de venda", () => {
  const result = calculate3DPrice(createInput());
  const salePriceBeforeBreakdown = result.finalPrice;
  const breakdown = calculateProfitDestinationBreakdown({
    estimatedProfit: 10,
    percentages: {
      expansionPercentage: 40,
      cashReservePercentage: 40,
      ownerDistributionPercentage: 20,
    },
  });

  assert.equal(result.finalPrice, salePriceBeforeBreakdown);
  assert.equal(breakdown.isValid, true);
  assert.equal(Number(breakdown.expansionAmount.toFixed(2)), 4);
  assert.equal(Number(breakdown.cashReserveAmount.toFixed(2)), 4);
  assert.equal(Number(breakdown.ownerDistributionAmount.toFixed(2)), 2);
});

test("destinação do lucro exige soma total de 100%", () => {
  const validation = validateProfitDestinationPercentages({
    expansionPercentage: 30,
    cashReservePercentage: 30,
    ownerDistributionPercentage: 30,
  });

  assert.equal(validation.isValid, false);
  assert.equal(validation.totalPercentage, 90);
});

test("lucro zerado ou negativo não gera valores positivos para distribuição", () => {
  const breakdown = calculateProfitDestinationBreakdown({
    estimatedProfit: -12,
    percentages: {
      expansionPercentage: 40,
      cashReservePercentage: 40,
      ownerDistributionPercentage: 20,
    },
  });

  assert.equal(breakdown.distributableProfit, 0);
  assert.equal(breakdown.expansionAmount, 0);
  assert.equal(breakdown.cashReserveAmount, 0);
  assert.equal(breakdown.ownerDistributionAmount, 0);
});
