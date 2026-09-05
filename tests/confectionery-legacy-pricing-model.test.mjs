import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateConfectioneryPrice,
  hydrateConfectioneryPricingFormState,
  initialConfectioneryPricingForm,
  convertToCurrentPricingModel,
} from "../src/lib/confectionery/calculate-confectionery-price.ts";
import { normalizeSavedCalculation } from "../src/lib/history/workspace-calculations.ts";

const round = (value) => Math.round(value * 100) / 100;

// Um ingrediente de custo zero, porque hydrate repoe os ingredientes padrao
// quando recebe lista vazia — o custo do lote fica sendo so a embalagem.
const FREE_INGREDIENT = {
  id: "ingredient-1",
  name: "Sem custo",
  purchaseQuantity: 1000,
  purchaseUnit: "g",
  purchaseCost: 0,
  usageQuantity: 0,
};

function batch(overrides = {}) {
  return {
    ...initialConfectioneryPricingForm,
    ingredients: [FREE_INGREDIENT],
    packagingCost: 100,
    productionTimeMinutes: 0,
    fixedMonthlyCosts: 0,
    desiredMonthlySalary: 0,
    unitsProduced: 1,
    marginPercentage: 30,
    lossPercentage: 0,
    salesFeePercentage: 0,
    ...overrides,
  };
}

function savedRecord(snapshot) {
  return {
    id: "calc-1",
    kind: "confectionery",
    savedAt: "2026-08-01T12:00:00.000Z",
    productName: "Brigadeiro",
    salesChannelId: "confectionery-direct",
    salesChannelLabel: "Venda direta",
    displayCurrency: "BRL",
    summary: {
      salePrice: 130,
      totalCost: 100,
      profit: 30,
      marginPercentage: 30,
      profitPerHour: 30,
    },
    confectionerySnapshot: snapshot,
  };
}

test("calculo salvo antes da mudanca reabre com o preco que tinha", () => {
  // Sem pricingModel no snapshot = registro antigo. Tem que reproduzir
  // custo x (1 + margem), e nao a formula nova.
  const saved = normalizeSavedCalculation(
    savedRecord({
      packagingCost: 100,
      unitsProduced: 1,
      marginPercentage: 30,
      productionTimeMinutes: 0,
      fixedMonthlyCosts: 0,
      desiredMonthlySalary: 0,
      ingredients: [FREE_INGREDIENT],
    }),
  );

  assert.equal(saved.confectionerySnapshot.pricingModel, "markup_on_cost");

  const result = calculateConfectioneryPrice(saved.confectionerySnapshot);
  assert.equal(round(result.suggestedUnitPrice), 130);
});

test("o registro guardado nao e reescrito ao ser lido", () => {
  const saved = normalizeSavedCalculation(
    savedRecord({ packagingCost: 100, ingredients: [FREE_INGREDIENT] }),
  );

  assert.equal(saved.summary.salePrice, 130);
  assert.equal(saved.summary.profit, 30);
});

test("calculo novo usa o modelo atual", () => {
  const result = calculateConfectioneryPrice(batch());

  assert.equal(batch().pricingModel, "margin_on_price");
  assert.equal(round(result.suggestedUnitPrice), 142.86);
});

test("dá para converter um calculo antigo para o modelo atual", () => {
  const legacy = hydrateConfectioneryPricingFormState({
    ...batch(),
    pricingModel: "markup_on_cost",
  });
  assert.equal(round(calculateConfectioneryPrice(legacy).suggestedUnitPrice), 130);

  const converted = convertToCurrentPricingModel(legacy);
  assert.equal(converted.pricingModel, "margin_on_price");
  assert.equal(
    round(calculateConfectioneryPrice(converted).suggestedUnitPrice),
    142.86,
  );
});

test("o modelo antigo continua sem taxas e sem perdas", () => {
  // Se um registro antigo for reaberto e a pessoa informar taxa, o numero
  // muda — mas ate ela mexer, o preco tem que ser o mesmo de antes.
  const legacy = hydrateConfectioneryPricingFormState({
    ...batch(),
    pricingModel: "markup_on_cost",
    salesFeePercentage: 0,
    lossPercentage: 0,
  });

  assert.equal(round(calculateConfectioneryPrice(legacy).suggestedUnitPrice), 130);
});
