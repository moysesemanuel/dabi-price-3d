import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateChannelSafeMinimumPrice,
  calculateConsignment,
  calculateDirectSale,
  calculateWholesale,
} from "../src/lib/pricing/calculate-sales-models.ts";

test("preço mínimo por canal cobre taxa variável e margem-alvo", () => {
  const minimumPrice = calculateChannelSafeMinimumPrice({
    baseCost: 27.19,
    variableFeePercentage: 16.5,
    fixedFee: 0,
    targetMarginPercentage: 30,
  });

  assert.equal(minimumPrice, 50.83);
});

test("venda direta mostra o que volta integralmente para a operação", () => {
  const summary = calculateDirectSale({
    customerPrice: 50,
    costTotal: 35,
  });

  assert.deepEqual(
    {
      customerPrice: summary.customerPrice,
      amountReturnedToYou: summary.amountReturnedToYou,
      grossProfit: summary.grossProfit,
      marginPercentage: summary.marginPercentage,
      safeMinimumPrice: summary.safeMinimumPrice,
      isWorthIt: summary.isWorthIt,
    },
    {
      customerPrice: 50,
      amountReturnedToYou: 50,
      grossProfit: 15,
      marginPercentage: 30,
      safeMinimumPrice: 63,
      isWorthIt: true,
    },
  );
});

test("consignado sinaliza cenário ruim quando a comissão destrói a margem", () => {
  const summary = calculateConsignment({
    customerPrice: 32.99,
    costTotal: 27.19,
    commissionPercentage: 30,
  });

  assert.equal(summary.tone, "danger");
  assert.equal(summary.isWorthIt, false);
  assert.match(summary.recommendation, /empata ou perde dinheiro/i);
  assert.equal(Number(summary.grossProfit.toFixed(2)), -4.1);
});

test("atacado gera três faixas padronizadas sem vender abaixo do custo", () => {
  const summary = calculateWholesale({
    costTotal: 12.34,
  });

  assert.equal(summary.safeMinimumPrice, 22.22);
  assert.equal(summary.tiers.length, 3);
  assert.deepEqual(
    summary.tiers.map((tier) => tier.units),
    [10, 20, 50],
  );
  assert.ok(summary.tiers.every((tier) => tier.unitPrice >= summary.costTotal));
  assert.equal(summary.tiers[2]?.unitPrice, 22);
});
