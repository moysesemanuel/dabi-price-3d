import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMercadoPagoSubscriptionCheckoutPayload,
  createMercadoPagoSubscriptionCheckout,
  createMercadoPagoPixPayment,
  extractMercadoPagoWebhookTopic,
  resolveMercadoPagoCheckoutAction,
  resolvePendingSubscriptionRecovery,
  canIgnorePendingSubscriptionCancellationError,
  MercadoPagoApiError,
} from "../src/lib/payments/mercado-pago.ts";
import { getWorkspacePlan } from "../src/lib/workspace/catalog.ts";

test("monta payload de checkout pendente sem plano associado", () => {
  const starterPlan = getWorkspacePlan("starter");
  const payload = buildMercadoPagoSubscriptionCheckoutPayload({
    planId: "starter",
    billingCycle: "monthly",
    payerEmail: "owner@dabi.com",
    workspaceId: "workspace-123",
    reason: "DaBi Essencial - Workspace Teste",
    backUrl: "https://dabi.app/app/planos?plan=starter",
    now: new Date("2026-08-13T12:00:00.000Z"),
  });

  assert.equal(payload.external_reference, "workspace:workspace-123");
  assert.equal(payload.payer_email, "owner@dabi.com");
  assert.equal(payload.reason, "DaBi Essencial - Workspace Teste");
  assert.equal(payload.back_url, "https://dabi.app/app/planos?plan=starter");
  assert.equal(payload.status, "pending");
  assert.equal(payload.auto_recurring.frequency, 1);
  assert.equal(payload.auto_recurring.frequency_type, "months");
  assert.equal(payload.auto_recurring.currency_id, "BRL");
  assert.equal(payload.auto_recurring.transaction_amount, starterPlan.monthlyPrice);
  assert.ok(typeof payload.auto_recurring.end_date === "string");
  assert.equal("preapproval_plan_id" in payload, false);
  assert.equal("card_token_id" in payload, false);
});

test("monta payload anual com valor consolidado e frequência de 12 meses", () => {
  const growthPlan = getWorkspacePlan("growth");
  const payload = buildMercadoPagoSubscriptionCheckoutPayload({
    planId: "growth",
    billingCycle: "annual",
    payerEmail: "owner@dabi.com",
    workspaceId: "workspace-123",
    reason: "DaBi Pro anual - Workspace Teste",
    backUrl: "https://dabi.app/app/planos?plan=growth&billingCycle=annual",
    now: new Date("2026-08-13T12:00:00.000Z"),
  });

  assert.equal(payload.auto_recurring.frequency, 12);
  assert.equal(payload.auto_recurring.frequency_type, "months");
  assert.equal(payload.auto_recurring.transaction_amount, growthPlan.annualPrice);
});

