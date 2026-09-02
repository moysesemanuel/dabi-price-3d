import assert from "node:assert/strict";
import test from "node:test";

import { MercadoPagoProvider } from "../src/lib/billing/providers/mercado-pago/mercado-pago-provider.ts";
import {
  mapMercadoPagoAuthorizedPaymentToBillingPayment,
  mapMercadoPagoPaymentToBillingManualPayment,
} from "../src/lib/billing/providers/mercado-pago/mercado-pago-mappers.ts";
import {
  buildMercadoPagoPixPaymentPayload,
  buildMercadoPagoRecurringSubscriptionPayload,
  resolveMercadoPagoSubscriptionPayerEmail,
} from "../src/lib/payments/mercado-pago.ts";

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
    async createManualPayment() {
      throw new Error("not used");
    },
    async getManualPayment() {
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
    async updateSubscriptionAmount() {
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

test("contrato de checkout usa payer de teste somente para assinatura em ambiente test", async () => {
  const expectedPayerEmail = "buyer@testuser.example";
  const provider = new MercadoPagoProvider({
    async createRecurringSubscription(input) {
      assert.equal(input.payerEmail, expectedPayerEmail);
      return {
        id: "mp-sub-test-payer",
        status: "pending",
        init_point: "https://mercadopago.app/checkout/test-payer",
      };
    },
    async createManualPayment() {
      throw new Error("not used");
    },
    async getManualPayment() {
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
    async updateSubscriptionAmount() {
      throw new Error("not used");
    },
  });

  await provider.createRecurringSubscription({
    externalReference: "billing_subscription:sub-test-payer",
    payerEmail: resolveMercadoPagoSubscriptionPayerEmail({
      customerEmail: "customer@dabi.app",
      environment: "test",
      testPayerEmail: expectedPayerEmail,
    }),
    reason: "DaBi Essencial mensal",
    returnUrl: "https://dabi.app/app/checkout",
    amountCents: 4900,
    currency: "BRL",
    billingCycle: "monthly",
  });

  assert.equal(
    resolveMercadoPagoSubscriptionPayerEmail({
      customerEmail: "customer@dabi.app",
      environment: "production",
      testPayerEmail: expectedPayerEmail,
    }),
    "customer@dabi.app",
  );
});

test("provider mapeia authorized payment para o formato de billing", async () => {
  const provider = new MercadoPagoProvider({
    async createRecurringSubscription() {
      throw new Error("not used");
    },
    async createManualPayment() {
      throw new Error("not used");
    },
    async getManualPayment() {
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
      payment_method_id: "pix",
      transaction_amount: 49,
      currency_id: "BRL",
        payment: {
          id: 987654,
          status: "approved",
        },
      };
    },
    async updateSubscriptionStatus() {
      throw new Error("not used");
    },
    async updateSubscriptionAmount() {
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
    paymentMethod: "pix_automatic",
    amountCents: 4900,
    currency: "BRL",
  });
});

test("mapper normaliza valor decimal de authorized payment em centavos sem imprecisão", () => {
  const payment = mapMercadoPagoAuthorizedPaymentToBillingPayment({
    id: 123456,
    preapproval_id: "mp-sub-1",
    status: "approved",
    transaction_amount: "49.05",
    currency_id: "brl",
  });

  assert.equal(payment.amountCents, 4905);
  assert.equal(payment.currency, "brl");
});

test("mapper preserva date_approved do payment detalhado para reconciliation", () => {
  const payment = mapMercadoPagoPaymentToBillingManualPayment({
    id: 987654,
    status: "approved",
    payment_method_id: "master",
    date_approved: "2026-08-13T09:30:00.000Z",
    transaction_amount: "49.00",
    currency_id: "BRL",
  });

  assert.equal(payment.providerPaymentId, "987654");
  assert.equal(payment.approvedAt, "2026-08-13T09:30:00.000Z");
  assert.equal(payment.amountCents, 4900);
  assert.equal(payment.currency, "BRL");
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

test("payload Pix manual converte centavos, exige pagador e calcula expiração", () => {
  const payload = buildMercadoPagoPixPaymentPayload({
    externalReference: "billing_invoice:inv-1",
    payerEmail: "owner@dabi.app",
    reason: "DaBi Start mensal via Pix",
    amountCents: 4900,
    currency: "BRL",
    expiresInMinutes: 90,
    now: new Date("2026-08-14T10:00:00.000Z"),
    notificationUrl:
      "https://dabi.app/api/payments/mercado-pago/webhook?source_news=webhooks",
  });

  assert.equal(payload.external_reference, "billing_invoice:inv-1");
  assert.equal(payload.transaction_amount, 49);
  assert.equal(payload.payment_method_id, "pix");
  assert.equal(payload.payer.email, "owner@dabi.app");
  assert.equal(payload.date_of_expiration, "2026-08-14T11:30:00.000Z");
  assert.equal(
  payload.notification_url,
  "https://dabi.app/api/payments/mercado-pago/webhook?source_news=webhooks",
);
});

test("provider cria pagamento manual Pix sem expor o payload cru do provider", async () => {
  const provider = new MercadoPagoProvider({
    async createRecurringSubscription() {
      throw new Error("not used");
    },
    async createManualPayment(input) {
      assert.deepEqual(input, {
        externalReference: "billing_invoice:inv-1",
        idempotencyKey: "inv-1",
        payerEmail: "owner@dabi.app",
        reason: "Pix manual",
        amountCents: 14900,
        currency: "BRL",
        returnUrl: "https://dabi.app/app/checkout",
        notificationUrl:
          "https://dabi.app/api/payments/mercado-pago/webhook?source_news=webhooks",
      });

      return {
        id: 987654,
        status: "pending",
        external_reference: "billing_invoice:inv-1",
        payment_method_id: "pix",
        date_of_expiration: "2026-08-14T11:00:00.000Z",
        point_of_interaction: {
          transaction_data: {
            qr_code: "0002012636pix",
            qr_code_base64: "YXNkZg==",
            ticket_url: "https://mercadopago.app/payments/987654",
          },
        },
      };
    },
    async getManualPayment() {
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
    async updateSubscriptionAmount() {
      throw new Error("not used");
    },
  });

  const payment = await provider.createManualPayment({
    externalReference: "billing_invoice:inv-1",
    idempotencyKey: "inv-1",
    payerEmail: "owner@dabi.app",
    reason: "Pix manual",
    amountCents: 14900,
    currency: "BRL",
    returnUrl: "https://dabi.app/app/checkout",
    notificationUrl: "https://dabi.app/api/payments/mercado-pago/webhook?source_news=webhooks",
  });

  assert.deepEqual(payment, {
    provider: "mercado_pago",
    providerPaymentId: "987654",
    providerAuthorizedPaymentId: null,
    status: "pending",
    providerSubscriptionId: null,
    externalReference: "billing_invoice:inv-1",
    paymentMethod: "pix_manual",
    checkoutUrl: "https://mercadopago.app/payments/987654",
    qrCode: "0002012636pix",
    qrCodeBase64: "YXNkZg==",
    expiresAt: "2026-08-14T11:00:00.000Z",
  });
});

test("provider atualiza valor da recorrência sem expor o payload cru do provider", async () => {
  const provider = new MercadoPagoProvider({
    async createRecurringSubscription() {
      throw new Error("not used");
    },
    async createManualPayment() {
      throw new Error("not used");
    },
    async getManualPayment() {
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
    async updateSubscriptionAmount(input) {
      assert.deepEqual(input, {
        subscriptionId: "mp-sub-1",
        amountCents: 9900,
        currency: "BRL",
        billingCycle: "monthly",
      });

      return {
        id: "mp-sub-1",
        status: "authorized",
        external_reference: "billing_subscription:sub-1",
        payer_email: "owner@dabi.app",
        init_point: null,
      };
    },
  });

  const subscription = await provider.updateSubscriptionAmount({
    providerSubscriptionId: "mp-sub-1",
    amountCents: 9900,
    currency: "BRL",
    billingCycle: "monthly",
  });

  assert.deepEqual(subscription, {
    provider: "mercado_pago",
    providerSubscriptionId: "mp-sub-1",
    status: "active",
    checkoutUrl: null,
    externalReference: "billing_subscription:sub-1",
    payerEmail: "owner@dabi.app",
  });
});
