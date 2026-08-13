import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWorkspacePlanIdForSubscription,
} from "../src/lib/payments/subscription-plan-resolution.ts";

test("usa o plano salvo quando preapproval_plan_id não existe e subscription id confere", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoPlanId: null,
    mercadoPagoSubscriptionId: "subscription-123",
    savedMercadoPagoSubscriptionId: "subscription-123",
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, "growth");
});

test("não usa o plano salvo quando subscription id é diferente", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoPlanId: null,
    mercadoPagoSubscriptionId: "subscription-recebida",
    savedMercadoPagoSubscriptionId: "subscription-salva",
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, null);
});

test("não usa fallback quando não existe assinatura Mercado Pago salva", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoPlanId: null,
    mercadoPagoSubscriptionId: "subscription-123",
    savedMercadoPagoSubscriptionId: null,
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, null);
});