import assert from "node:assert/strict";
import test from "node:test";
import { calculate3DPrice } from "../src/lib/pricing/calculate-3d-price.ts";

function createBaseInput(overrides = {}) {
  return {
    productName: "Topo de Lápis",
    pricingMode: "margin",
    manualSalePrice: 0,
    promoEnabled: false,
    promoDiscountPercentage: 0,
    isKit: false,
    kitQuantity: 1,
    multiplePiecesEnabled: false,
    dividePrintTimeByPieces: false,
    divideFilamentByPieces: false,
    weightGrams: 100,
    quantity: 1,
    printTimeHours: 6,
    printTimeMinutes: 0,
    shippingCost: 0,
    filamentSpoolPrice: 100,
    filamentSpoolWeightGrams: 1000,
    printerPowerWatts: 100,
    kwhPrice: 1,
    packagingCost: 0,
    laborTimeHours: 0,
    laborTimeMinutes: 25,
    laborCostPerHour: 31.25,
    maintenanceCostPerHour: 2,
    expansionReserveCostPerHour: 0,
    lossPercentage: 10,
    lossLaborSharePercentage: 30,
    profitMarginPercentage: 20,
    marketplaceFeePercentage: 10,
    marketplaceFixedFee: 0,
    taxPercentage: 5,
    ...overrides,
  };
}

test("mão de obra usa só tempo operacional humano", () => {
  const result = calculate3DPrice(createBaseInput());

  assert.equal(result.laborTimeTotalHours, 25 / 60);
  assert.equal(Number(result.laborTotalCost.toFixed(2)), 13.02);
  assert.notEqual(Number(result.laborTotalCost.toFixed(2)), 187.5);
});

test("perdas afetam só a base permitida e respeitam a parcela configurável de mão de obra", () => {
  const result = calculate3DPrice(createBaseInput());

  assert.equal(Number(result.materialCost.toFixed(2)), 10);
  assert.equal(Number(result.energyCost.toFixed(2)), 0.6);
  assert.equal(Number(result.maintenanceCost.toFixed(2)), 12);
  assert.equal(Number(result.lossAffectedLaborCost.toFixed(2)), 3.91);
  assert.equal(Number(result.lossAffectedCostBase.toFixed(2)), 26.51);
  assert.equal(Number(result.lossReserveCost.toFixed(2)), 2.65);
});

test("lucro por hora usa hora operacional, não hora de impressão", () => {
  const result = calculate3DPrice(
    createBaseInput({
      pricingMode: "manual",
      manualSalePrice: 60,
      profitMarginPercentage: 0,
      lossPercentage: 0,
      marketplaceFeePercentage: 0,
      taxPercentage: 0,
      maintenanceCostPerHour: 0,
    }),
  );

  assert.equal(Number(result.netProfit.toFixed(2)), 36.38);
  assert.equal(Number(result.profitPerHour.toFixed(2)), 87.31);
});

test("modo manual com promoção preserva o preço final calculado pelo motor", () => {
  const result = calculate3DPrice(
    createBaseInput({
      pricingMode: "manual",
      manualSalePrice: 32.99,
      promoEnabled: true,
      promoDiscountPercentage: 10,
      lossPercentage: 0,
      maintenanceCostPerHour: 0,
      expansionReserveCostPerHour: 0,
      marketplaceFeePercentage: 0,
      taxPercentage: 0,
    }),
  );

  assert.equal(Number(result.commercialUnitPrice.toFixed(2)), 36.9);
  assert.equal(Number(result.promotionalUnitPrice?.toFixed(2) ?? 0), 33.21);
  assert.equal(Number(result.finalPrice.toFixed(2)), 33.21);
});

test("preço por margem inclui custo fixo, taxas variáveis e margem alvo", () => {
  const result = calculate3DPrice(
    createBaseInput({
      pricingMode: "margin",
      weightGrams: 50,
      printTimeHours: 2,
      laborTimeMinutes: 0,
      laborCostPerHour: 0,
      maintenanceCostPerHour: 0,
      expansionReserveCostPerHour: 0,
      shippingCost: 0,
      packagingCost: 0,
      lossPercentage: 0,
      marketplaceFeePercentage: 10,
      taxPercentage: 5,
      marketplaceFixedFee: 2,
      profitMarginPercentage: 20,
    }),
  );

  assert.equal(Number(result.costWithLoss.toFixed(2)), 5.2);
  assert.equal(Number(result.finalPrice.toFixed(2)), 11.9);
  assert.equal(Number(result.realMarginPercentage.toFixed(2)), 24.5);
});
