import assert from "node:assert/strict";
import test from "node:test";

import { MercadoPagoProvider } from "../src/lib/billing/providers/mercado-pago/mercado-pago-provider.ts";
import { buildMercadoPagoRecurringSubscriptionPayload } from "../src/lib/payments/mercado-pago.ts";

test("provider cria assinatura recorrente sem expor conceitos do Mercado Pago", async () => {
  const provider = new MercadoPagoProvider({
    async createRecurringSubscription(input) {
      assert.deepEqual(input, {
        externalReference: "billing_subscription:sub-1",
        payerEmail: "owner@dabi.app",
        reason: "DaBi Pro mensal",
        returnUrl: "https://dabi.app/app/assinatura",
        amountCents: 14900,
        currency: "BRL",
        billingCycle: "monthly",
      });

      return {
        id: "mp-sub-1",
        status: "authorized",
        external_reference: "billing_subscription:sub-1",
        payer_email: "owner@dabi.app",
        init_point: "https://mercadopago.app/checkout/sub-1",
      };
    },
    async getSubscription() {
      throw new Error("not used");
    },
    async getPayment() {
      throw new Error("not used");
    },
    async updateSubscriptionStatus() {
      throw new Error("not used");
    },
  });

  const subscription = await provider.createRecurringSubscription({
    externalReference: "billing_subscription:sub-1",
    payerEmail: "owner@dabi.app",
    reason: "DaBi Pro mensal",
    returnUrl: "https://dabi.app/app/assinatura",
    amountCents: 14900,
    currency: "BRL",
    billingCycle: "monthly",
  });

  assert.deepEqual(subscription, {
    provider: "mercado_pago",
    providerSubscriptionId: "mp-sub-1",
    status: "active",
    checkoutUrl: "https://mercadopago.app/checkout/sub-1",
    externalReference: "billing_subscription:sub-1",
    payerEmail: "owner@dabi.app",
  });
});

test("provider mapeia authorized payment para o formato de billing", async () => {
  const provider = new MercadoPagoProvider({
    async createRecurringSubscription() {
      throw new Error("not used");
    },
    async getSubscription() {
      throw new Error("not used");
    },
    async getPayment(providerPaymentId) {
      assert.equal(providerPaymentId, "auth-pay-1");

      return {
        id: 123456,
        preapproval_id: "mp-sub-1",
        external_reference: "billing_subscription:sub-1",
        status: "authorized",
        payment: {
          id: 987654,
          status: "approved",
        },
      };
    },
    async updateSubscriptionStatus() {
      throw new Error("not used");
    },
  });

  const payment = await provider.getPayment("auth-pay-1");

  assert.deepEqual(payment, {
    provider: "mercado_pago",
    providerPaymentId: "987654",
    providerAuthorizedPaymentId: "123456",
    status: "approved",
    providerSubscriptionId: "mp-sub-1",
    externalReference: "billing_subscription:sub-1",
    paymentMethod: null,
  });
});

test("payload recorrente converte centavos para reais e preserva external reference", () => {
  const payload = buildMercadoPagoRecurringSubscriptionPayload({
    externalReference: "billing_subscription:sub-1",
    payerEmail: "owner@dabi.app",
    reason: "DaBi Start mensal",
    returnUrl: "https://dabi.app/app/assinatura",
    amountCents: 50,
    currency: "BRL",
    billingCycle: "monthly",
    now: new Date("2026-08-14T10:00:00.000Z"),
  });

  assert.equal(payload.external_reference, "billing_subscription:sub-1");
  assert.equal(payload.auto_recurring.transaction_amount, 0.5);
  assert.equal(payload.back_url, "https://dabi.app/app/assinatura");
});

test("métodos ainda fora da fase falham explicitamente", async () => {
  const provider = new MercadoPagoProvider({
    async createRecurringSubscription() {
      throw new Error("not used");
    },
    async getSubscription() {
      throw new Error("not used");
    },
    async getPayment() {
      throw new Error("not used");
    },
    async updateSubscriptionStatus() {
      throw new Error("not used");
    },
  });

  await assert.rejects(
    () =>
      provider.createManualPayment({
        externalReference: "billing_invoice:inv-1",
        payerEmail: "owner@dabi.app",
        reason: "Pix manual",
        amountCents: 14900,
        currency: "BRL",
        returnUrl: "https://dabi.app/app/assinatura",
      }),
    /createManualPayment is not implemented yet/,
  );

  await assert.rejects(
    () =>
      provider.updateSubscriptionAmount({
        providerSubscriptionId: "mp-sub-1",
        amountCents: 19900,
        currency: "BRL",
        billingCycle: "monthly",
      }),
    /updateSubscriptionAmount is not implemented yet/,
  );
});
