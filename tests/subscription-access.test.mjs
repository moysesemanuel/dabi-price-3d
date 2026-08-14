import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessApiPathWithoutPaidWorkspace,
  canAccessAppPathWithoutPaidWorkspace,
  canAccessPaidWorkspaceFeatures,
  getSubscriptionStatusLabel,
  resolveDefaultWorkspaceAppPath,
  resolveHistoryLimitPlanId,
} from "../src/lib/workspace/subscription-access.ts";

test("internal, trial e active mantem acesso ao produto", () => {
  assert.equal(canAccessPaidWorkspaceFeatures("internal"), true);
  assert.equal(canAccessPaidWorkspaceFeatures("trial"), true);
  assert.equal(canAccessPaidWorkspaceFeatures("active"), true);
});

test("unpaid, pending, paused e canceled nao liberam acesso pago", () => {
  assert.equal(canAccessPaidWorkspaceFeatures("unpaid"), false);
  assert.equal(canAccessPaidWorkspaceFeatures("pending"), false);
  assert.equal(canAccessPaidWorkspaceFeatures("paused"), false);
  assert.equal(canAccessPaidWorkspaceFeatures("canceled"), false);
});

test("resolve a rota padrao conforme onboarding e entitlement", () => {
  assert.equal(
    resolveDefaultWorkspaceAppPath({
      onboardingCompleted: false,
      subscriptionStatus: "unpaid",
    }),
    "/app/onboarding",
  );
  assert.equal(
    resolveDefaultWorkspaceAppPath({
      onboardingCompleted: true,
      subscriptionStatus: "unpaid",
    }),
    "/app/planos",
  );
  assert.equal(
    resolveDefaultWorkspaceAppPath({
      onboardingCompleted: true,
      subscriptionStatus: "pending",
    }),
    "/app/checkout",
  );
  assert.equal(
    resolveDefaultWorkspaceAppPath({
      onboardingCompleted: true,
      subscriptionStatus: "active",
    }),
    "/app/precificacao",
  );
  assert.equal(
    resolveDefaultWorkspaceAppPath({
      onboardingCompleted: true,
      subscriptionStatus: "paused",
    }),
    "/app/assinatura",
  );
  assert.equal(
    resolveDefaultWorkspaceAppPath({
      onboardingCompleted: true,
      subscriptionStatus: "canceled",
    }),
    "/app/assinatura",
  );
});

test("mantem apenas as rotas liberadas sem pagamento", () => {
  assert.equal(canAccessAppPathWithoutPaidWorkspace("/app/checkout"), true);
  assert.equal(canAccessAppPathWithoutPaidWorkspace("/app/planos"), true);
  assert.equal(canAccessAppPathWithoutPaidWorkspace("/app/conta"), true);
  assert.equal(canAccessAppPathWithoutPaidWorkspace("/app/assinatura"), true);
  assert.equal(canAccessAppPathWithoutPaidWorkspace("/app/assinatura/historico"), true);
  assert.equal(canAccessAppPathWithoutPaidWorkspace("/app/precificacao"), false);
  assert.equal(
    canAccessApiPathWithoutPaidWorkspace("/api/workspace/preferences"),
    true,
  );
  assert.equal(
    canAccessApiPathWithoutPaidWorkspace(
      "/api/payments/mercado-pago/subscriptions/checkout",
    ),
    true,
  );
  assert.equal(
    canAccessApiPathWithoutPaidWorkspace("/api/workspace/calculations"),
    false,
  );
});

test("expone label comercial para unpaid", () => {
  assert.equal(getSubscriptionStatusLabel("unpaid"), "Aguardando contratação");
});

test("active usa o plano contratado para definir preservacao do historico", () => {
  assert.equal(
    resolveHistoryLimitPlanId({
      planId: "growth",
      status: "active",
    }),
    "growth",
  );
});

test("unpaid usa Starter para definir preservacao do historico", () => {
  assert.equal(
    resolveHistoryLimitPlanId({
      planId: "starter",
      status: "unpaid",
    }),
    "starter",
  );
});

test("pending usa Starter enquanto a assinatura ainda nao foi confirmada", () => {
  assert.equal(
    resolveHistoryLimitPlanId({
      planId: "growth",
      status: "pending",
    }),
    "starter",
  );
});

test("paused preserva o plano contratado no historico", () => {
  assert.equal(
    resolveHistoryLimitPlanId({
      planId: "growth",
      status: "paused",
    }),
    "growth",
  );
});

test("canceled preserva o plano contratado no historico", () => {
  assert.equal(
    resolveHistoryLimitPlanId({
      planId: "growth",
      status: "canceled",
    }),
    "growth",
  );
});
