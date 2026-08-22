import assert from "node:assert/strict";
import test from "node:test";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "../src/lib/server/route-observability.ts";

test("createRouteRequestContext reaproveita request id do header", () => {
  const request = new Request("http://127.0.0.1:3005/api/erp-products?foo=bar", {
    method: "POST",
    headers: {
      "x-request-id": "req-123",
    },
  });

  const context = createRouteRequestContext(request, "/api/erp-products");

  assert.equal(context.route, "/api/erp-products");
  assert.equal(context.requestId, "req-123");
  assert.equal(context.method, "POST");
  assert.equal(context.pathname, "/api/erp-products");
});

test("createRouteRequestContext gera request id quando header nao existe", () => {
  const request = new Request("http://127.0.0.1:3005/api/erp-products");

  const context = createRouteRequestContext(request, "/api/erp-products");

  assert.match(context.requestId, /^[0-9a-f-]{20,}$/i);
});

test("jsonWithRequestId propaga request id no body e no header", async () => {
  const context = createRouteRequestContext(
    new Request("http://127.0.0.1:3005/api/test", {
      headers: {
        "x-request-id": "req-json-789",
      },
    }),
    "/api/test",
  );

  const response = jsonWithRequestId(
    context,
    {
      ok: true,
    },
    {
      status: 202,
      headers: {
        "cache-control": "no-store",
      },
    },
  );

  assert.equal(response.status, 202);
  assert.equal(response.headers.get("x-request-id"), "req-json-789");
  assert.equal(response.headers.get("cache-control"), "no-store");

  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.equal(payload.requestId, "req-json-789");
});

test("serializeError normaliza erros e strings", () => {
  const serializedError = serializeError(new Error("falha de teste"));
  const serializedString = serializeError("erro literal");

  assert.equal(serializedError.message, "falha de teste");
  assert.equal(serializedString.message, "erro literal");
});

test("observabilidade mascara credenciais em detalhes e mensagens de erro", () => {
  const originalConsoleError = console.error;
  let loggedPayload = null;

  console.error = (_message, payload) => {
    loggedPayload = payload;
  };

  try {
    const context = createRouteRequestContext(
      new Request("http://127.0.0.1:3005/api/test"),
      "/api/test",
    );

    logRouteEvent(context, "error", "test.credentials_rejected", {
      accessToken: "access-token-should-not-appear",
      nested: {
        password: "password-should-not-appear",
        cookie: "cookie-should-not-appear",
      },
      authorization: "Bearer bearer-token-should-not-appear",
      error: new Error(
        "upstream failed with token=token-should-not-appear and Bearer bearer-token-should-not-appear",
      ),
    });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(loggedPayload.accessToken, "[REDACTED]");
  assert.equal(loggedPayload.nested.password, "[REDACTED]");
  assert.equal(loggedPayload.nested.cookie, "[REDACTED]");
  assert.equal(loggedPayload.authorization, "[REDACTED]");
  assert.equal(loggedPayload.error.message.includes("token-should-not-appear"), false);
  assert.equal(loggedPayload.error.message.includes("bearer-token-should-not-appear"), false);
});
