import assert from "node:assert/strict";
import test from "node:test";

import {
  getBillingPlanCommercialName,
  listBillingBootstrapPrices,
  resolveBillingCatalogPrice,
  resolveBillingPriceAmountCents,
} from "../src/lib/billing/catalog.ts";
import { getWorkspacePlan } from "../src/lib/workspace/catalog.ts";

test("converte o valor mensal do catálogo para centavos", () => {
  const starterPlan = getWorkspacePlan("starter");
  const growthPlan = getWorkspacePlan("growth");

  assert.equal(
    resolveBillingPriceAmountCents({
      planId: "starter",
      billingCycle: "monthly",
    }),
    Math.round((starterPlan.monthlyPrice ?? 0) * 100),
  );

  assert.equal(
    resolveBillingPriceAmountCents({
      planId: "growth",
      billingCycle: "monthly",
    }),
    Math.round((growthPlan.monthlyPrice ?? 0) * 100),
  );
});

test("não resolve preço para annual nem para plano consultivo sem valor", () => {
  assert.equal(
    resolveBillingPriceAmountCents({
      planId: "starter",
      billingCycle: "annual",
    }),
    null,
  );

  assert.equal(
    resolveBillingPriceAmountCents({
      planId: "scale",
      billingCycle: "monthly",
    }),
    null,
  );
});

test("resolve preço de catálogo com metadados persistíveis", () => {
  const price = resolveBillingCatalogPrice({
    planId: "growth",
    billingCycle: "monthly",
    activeFrom: "2026-08-14T12:00:00.000Z",
  });

  assert.deepEqual(price, {
    planId: "growth",
    billingCycle: "monthly",
    amountCents: Math.round((getWorkspacePlan("growth").monthlyPrice ?? 0) * 100),
    currency: "BRL",
    activeFrom: "2026-08-14T12:00:00.000Z",
    activeUntil: null,
  });
});

test("lista bootstrap apenas para preços realmente suportados", () => {
  const prices = listBillingBootstrapPrices({
    activeFrom: "2026-08-14T12:00:00.000Z",
  });

  assert.deepEqual(
    prices.map((price) => `${price.planId}:${price.billingCycle}`),
    ["starter:monthly", "growth:monthly"],
  );
});

test("expõe os nomes comerciais novos sem mudar os ids internos", () => {
  assert.equal(getBillingPlanCommercialName("starter"), "DaBi Start");
  assert.equal(getBillingPlanCommercialName("growth"), "DaBi Pro");
  assert.equal(getBillingPlanCommercialName("scale"), "DaBi Max");
});
