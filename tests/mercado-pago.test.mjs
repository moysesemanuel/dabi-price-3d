import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMercadoPagoSubscriptionCheckoutPayload,
  createMercadoPagoSubscriptionCheckout,
  extractMercadoPagoWebhookTopic,
  resolveMercadoPagoCheckoutAction,
  resolvePendingSubscriptionRecovery,
} from "../src/lib/payments/mercado-pago.ts";
import {
  resolveWorkspacePlanIdForSubscription,
} from "../src/lib/payments/subscription-plan-resolution.ts";
import { getWorkspacePlan } from "../src/lib/workspace/catalog.ts";

test("webhook preserva o plano salvo quando o subscription id confere", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoSubscriptionId: "subscription-123",
    savedMercadoPagoSubscriptionId: "subscription-123",
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, "growth");
});

test("webhook não herda plano local quando o subscription id é diferente", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoSubscriptionId: "subscription-recebida",
    savedMercadoPagoSubscriptionId: "subscription-salva",
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, null);
});

test("não usa fallback quando não existe assinatura Mercado Pago salva", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoSubscriptionId: "subscription-123",
    savedMercadoPagoSubscriptionId: null,
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, null);
});

test("monta payload de checkout pendente sem plano associado", () => {
  const starterPlan = getWorkspacePlan("starter");
  const payload = buildMercadoPagoSubscriptionCheckoutPayload({
    planId: "starter",
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
