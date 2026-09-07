import assert from "node:assert/strict";
import test from "node:test";

import {
  ERP_MERCADO_LIVRE_REQUEST_TIMEOUT_MS,
  ERP_REQUEST_TIMEOUT_MS,
  resolveErpRequestPolicy,
} from "../src/lib/erp-products/request-policy.ts";

test("salvar sem publicar usa o timeout curto", () => {
  const policy = resolveErpRequestPolicy({ sku: "PECA-001" });

  assert.equal(policy.timeoutMs, ERP_REQUEST_TIMEOUT_MS);
  assert.equal(ERP_REQUEST_TIMEOUT_MS, 8_000);
});

test("publicar no Mercado Livre estende o timeout", () => {
  const policy = resolveErpRequestPolicy({
    sku: "PECA-001",
    publishToMercadoLivre: true,
  });

  assert.equal(policy.timeoutMs, ERP_MERCADO_LIVRE_REQUEST_TIMEOUT_MS);
  assert.equal(ERP_MERCADO_LIVRE_REQUEST_TIMEOUT_MS, 20_000);
});

test("com SKU o retry e liberado, porque o ERP faz upsert por SKU", () => {
  const policy = resolveErpRequestPolicy({ sku: "PECA-001" });

  assert.equal(policy.canRetry, true);
  assert.equal(policy.maxAttempts, 2);
});

test("sem SKU nao repete: o ERP geraria um segundo cadastro", () => {
  for (const sku of [null, undefined, "", "   "]) {
    const policy = resolveErpRequestPolicy({ sku });

    assert.equal(policy.canRetry, false, `sku ${JSON.stringify(sku)}`);
    assert.equal(policy.maxAttempts, 1);
  }
});

test("publicacao no Mercado Livre nunca repete, mesmo com SKU", () => {
  const policy = resolveErpRequestPolicy({
    sku: "PECA-001",
    publishToMercadoLivre: true,
  });

  assert.equal(policy.canRetry, false);
  assert.equal(policy.maxAttempts, 1);
});

test("publishToMercadoLivre so conta quando e exatamente true", () => {
  const policy = resolveErpRequestPolicy({
    sku: "PECA-001",
    publishToMercadoLivre: undefined,
  });

  assert.equal(policy.timeoutMs, ERP_REQUEST_TIMEOUT_MS);
  assert.equal(policy.canRetry, true);
});
