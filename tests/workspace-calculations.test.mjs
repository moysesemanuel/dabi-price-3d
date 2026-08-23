import assert from "node:assert/strict";
import test from "node:test";
import {
  is3DCalculation,
  isConfectioneryCalculation,
  normalizeSavedCalculation,
} from "../src/lib/history/workspace-calculations.ts";

test("normaliza cálculo 3D e descarta campos externos ao contrato persistido", () => {
  const calculation = normalizeSavedCalculation({
    id: " calc-3d ",
    kind: "3d",
    savedAt: "2026-08-23T10:00:00.000Z",
    productName: " Peça de teste ",
    salesChannelId: "mercado-livre",
    salesChannelLabel: " Mercado Livre ",
    displayCurrency: "USD",
    summary: {
      salePrice: "invalid",
      totalCost: 12.5,
      profit: 7.5,
      marginPercentage: 37.5,
      profitPerHour: 15,
    },
    formSnapshot: {},
    workspaceId: "workspace-de-outro-tenant",
    userId: "user-de-outro-tenant",
  });

  assert.ok(is3DCalculation(calculation));
  assert.equal(calculation.id, "calc-3d");
  assert.equal(calculation.productName, "Peça de teste");
  assert.equal(calculation.salesChannelLabel, "Mercado Livre");
  assert.equal(calculation.displayCurrency, "USD");
  assert.equal(calculation.summary.salePrice, 0);
  assert.equal("workspaceId" in calculation, false);
  assert.equal("userId" in calculation, false);
});

test("normaliza cálculo de confeitaria com snapshot próprio", () => {
  const calculation = normalizeSavedCalculation({
    id: "cake-1",
    kind: "confectionery",
    savedAt: "2026-08-23T10:00:00.000Z",
    productName: "Bolo",
    salesChannelId: "",
    summary: {},
    confectionerySnapshot: {},
  });

  assert.ok(isConfectioneryCalculation(calculation));
  assert.equal(calculation.salesChannelLabel, "Venda direta");
  assert.equal(calculation.displayCurrency, "BRL");
  assert.ok(calculation.confectionerySnapshot);
});

test("rejeita cálculo persistido sem identificador", () => {
  assert.equal(
    normalizeSavedCalculation({
      kind: "3d",
      productName: "Sem identificador",
      formSnapshot: {},
    }),
    null,
  );
});
