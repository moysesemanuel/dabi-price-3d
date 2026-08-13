import assert from "node:assert/strict";
import test from "node:test";

import {
  extractMercadoPagoWebhookTopic,
  resolveMercadoPagoCheckoutAction,
  resolvePendingSubscriptionRecovery,
} from "../src/lib/payments/mercado-pago.ts";
import {
  resolveWorkspacePlanIdForSubscription,
} from "../src/lib/payments/subscription-plan-resolution.ts";

test("usa o plano salvo quando preapproval_plan_id não existe e subscription id confere", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoPlanId: null,
    mercadoPagoSubscriptionId: "subscription-123",
    savedMercadoPagoSubscriptionId: "subscription-123",
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, "growth");
});

test("não usa o plano salvo quando subscription id é diferente", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoPlanId: null,
    mercadoPagoSubscriptionId: "subscription-recebida",
    savedMercadoPagoSubscriptionId: "subscription-salva",
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, null);
});

test("não usa fallback quando não existe assinatura Mercado Pago salva", () => {
  const result = resolveWorkspacePlanIdForSubscription({
    mercadoPagoPlanId: null,
    mercadoPagoSubscriptionId: "subscription-123",
    savedMercadoPagoSubscriptionId: null,
    savedWorkspacePlanId: "growth",
  });

  assert.equal(result, null);
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
