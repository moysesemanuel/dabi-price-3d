import assert from "node:assert/strict";
import test from "node:test";

import { MercadoPagoProvider } from "../src/lib/billing/providers/mercado-pago/mercado-pago-provider.ts";
import {
  buildMercadoPagoPixPaymentPayload,
  buildMercadoPagoRecurringSubscriptionPayload,
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

test("payload Pix manual converte centavos, exige pagador e calcula expiração", () => {
  const payload = buildMercadoPagoPixPaymentPayload({
    externalReference: "billing_invoice:inv-1",
    payerEmail: "owner@dabi.app",
    reason: "DaBi Start mensal via Pix",
    amountCents: 4900,
    currency: "BRL",
    expiresInMinutes: 90,
    now: new Date("2026-08-14T10:00:00.000Z"),
  });

  assert.equal(payload.external_reference, "billing_invoice:inv-1");
  assert.equal(payload.transaction_amount, 49);
  assert.equal(payload.payment_method_id, "pix");
  assert.equal(payload.payer.email, "owner@dabi.app");
  assert.equal(payload.date_of_expiration, "2026-08-14T11:30:00.000Z");
});

test("provider cria pagamento manual Pix sem expor o payload cru do provider", async () => {
  const provider = new MercadoPagoProvider({
    async createRecurringSubscription() {
      throw new Error("not used");
    },
    async createManualPayment(input) {
      assert.deepEqual(input, {
        externalReference: "billing_invoice:inv-1",
        payerEmail: "owner@dabi.app",
        reason: "Pix manual",
        amountCents: 14900,
        currency: "BRL",
        returnUrl: "https://dabi.app/app/checkout",
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
    payerEmail: "owner@dabi.app",
    reason: "Pix manual",
    amountCents: 14900,
    currency: "BRL",
    returnUrl: "https://dabi.app/app/checkout",
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
