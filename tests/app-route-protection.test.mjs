import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppRouteProtection } from "../src/lib/auth/app-route-protection.ts";

test("protege /app sem sessao e preserva a rota de retorno", () => {
  const result = resolveAppRouteProtection({
    hasSession: false,
    requestUrl: "http://127.0.0.1:3005/app/precificacao?canal=mercado-livre",
    pathname: "/app/precificacao",
    search: "?canal=mercado-livre",
  });

  assert.equal(result.type, "redirect");
  assert.equal(
    result.redirectUrl,
    "http://127.0.0.1:3005/login?next=%2Fapp%2Fprecificacao%3Fcanal%3Dmercado-livre",
  );
});

test("libera /app quando a sessao existe", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    requestUrl: "http://127.0.0.1:3005/app/precificacao",
    pathname: "/app/precificacao",
    search: "",
  });

  assert.equal(result.type, "allow");
  assert.equal(result.redirectUrl, null);
});

test("redireciona workspace unpaid para onboarding quando ainda nao concluiu a configuracao", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    hasPaidWorkspaceAccess: false,
    onboardingCompleted: false,
    subscriptionStatus: "unpaid",
    requestUrl: "http://127.0.0.1:3005/app/precificacao",
    pathname: "/app/precificacao",
    search: "",
  });

  assert.equal(result.type, "redirect");
  assert.equal(result.redirectUrl, "http://127.0.0.1:3005/app/onboarding");
});

test("redireciona workspace unpaid para planos apos onboarding", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    hasPaidWorkspaceAccess: false,
    onboardingCompleted: true,
    subscriptionStatus: "unpaid",
    requestUrl: "http://127.0.0.1:3005/app/precificacao",
    pathname: "/app/precificacao",
    search: "",
  });

  assert.equal(result.type, "redirect");
  assert.equal(result.redirectUrl, "http://127.0.0.1:3005/app/planos");
});

test("redireciona workspace pending para checkout", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    hasPaidWorkspaceAccess: false,
    onboardingCompleted: true,
    subscriptionStatus: "pending",
    requestUrl: "http://127.0.0.1:3005/app/precificacao",
    pathname: "/app/precificacao",
    search: "",
  });

  assert.equal(result.type, "redirect");
  assert.equal(result.redirectUrl, "http://127.0.0.1:3005/app/checkout");
});

test("permite rotas de billing para workspace sem acesso pago", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    hasPaidWorkspaceAccess: false,
    onboardingCompleted: true,
    subscriptionStatus: "pending",
    isApiRequest: true,
    requestUrl: "http://127.0.0.1:3005/api/payments/mercado-pago/subscriptions/checkout",
    pathname: "/api/payments/mercado-pago/subscriptions/checkout",
    search: "",
  });

  assert.equal(result.type, "allow");
});

test("permite checkout Pix manual para workspace sem acesso pago", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    hasPaidWorkspaceAccess: false,
    onboardingCompleted: true,
    subscriptionStatus: "pending",
    isApiRequest: true,
    requestUrl: "http://127.0.0.1:3005/api/billing/checkout/pix",
    pathname: "/api/billing/checkout/pix",
    search: "",
  });

  assert.equal(result.type, "allow");
});

test("mantem acesso quando o entitlement está em scheduled_cancel", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    entitlements: {
      canUseApp: true,
      canUsePricing: true,
      canExportPdf: true,
      canViewHistory: true,
      canManageIntegrations: true,
      historyLimit: 200,
      seatsLimit: 3,
      canManageBilling: true,
      accessReason: "scheduled_cancel",
    },
    onboardingCompleted: true,
    subscriptionStatus: "active",
    requestUrl: "http://127.0.0.1:3005/app/precificacao",
    pathname: "/app/precificacao",
    search: "",
  });

  assert.equal(result.type, "allow");
});

test("bloqueia APIs de produto para workspace sem acesso pago", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    hasPaidWorkspaceAccess: false,
    onboardingCompleted: true,
    subscriptionStatus: "paused",
    isApiRequest: true,
    requestUrl: "http://127.0.0.1:3005/api/workspace/calculations",
    pathname: "/api/workspace/calculations",
    search: "",
  });

  assert.equal(result.type, "deny");
  assert.equal(result.status, 403);
  assert.equal(result.responseBody.code, "SUBSCRIPTION_REQUIRED");
  assert.equal(result.responseBody.redirectTo, "/app/assinatura");
});

test("bloqueia APIs de produto para workspace pending apontando para checkout", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    hasPaidWorkspaceAccess: false,
    onboardingCompleted: true,
    subscriptionStatus: "pending",
    isApiRequest: true,
    requestUrl: "http://127.0.0.1:3005/api/workspace/calculations",
    pathname: "/api/workspace/calculations",
    search: "",
  });

  assert.equal(result.type, "deny");
  assert.equal(result.status, 403);
  assert.equal(result.responseBody.redirectTo, "/app/checkout");
});
