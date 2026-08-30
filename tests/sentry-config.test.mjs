import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  createSentryOptions,
  isSentryEnabled,
  isSentrySourceMapUploadEnabled,
  resolveSentryEnvironment,
  sanitizeSentryEvent,
} from "../src/lib/observability/sentry-config.ts";

test("resolveSentryEnvironment separa producao, preview e desenvolvimento", () => {
  assert.equal(
    resolveSentryEnvironment({ vercelEnv: "production" }),
    "production",
  );
  assert.equal(resolveSentryEnvironment({ vercelEnv: "preview" }), "preview");
  assert.equal(
    resolveSentryEnvironment({ vercelEnv: undefined }),
    "development",
  );
});

test("resolveSentryEnvironment respeita o ambiente explicito da HML", () => {
  assert.equal(
    resolveSentryEnvironment({
      vercelEnv: "production",
      sentryEnvironment: "hml",
    }),
    "hml",
  );
});

test("isSentryEnabled exige DSN e nunca envia desenvolvimento local", () => {
  assert.equal(
    isSentryEnabled({
      dsn: "https://public@example.ingest.sentry.io/1",
      environment: "production",
    }),
    true,
  );
  assert.equal(
    isSentryEnabled({ dsn: "", environment: "production" }),
    false,
  );
  assert.equal(
    isSentryEnabled({
      dsn: "https://public@example.ingest.sentry.io/1",
      environment: "development",
    }),
    false,
  );
});

test("createSentryOptions nao cria configuracao sem telemetria habilitada", () => {
  assert.equal(
    createSentryOptions({ dsn: "", vercelEnv: "production" }),
    null,
  );
  assert.deepEqual(
    createSentryOptions({
      dsn: "https://public@example.ingest.sentry.io/1",
      vercelEnv: "preview",
      release: "abc123",
    }),
    {
      dsn: "https://public@example.ingest.sentry.io/1",
      environment: "preview",
      release: "abc123",
      sendDefaultPii: false,
    },
  );
});

test("sanitizeSentryEvent remove request e usuario antes do envio", () => {
  const event = sanitizeSentryEvent({
    request: {
      data: { cardToken: "payment-token" },
      headers: { authorization: "Bearer token", cookie: "session=value" },
      url: "https://dabi.app/api/billing?token=payment-token",
    },
    user: { email: "cliente@example.com", id: "user-123" },
    contexts: { nextjs: { route_type: "route" } },
    extra: { requestId: "req-123" },
  });

  assert.deepEqual(event, {
    contexts: { nextjs: { route_type: "route" } },
    extra: { requestId: "req-123" },
  });
});

test("sanitizeSentryEvent mascara segredos presentes em excecoes e contexto", () => {
  const event = sanitizeSentryEvent({
    exception: {
      values: [
        {
          stacktrace: {
            frames: [
              {
                vars: {
                  authorization: "Bearer bearer-token-should-not-appear",
                },
              },
            ],
          },
          value: "upstream failed with token=token-should-not-appear",
        },
      ],
    },
    extra: {
      providerError: "Bearer bearer-token-should-not-appear",
    },
  });

  assert.equal(
    event.exception.values[0].value.includes("token-should-not-appear"),
    false,
  );
  assert.equal(
    event.exception.values[0].stacktrace.frames[0].vars.authorization,
    "[REDACTED]",
  );
  assert.equal(
    event.extra.providerError.includes("bearer-token-should-not-appear"),
    false,
  );
});

test("source maps so usam credenciais em build da Vercel", () => {
  const credentials = {
    authToken: "build-token",
    org: "dabi-tech",
    project: "dabi-price",
  };

  assert.equal(
    isSentrySourceMapUploadEnabled({ ...credentials, isVercel: false }),
    false,
  );
  assert.equal(
    isSentrySourceMapUploadEnabled({ ...credentials, isVercel: true }),
    true,
  );
  assert.equal(
    isSentrySourceMapUploadEnabled({
      isVercel: true,
      org: "dabi-tech",
      project: "dabi-price",
    }),
    false,
  );
});

test("o limite global da App Router reporta a excecao sem expor detalhes", async () => {
  const source = await readFile(
    new URL("../src/app/global-error.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /"use client"/);
  assert.match(source, /Sentry\.captureException\(error\)/);
  assert.doesNotMatch(source, /error\.stack/);
  assert.doesNotMatch(source, /error\.message/);
});

test("a instrumentacao do cliente encaminha transicoes de rota ao Sentry", async () => {
  const source = await readFile(
    new URL("../instrumentation-client.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /onRouterTransitionStart\s*=\s*Sentry\.captureRouterTransitionStart/,
  );
});

test("o build envia source maps de codigo interno do Next.js", async () => {
  const source = await readFile(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /widenClientFileUpload:\s*true/);
});