test("cria preapproval pendente sem preapproval_plan_id e retorna init_point", async (t) => {
  const growthPlan = getWorkspacePlan("growth");
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestUrl = "";
  let requestInit = null;

  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    requestInit = init ?? null;

    return new Response(
      JSON.stringify({
        id: "sub-123",
        init_point: "https://www.mercadopago.com/checkout/v1/redirect?preapproval_id=sub-123",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  const subscription = await createMercadoPagoSubscriptionCheckout({
    planId: "growth",
    billingCycle: "monthly",
    payerEmail: "owner@dabi.com",
    workspaceId: "workspace-123",
    reason: "DaBi Pro - Workspace Teste",
    backUrl: "https://dabi.app/app/planos?plan=growth",
    accessTokenOverride: "token-de-teste",
  });

  const body = JSON.parse(requestInit?.body ?? "{}");

  assert.equal(requestUrl, "https://api.mercadopago.com/preapproval");
  assert.equal(requestInit?.method, "POST");
  assert.equal(body.external_reference, "workspace:workspace-123");
  assert.equal(body.status, "pending");
  assert.equal(body.auto_recurring.frequency, 1);
  assert.equal(body.auto_recurring.frequency_type, "months");
  assert.equal(body.auto_recurring.currency_id, "BRL");
  assert.equal(body.auto_recurring.transaction_amount, growthPlan.monthlyPrice);
  assert.equal("preapproval_plan_id" in body, false);
  assert.equal("card_token_id" in body, false);
  assert.equal(
    subscription.init_point,
    "https://www.mercadopago.com/checkout/v1/redirect?preapproval_id=sub-123",
  );
});

test("cria preapproval anual usando frequência de 12 meses", async (t) => {
  const growthPlan = getWorkspacePlan("growth");
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestInit = null;

  globalThis.fetch = async (_url, init) => {
    requestInit = init ?? null;

    return new Response(
      JSON.stringify({
        id: "sub-annual-123",
        init_point:
          "https://www.mercadopago.com/checkout/v1/redirect?preapproval_id=sub-annual-123",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  await createMercadoPagoSubscriptionCheckout({
    planId: "growth",
    billingCycle: "annual",
    payerEmail: "owner@dabi.com",
    workspaceId: "workspace-123",
    reason: "DaBi Pro anual - Workspace Teste",
    backUrl: "https://dabi.app/app/planos?plan=growth&billingCycle=annual",
    accessTokenOverride: "token-de-teste",
  });

  const body = JSON.parse(requestInit?.body ?? "{}");

  assert.equal(body.auto_recurring.frequency, 12);
  assert.equal(body.auto_recurring.frequency_type, "months");
  assert.equal(body.auto_recurring.transaction_amount, growthPlan.annualPrice);
});

test("Pix manual envia idempotency key estável ao Mercado Pago", async (t) => {
  const originalFetch = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const receivedKeys = [];

  globalThis.fetch = async (_url, init) => {
    receivedKeys.push(init?.headers?.["X-Idempotency-Key"]);

    return new Response(
      JSON.stringify({
        id: 987654,
        status: "pending",
        external_reference: "billing_invoice:inv-1",
        payment_method_id: "pix",
        point_of_interaction: {
          transaction_data: {
            qr_code: "0002012636pix",
            qr_code_base64: "YXNkZg==",
          },
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };

  const input = {
    externalReference: "billing_invoice:inv-1",
    idempotencyKey: "inv-1",
    payerEmail: "owner@dabi.app",
    reason: "Pix manual",
    amountCents: 4900,
    currency: "BRL",
    accessTokenOverride: "token-de-teste",
  };

  await createMercadoPagoPixPayment(input);
  await createMercadoPagoPixPayment(input);

  assert.deepEqual(receivedKeys, ["inv-1", "inv-1"]);
});

test("não ignora outro erro 400 ao cancelar preapproval pending", () => {
  const error = new MercadoPagoApiError({
    status: 400,
    path: "/preapproval/sub-123",
    responseText: "Bad request",
    mode: "mutation",
  });

  assert.equal(
    canIgnorePendingSubscriptionCancellationError("pending", error),
    false,
  );
});

test("prioriza o tipo do payload quando query string e payload divergem", () => {
  const topic = extractMercadoPagoWebhookTopic({
    requestUrl: new URL(
      "https://dabi-price-3d.vercel.app/api/payments/mercado-pago/webhook?type=subscription_authorized_payment",
    ),
    payload: {
      type: "subscription_preapproval",
      data: {
        id: "123456",
      },
    },
  });

  assert.equal(topic, "subscription_preapproval");
});

test("pending com assinatura existente tenta recuperar o checkout atual", () => {
  assert.equal(
    resolveMercadoPagoCheckoutAction({
      subscriptionStatus: "pending",
      mercadoPagoSubscriptionId: "sub-123",
    }),
    "resume_pending_checkout",
  );
});

test("pending com init_point reutiliza o checkout existente", () => {
  assert.deepEqual(
    resolvePendingSubscriptionRecovery({
      remoteStatus: "pending",
      initPoint:
        "https://www.mercadopago.com/checkout/v1/redirect?preapproval_id=123",
    }),
    {
      type: "resume_checkout",
      initPoint:
        "https://www.mercadopago.com/checkout/v1/redirect?preapproval_id=123",
      remoteStatus: "pending",
    },
  );
});

test("pending sem init_point devolve erro controlado", () => {
  assert.deepEqual(
    resolvePendingSubscriptionRecovery({
      remoteStatus: "pending",
      initPoint: null,
    }),
    {
      type: "missing_init_point",
      remoteStatus: "pending",
    },
  );
});

test("pending com assinatura inexistente libera nova tentativa e limpa referencia", () => {
  assert.deepEqual(
    resolvePendingSubscriptionRecovery({
      remoteStatus: "unknown",
      remoteFound: false,
    }),
    {
      type: "allow_new_checkout",
      nextStatus: "unpaid",
      clearSubscriptionId: true,
      remoteStatus: "not_found",
    },
  );
});

test("unpaid continua criando novo checkout", () => {
  assert.equal(
    resolveMercadoPagoCheckoutAction({
      subscriptionStatus: "unpaid",
      mercadoPagoSubscriptionId: null,
    }),
    "create_new_checkout",
  );
});

test("active continua bloqueando nova contratação", () => {
  assert.equal(
    resolveMercadoPagoCheckoutAction({
      subscriptionStatus: "active",
      mercadoPagoSubscriptionId: "sub-123",
    }),
    "block_active_subscription",
  );
});

test("canceled continua permitindo nova contratação", () => {
  assert.equal(
    resolveMercadoPagoCheckoutAction({
      subscriptionStatus: "canceled",
      mercadoPagoSubscriptionId: "sub-123",
    }),
    "create_new_checkout",
  );
});

test("ignora erro 400 ao cancelar preapproval pending", () => {
  const error = new MercadoPagoApiError({
    status: 400,
    path: "/preapproval/sub-123",
    responseText: "Invalid preapproval status param: canceled",
    mode: "mutation",
  });

  assert.equal(
    canIgnorePendingSubscriptionCancellationError("pending", error),
    true,
  );
});

test("ignora erro 404 ao cancelar preapproval pending", () => {
  const error = new MercadoPagoApiError({
    status: 404,
    path: "/preapproval/sub-123",
    responseText: "Not found",
    mode: "mutation",
  });

  assert.equal(
    canIgnorePendingSubscriptionCancellationError("pending", error),
    true,
  );
});

test("não ignora erro inesperado ao cancelar preapproval pending", () => {
  const error = new MercadoPagoApiError({
    status: 500,
    path: "/preapproval/sub-123",
    responseText: "Internal error",
    mode: "mutation",
  });

  assert.equal(
    canIgnorePendingSubscriptionCancellationError("pending", error),
    false,
  );
});