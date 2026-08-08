import assert from "node:assert/strict";
import test from "node:test";
import {
  appendRequestIdToMessage,
  buildApiErrorMessage,
  extractApiRequestId,
} from "../src/lib/client/api-feedback.ts";

test("extractApiRequestId prioriza payload antes do header", () => {
  const response = new Response(null, {
    headers: {
      "x-request-id": "req-header-123",
    },
  });

  assert.equal(
    extractApiRequestId(response, {
      requestId: "req-payload-456",
    }),
    "req-payload-456",
  );
});

test("appendRequestIdToMessage adiciona referencia de suporte", () => {
  assert.equal(
    appendRequestIdToMessage("Falha ao consultar.", "req-789"),
    "Falha ao consultar. Ref: req-789.",
  );
});

test("buildApiErrorMessage usa fallback quando payload nao traz erro", () => {
  const response = new Response(null, {
    headers: {
      "x-request-id": "req-999",
    },
  });

  assert.equal(
    buildApiErrorMessage({
      response,
      payload: null,
      fallback: "Falha genérica.",
    }),
    "Falha genérica. Ref: req-999.",
  );
});
