import assert from "node:assert/strict";
import { test } from "node:test";

import { workspacePlans } from "../src/lib/workspace/catalog.ts";
import { billingPlanMeta } from "../src/lib/billing/types.ts";
import { getDistributionLabel } from "../src/lib/billing/admin-dashboard-chart-data.ts";

const expectedCommercialNames = {
  starter: "DaBi Start",
  growth: "DaBi Pro",
  scale: "DaBi Max",
};

test("os nomes comerciais sao Start, Pro e Max", () => {
  for (const [planId, commercialName] of Object.entries(
    expectedCommercialNames,
  )) {
    assert.equal(
      billingPlanMeta[planId]?.commercialName,
      commercialName,
      `o nome comercial de ${planId} precisa ser ${commercialName}`,
    );
  }
});

test("o catalogo do app usa o mesmo nome que a cobranca", () => {
  // O cliente ve o nome comercial na fatura do provedor. Se o app chamar o
  // plano de outra coisa, ele nao reconhece o que esta pagando.
  for (const plan of workspacePlans) {
    assert.equal(
      plan.label,
      billingPlanMeta[plan.id].commercialName,
      `o rotulo de ${plan.id} divergiu do nome comercial da cobranca`,
    );
  }
});

test("o painel admin usa o mesmo nome, sem o prefixo da marca", () => {
  for (const plan of workspacePlans) {
    assert.equal(
      getDistributionLabel("plan", plan.id),
      billingPlanMeta[plan.id].commercialName.replace(/^DaBi /, ""),
      `o grafico admin nomeia ${plan.id} de forma diferente do resto do produto`,
    );
  }
});
