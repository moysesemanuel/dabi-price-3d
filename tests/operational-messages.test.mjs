import assert from "node:assert/strict";
import test from "node:test";
import {
  mapErpUpstreamFailure,
  mapMercadoLivreOperationalError,
} from "../src/lib/server/operational-messages.ts";

test("erp 401 vira mensagem acionavel de token invalido", () => {
  const mapped = mapErpUpstreamFailure({
    status: 401,
    upstreamMessage: "unauthorized",
  });

  assert.equal(mapped.code, "ERP_AUTH_REJECTED");
  assert.match(mapped.message, /PRICING_INTEGRATION_TOKEN/);
  assert.equal(mapped.severity, "error");
});

test("erp 422 preserva mensagem util de validacao", () => {
  const mapped = mapErpUpstreamFailure({
    status: 422,
    upstreamMessage: "SKU duplicado no ERP.",
  });

  assert.equal(mapped.code, "ERP_REJECTED_PAYLOAD");
  assert.equal(mapped.message, "SKU duplicado no ERP.");
  assert.equal(mapped.severity, "warn");
});

test("mercado livre sem conexao devolve mensagem operacional clara", () => {
  const mapped = mapMercadoLivreOperationalError(
    new Error("Mercado Livre não conectado. Autorize a conta em /preferencias."),
  );

  assert.equal(mapped.code, "MELI_NOT_CONNECTED");
  assert.equal(mapped.officialLookupReady, false);
  assert.match(mapped.message, /Autorize a conta/);
});

test("mercado livre com falha de listing_prices cai em fallback local claro", () => {
  const mapped = mapMercadoLivreOperationalError(
    new Error("Mercado Livre listing_prices returned 400."),
  );

  assert.equal(mapped.code, "MELI_LISTING_PRICES_FAILED");
  assert.equal(mapped.officialLookupReady, true);
  assert.match(mapped.message, /prévia local/i);
});
