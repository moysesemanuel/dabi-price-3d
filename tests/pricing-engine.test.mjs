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

test("reserva de expansão antiga não entra mais no subtotal protegido nem no preço", () => {
  const baseResult = calculate3DPrice(
    createBaseInput({
      expansionReserveCostPerHour: 0,
    }),
  );
  const legacyConfiguredResult = calculate3DPrice(
    createBaseInput({
      expansionReserveCostPerHour: 22,
    }),
  );

  assert.equal(Number(legacyConfiguredResult.expansionReserveCost.toFixed(2)), 0);
  assert.equal(
    Number(legacyConfiguredResult.costWithLoss.toFixed(2)),
    Number(baseResult.costWithLoss.toFixed(2)),
  );
  assert.equal(
    Number(legacyConfiguredResult.finalPrice.toFixed(2)),
    Number(baseResult.finalPrice.toFixed(2)),
  );
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

test("compõe material, energia, manutenção, embalagem, frete, mão de obra e tributos", () => {
  const result = calculate3DPrice(
    createBaseInput({
      pricingMode: "manual",
      manualSalePrice: 100,
      weightGrams: 100,
      filamentSpoolPrice: 100,
      filamentSpoolWeightGrams: 1000,
      printTimeHours: 2,
      printTimeMinutes: 0,
      printerPowerWatts: 100,
      kwhPrice: 1,
      maintenanceCostPerHour: 3,
      packagingCost: 4,
      shippingCost: 5,
      laborTimeHours: 1,
      laborTimeMinutes: 0,
      laborCostPerHour: 20,
      lossPercentage: 0,
      marketplaceFeePercentage: 10,
      marketplaceFixedFee: 2,
      taxPercentage: 5,
    }),
  );

  assert.equal(result.materialCost, 10);
  assert.equal(result.energyCost, 0.2);
  assert.equal(result.maintenanceCost, 6);
  assert.equal(result.packagingTotalCost, 4);
  assert.equal(result.shippingTotalCost, 5);
  assert.equal(result.laborTotalCost, 20);
  assert.equal(Number(result.baseCost.toFixed(2)), 45.2);
  assert.equal(result.marketplaceFee, 10);
  assert.equal(result.marketplaceFixedFeeCost, 2);
  assert.equal(result.taxCost, 5);
  assert.equal(Number(result.netProfit.toFixed(2)), 37.8);
});

test("valores zerados mantêm o resultado financeiro válido e finito", () => {
  const result = calculate3DPrice(
    createBaseInput({
      weightGrams: 0,
      printTimeHours: 0,
      printTimeMinutes: 0,
      shippingCost: 0,
      filamentSpoolPrice: 0,
      filamentSpoolWeightGrams: 0,
      printerPowerWatts: 0,
      kwhPrice: 0,
      packagingCost: 0,
      laborTimeHours: 0,
      laborTimeMinutes: 0,
      laborCostPerHour: 0,
      maintenanceCostPerHour: 0,
      lossPercentage: 0,
      profitMarginPercentage: 0,
      marketplaceFeePercentage: 0,
      marketplaceFixedFee: 0,
      taxPercentage: 0,
    }),
  );

  assert.equal(result.isValid, true);
  assert.equal(result.finalPrice, 0);
  assert.equal(result.netProfit, 0);
  assert.ok(Object.values(result).every((value) => typeof value !== "number" || Number.isFinite(value)));
});

test("carga alta de precificação mantém custos e preço finitos", () => {
  const result = calculate3DPrice(
    createBaseInput({
      weightGrams: 100_000,
      printTimeHours: 10_000,
      printTimeMinutes: 0,
      filamentSpoolPrice: 100_000,
      filamentSpoolWeightGrams: 100_000,
      printerPowerWatts: 10_000,
      kwhPrice: 100,
      packagingCost: 100_000,
      shippingCost: 100_000,
      laborTimeHours: 10_000,
      laborTimeMinutes: 0,
      laborCostPerHour: 100,
      maintenanceCostPerHour: 100,
      lossPercentage: 20,
      profitMarginPercentage: 30,
      marketplaceFeePercentage: 20,
      marketplaceFixedFee: 100_000,
      taxPercentage: 10,
    }),
  );

  assert.equal(result.isValid, true);
  assert.ok(Number.isFinite(result.costWithLoss));
  assert.ok(Number.isFinite(result.finalPrice));
  assert.ok(result.finalPrice >= result.costWithLoss);
});
