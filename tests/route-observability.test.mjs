import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
  setRouteErrorReporter,
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
        email: "nested@example.com",
      },
      authorization: "Bearer bearer-token-should-not-appear",
      payerEmail: "payer@example.com",
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
  assert.equal(loggedPayload.nested.email, "[REDACTED]");
  assert.equal(loggedPayload.authorization, "[REDACTED]");
  assert.equal(loggedPayload.payerEmail, "[REDACTED]");
  assert.equal(loggedPayload.error.message.includes("token-should-not-appear"), false);
  assert.equal(loggedPayload.error.message.includes("bearer-token-should-not-appear"), false);
});

test("erros de rota sao encaminhados ao reporter registrado com o payload ja sanitizado", () => {
  const originalConsoleError = console.error;
  const captured = [];

  console.error = () => {};
  setRouteErrorReporter((payload) => {
    captured.push(payload);
  });

  try {
    const context = createRouteRequestContext(
      new Request("http://127.0.0.1:3005/api/payments/mercado-pago/webhook"),
      "/api/payments/mercado-pago/webhook",
    );

    logRouteEvent(context, "error", "mercado_pago_webhook.processing_failed", {
      accessToken: "access-token-should-not-appear",
      payerEmail: "payer@example.com",
      error: new Error("upstream failed with token=token-should-not-appear"),
    });
  } finally {
    setRouteErrorReporter(null);
    console.error = originalConsoleError;
  }

  assert.equal(captured.length, 1);
  assert.equal(captured[0].route, "/api/payments/mercado-pago/webhook");
  assert.equal(captured[0].event, "mercado_pago_webhook.processing_failed");
  assert.equal(captured[0].accessToken, "[REDACTED]");
  assert.equal(captured[0].payerEmail, "[REDACTED]");
  assert.equal(
    captured[0].error.message.includes("token-should-not-appear"),
    false,
  );
});

test("eventos de info e warn nao sao encaminhados ao reporter", () => {
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const captured = [];

  console.info = () => {};
  console.warn = () => {};
  setRouteErrorReporter((payload) => {
    captured.push(payload);
  });

  try {
    const context = createRouteRequestContext(
      new Request("http://127.0.0.1:3005/api/test"),
      "/api/test",
    );

    logRouteEvent(context, "info", "test.started");
    logRouteEvent(context, "warn", "test.degraded");
  } finally {
    setRouteErrorReporter(null);
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
  }

  assert.equal(captured.length, 0);
});

test("sem reporter registrado o log de erro continua funcionando", () => {
  const originalConsoleError = console.error;
  let loggedPayload = null;

  console.error = (_message, payload) => {
    loggedPayload = payload;
  };

  try {
    setRouteErrorReporter(null);

    const context = createRouteRequestContext(
      new Request("http://127.0.0.1:3005/api/test"),
      "/api/test",
    );

    logRouteEvent(context, "error", "test.sem_reporter");
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(loggedPayload.event, "test.sem_reporter");
});

test("falha do reporter nao interrompe o log nem a rota", () => {
  const originalConsoleError = console.error;
  let loggedPayload = null;

  console.error = (_message, payload) => {
    loggedPayload = payload;
  };
  setRouteErrorReporter(() => {
    throw new Error("reporter indisponivel");
  });

  try {
    const context = createRouteRequestContext(
      new Request("http://127.0.0.1:3005/api/test"),
      "/api/test",
    );

    assert.doesNotThrow(() => {
      logRouteEvent(context, "error", "test.reporter_quebrado");
    });
  } finally {
    setRouteErrorReporter(null);
    console.error = originalConsoleError;
  }

  assert.equal(loggedPayload.event, "test.reporter_quebrado");
});

test("o reporter e compartilhado por referencia global entre bundles", () => {
  const captured = [];

  setRouteErrorReporter((payload) => {
    captured.push(payload);
  });

  try {
    const registry = globalThis[Symbol.for("dabi-price.route-error-reporter")];

    assert.equal(typeof registry, "function");

    registry({ event: "test.global" });
  } finally {
    setRouteErrorReporter(null);
  }

  assert.equal(captured.length, 1);
  assert.equal(captured[0].event, "test.global");
});

test("o reporter do Sentry so e registrado quando a instrumentacao inicializa", async () => {
  const source = await readFile(
    new URL("../src/lib/observability/route-error-reporter.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /setRouteErrorReporter/);
  assert.match(source, /captureMessage/);
  assert.match(source, /fingerprint/);

  for (const configFile of ["sentry.server.config.ts", "sentry.edge.config.ts"]) {
    const configSource = await readFile(
      new URL(`../${configFile}`, import.meta.url),
      "utf8",
    );

    assert.match(configSource, /registerSentryRouteErrorReporter\(\)/);
    assert.match(
      configSource,
      /if \(sentryOptions\) \{[\s\S]*registerSentryRouteErrorReporter\(\)/,
    );
  }
});
