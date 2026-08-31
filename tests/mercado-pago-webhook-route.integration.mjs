import assert from "node:assert/strict";
import test from "node:test";

test("webhook com assinatura inválida não consulta recursos nem processa billing", async (t) => {
  const previous = {
    DATABASE_URL: process.env.DATABASE_URL,
    MERCADO_PAGO_ENVIRONMENT: process.env.MERCADO_PAGO_ENVIRONMENT,
    MERCADO_PAGO_TEST_ACCESS_TOKEN: process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN,
    MERCADO_PAGO_WEBHOOK_SECRET: process.env.MERCADO_PAGO_WEBHOOK_SECRET,
  };
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;

    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  process.env.DATABASE_URL = "postgres://webhook-test.invalid/database";
  process.env.MERCADO_PAGO_ENVIRONMENT = "test";
  process.env.MERCADO_PAGO_TEST_ACCESS_TOKEN = "test-token";
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = "webhook-secret";

  let resourceRequests = 0;
  globalThis.fetch = async () => {
    resourceRequests += 1;
    throw new Error("A assinatura inválida não pode consultar o provider.");
  };

  const { POST } = await import(
    "../src/app/api/payments/mercado-pago/webhook/route.ts"
  );
  const response = await POST(new Request(
    "https://hml.dabi.app/api/payments/mercado-pago/webhook?type=subscription_authorized_payment&data.id=authorized-payment-1",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "invalid-signature-request",
      },
      body: JSON.stringify({
        type: "subscription_authorized_payment",
        live_mode: true,
        data: { id: "authorized-payment-1" },
      }),
    },
  ));

  assert.equal(response.status, 401);
  assert.equal(resourceRequests, 0);
  assert.deepEqual(await response.json(), {
    error: "Assinatura do webhook do Mercado Pago inválida.",
    code: "MP_WEBHOOK_INVALID_SIGNATURE",
    requestId: "invalid-signature-request",
  });
});
