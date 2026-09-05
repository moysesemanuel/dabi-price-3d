import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateConfectioneryPrice,
  hydrateConfectioneryPricingFormState,
  initialConfectioneryPricingForm,
} from "../src/lib/confectionery/calculate-confectionery-price.ts";
import { calculateSuggestedPrice } from "../src/lib/pricing/suggested-price.ts";

const round = (value) => Math.round(value * 100) / 100;

// Um lote com custo redondo, para a conta ficar conferivel a olho: so
// embalagem, sem ingredientes e sem tempo de producao. Montado direto, sem
// hydrate — hydrate repoe os ingredientes padrao quando recebe lista vazia.
function batchCosting(overrides = {}) {
  return {
    ...initialConfectioneryPricingForm,
    ingredients: [],
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

test("a margem e sobre o preco, nao sobre o custo", () => {
  const result = calculateConfectioneryPrice(batchCosting());

  // 100 / (1 - 0,30) = 142,86 — e nao 100 x 1,30 = 130
  assert.equal(round(result.suggestedUnitPrice), 142.86);
  assert.equal(round(result.effectiveMarginPercentage), 30);
});

test("a margem pedida sobrevive as taxas de venda", () => {
  const result = calculateConfectioneryPrice(
    batchCosting({ salesFeePercentage: 10 }),
  );

  // 100 / (1 - 0,10 - 0,30) = 166,67
  assert.equal(round(result.suggestedUnitPrice), 166.67);
  assert.equal(round(result.salesFeeValue), 16.67);
  // o que sobra continua sendo 30% do preco
  assert.equal(round(result.unitProfit), 50);
  assert.equal(round(result.effectiveMarginPercentage), 30);
});

test("a perda entra no custo antes da margem", () => {
  const result = calculateConfectioneryPrice(
    batchCosting({ lossPercentage: 20 }),
  );

  assert.equal(round(result.unitCost), 120);
  assert.equal(round(result.lossCost), 20);
  assert.equal(round(result.suggestedUnitPrice), 171.43);
});

test("taxa mais margem impossivel nao gera preco negativo", () => {
  const result = calculateConfectioneryPrice(
    batchCosting({ salesFeePercentage: 80, marginPercentage: 30 }),
  );

  assert.equal(result.suggestedUnitPrice, 0);
  assert.equal(result.isPricingViable, false);
});

test("confeitaria e impressao 3D chegam ao mesmo preco", () => {
  // Mesmo custo, mesma taxa, mesma margem: o numero tem que bater, porque as
  // duas calculadoras passaram a usar a mesma primitiva.
  const confectionery = calculateConfectioneryPrice(
    batchCosting({ salesFeePercentage: 12, marginPercentage: 25 }),
  );
  const shared = calculateSuggestedPrice({
    costWithLoss: 100,
    variableFeeRate: 0.12,
    marginRate: 0.25,
  });

  assert.equal(round(confectionery.suggestedUnitPrice), round(shared));
});

test("calculo salvo antes dos campos novos continua abrindo", () => {
  const legacy = hydrateConfectioneryPricingFormState({
    productName: "Brigadeiro",
    packagingCost: 100,
    unitsProduced: 1,
    marginPercentage: 30,
  });

  assert.equal(legacy.lossPercentage, 0);
  assert.equal(legacy.salesFeePercentage, 0);
  assert.ok(Number.isFinite(calculateConfectioneryPrice(legacy).suggestedUnitPrice));
});

test("a demo publica e o motor do produto usam a mesma primitiva", () => {
  const demo = readFileSync(
    new URL(
      "../src/components/public/confectionery-landing-calculator.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    demo,
    /calculateSuggestedPrice/,
    "a calculadora da landing precisa usar a primitiva compartilhada",
  );
  assert.doesNotMatch(
    demo,
    /1 - feesPct - marginPct|\* \(1 \+/,
    "a demo nao pode ter formula propria de preco",
  );
});
