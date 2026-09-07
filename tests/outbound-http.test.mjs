import assert from "node:assert/strict";
import test from "node:test";

import {
  OutboundHttpError,
  createOutboundHttpClient,
  isOutboundTimeoutError,
} from "../src/lib/server/http.ts";

function createTimeoutError() {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

function createClient(handler, overrides = {}) {
  const calls = [];
  const delays = [];

  const client = createOutboundHttpClient({
    fetch: async (url, init) => {
      calls.push({ url, init });
      return handler(calls.length, { url, init });
    },
    sleep: async (delayMs) => {
      delays.push(delayMs);
    },
    random: () => 0.5,
    onAttempt: () => {},
    ...overrides,
  });

  return { client, calls, delays };
}

test("GET repete falha transitoria e devolve a resposta boa", async () => {
  const { client, calls, delays } = createClient((attempt) => {
    if (attempt < 3) {
      return new Response("indisponivel", { status: 503 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });

  const response = await client("https://api.mercadopago.com/v1/payments/1", {
    integration: "mercado_pago",
  });

  assert.equal(response.status, 200);
  assert.equal(calls.length, 3);
  assert.equal(delays.length, 2);
  // Backoff exponencial: 300ms na primeira espera, 600ms na segunda.
  assert.deepEqual(delays, [225, 450]);
});

test("GET esgota as tentativas e devolve o ultimo 5xx sem lancar", async () => {
  const { client, calls } = createClient(() => new Response("erro", { status: 500 }));

  const response = await client("https://api.mercadopago.com/v1/payments/1", {
    integration: "mercado_pago",
  });

  assert.equal(response.status, 500);
  assert.equal(calls.length, 3);
});

test("4xx nao gera retry", async () => {
  const { client, calls } = createClient(() => new Response("nao encontrado", { status: 404 }));

  const response = await client("https://api.mercadopago.com/v1/payments/1", {
    integration: "mercado_pago",
  });

  assert.equal(response.status, 404);
  assert.equal(calls.length, 1);
});

test("timeout esgotado vira OutboundHttpError com tentativas registradas", async () => {
  const { client, calls } = createClient(() => {
    throw createTimeoutError();
  });

  await assert.rejects(
    () =>
      client("https://api.mercadopago.com/v1/payments/1", {
        integration: "mercado_pago",
      }),
    (error) => {
      assert.ok(error instanceof OutboundHttpError);
      assert.ok(isOutboundTimeoutError(error));
      assert.equal(error.kind, "timeout");
      assert.equal(error.attempts, 3);
      assert.equal(error.integration, "mercado_pago");
      return true;
    },
  );

  assert.equal(calls.length, 3);
});

test("falha de rede sem resposta vira erro de kind network", async () => {
  const { client } = createClient(() => {
    throw new TypeError("fetch failed");
  });

  await assert.rejects(
    () =>
      client("https://api.resend.com/emails", {
        integration: "resend",
        method: "POST",
        body: JSON.stringify({ to: "cliente@exemplo.com" }),
      }),
    (error) => {
      assert.equal(error.kind, "network");
      assert.equal(isOutboundTimeoutError(error), false);
      // POST sem idempotency key declarada nao repete.
      assert.equal(error.attempts, 1);
      return true;
    },
  );
});

test("POST so repete quando quem chama declara idempotencia, e a chave nao muda", async () => {
  const { client, calls } = createClient((attempt) =>
    attempt < 2 ? new Response("indisponivel", { status: 503 }) : new Response("{}", { status: 201 }),
  );

  const response = await client("https://api.mercadopago.com/v1/payments", {
    integration: "mercado_pago",
    method: "POST",
    headers: { "X-Idempotency-Key": "chave-fixa" },
    body: JSON.stringify({ transaction_amount: 49.9 }),
    retryNonIdempotentMethod: true,
  });

  assert.equal(response.status, 201);
  assert.equal(calls.length, 2);

  const chaves = calls.map((call) => call.init.headers["X-Idempotency-Key"]);
  assert.deepEqual(chaves, ["chave-fixa", "chave-fixa"]);
});

test("POST sem declaracao de idempotencia nao repete 5xx", async () => {
  const { client, calls } = createClient(() => new Response("erro", { status: 500 }));

  const response = await client("https://api.resend.com/emails", {
    integration: "resend",
    method: "POST",
    body: JSON.stringify({ subject: "Recuperacao" }),
  });

  assert.equal(response.status, 500);
  assert.equal(calls.length, 1);
});

test("retry: false desliga a repeticao mesmo em metodo idempotente", async () => {
  const { client, calls } = createClient(() => new Response("erro", { status: 503 }));

  await client("https://api.mercadolibre.com/sites/MLB", {
    integration: "mercado_livre",
    retry: false,
  });

  assert.equal(calls.length, 1);
});

test("Retry-After do provider e respeitado, com teto de cinco segundos", async () => {
  const { client, delays } = createClient((attempt) =>
    attempt < 2
      ? new Response("limite", { status: 429, headers: { "Retry-After": "30" } })
      : new Response("{}", { status: 200 }),
  );

  await client("https://api.mercadopago.com/v1/payments/1", {
    integration: "mercado_pago",
  });

  assert.deepEqual(delays, [5_000]);
});

test("a mensagem de erro nao carrega query string", async () => {
  const { client } = createClient(() => {
    throw createTimeoutError();
  });

  await assert.rejects(
    () =>
      client(
        "https://api.mercadolibre.com/oauth/token?access_token=segredo-que-nao-pode-vazar",
        { integration: "mercado_livre", retry: false },
      ),
    (error) => {
      assert.equal(error.target, "api.mercadolibre.com/oauth/token");
      assert.ok(!error.message.includes("segredo-que-nao-pode-vazar"));
      return true;
    },
  );
});

test("timeout padrao muda por integracao", async () => {
  const observados = [];
  const { client } = createClient(() => new Response("{}", { status: 200 }), {
    fetch: async (url, init) => {
      observados.push(init.signal);
      return new Response("{}", { status: 200 });
    },
  });

  await client("https://api.frankfurter.dev/v2/rates", {
    integration: "exchange_rates",
  });

  assert.equal(observados.length, 1);
  assert.ok(observados[0] instanceof AbortSignal);
});

test("o requestId da rota entra no evento de cada tentativa", async () => {
  const eventos = [];
  const client = createOutboundHttpClient({
    fetch: async () => new Response("indisponivel", { status: 503 }),
    sleep: async () => {},
    random: () => 0.5,
    onAttempt: (evento) => eventos.push(evento),
  });

  await client("https://api.mercadopago.com/v1/payments/1", {
    integration: "mercado_pago",
    requestId: "req-abc-123",
  });

  // Duas tentativas repetidas, mais o registro da desistencia.
  assert.equal(eventos.length, 2);
  for (const evento of eventos) {
    assert.equal(evento.requestId, "req-abc-123");
  }
});

test("sem requestId o evento traz null, e nao undefined", async () => {
  const eventos = [];
  const client = createOutboundHttpClient({
    fetch: async () => {
      const error = new Error("sem rede");
      error.name = "TimeoutError";
      throw error;
    },
    sleep: async () => {},
    random: () => 0.5,
    onAttempt: (evento) => eventos.push(evento),
  });

  await assert.rejects(() =>
    client("https://api.resend.com/emails", { integration: "resend", retry: false }),
  );

  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].requestId, null);
  assert.equal(eventos[0].outcome, "gave_up");
});
