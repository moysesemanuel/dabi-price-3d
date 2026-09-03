import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkspaceCommercialSnapshot } from "../src/lib/workspace/commercial-insights.ts";

function createSavedCalculation(index, overrides = {}) {
  return {
    id: `calc-${index}`,
    savedAt: new Date(Date.UTC(2026, 6, 1 + index, 10, 0, 0)).toISOString(),
    productName: `Produto ${index}`,
    salesChannelId: overrides.salesChannelId ?? "mercado-livre",
    salesChannelLabel: overrides.salesChannelLabel ?? "Mercado Livre",
    displayCurrency: "BRL",
    exchangeRateSnapshot: {
      base: "BRL",
      date: "2026-08-06",
      rates: { BRL: 1, USD: 0.18, EUR: 0.16 },
    },
    formSnapshot: overrides.formSnapshot ?? {},
    summary: {
      salePrice: overrides.salePrice ?? 100,
      totalCost: overrides.totalCost ?? 60,
      profit: overrides.profit ?? 40,
      marginPercentage: overrides.marginPercentage ?? 40,
      profitPerHour: overrides.profitPerHour ?? 80,
    },
    erpProduct: overrides.erpProduct,
    siteProduct: overrides.siteProduct,
  };
}

function createAuditEvent(index, overrides = {}) {
  return {
    id: `audit-${index}`,
    occurredAt: new Date(Date.UTC(2026, 6, 10 + index, 11, 0, 0)).toISOString(),
    type: overrides.type ?? "calculation-saved",
    title: overrides.title ?? `Evento ${index}`,
    description: overrides.description ?? "Registro operacional",
    tone: overrides.tone ?? "neutral",
  };
}

function createPreferences(overrides = {}) {
  return {
    workspaceName: "Dabi Tech 3D",
    operatorName: "Moysés",
    operatorEmail: "ops@dabitech3d.com",
    operatorRole: "owner",
    businessPresetId: "studio",
    defaultDisplayCurrency: "BRL",
    applyPresetToNewCalculations: true,
    onboardingCompleted: true,
    subscription: {
      planId: "growth",
      status: "active",
      seatsUsed: 1,
    },
    pricingDefaults: {
      pricingMode: "margin",
      profitMarginPercentage: 50,
      healthyMarginTargetPercentage: 30,
      lossPercentage: 8,
      lossLaborSharePercentage: 30,
      maintenanceCostPerHour: 4,
      expansionReserveCostPerHour: 3,
      taxPercentage: 6,
      laborCostPerHour: 31.25,
      kwhPrice: 0.9,
    },
    ...overrides,
  };
}

test("workspace pouco estruturado aparece como em estruturação", () => {
  const preferences = createPreferences({
    workspaceName: "Dabi Tech 3D",
    operatorName: "",
    operatorEmail: "",
    onboardingCompleted: false,
    subscription: {
      planId: "growth",
      status: "unpaid",
      seatsUsed: 1,
    },
  });

  const snapshot = buildWorkspaceCommercialSnapshot({
    preferences,
    subscription: {
      planId: "growth",
      status: "unpaid",
      billingCycle: "monthly",
      seatsUsed: 1,
      mercadoPagoSubscriptionId: null,
      checkoutStartedAt: null,
    },
    history: [],
    auditLog: [],
  });

  assert.equal(snapshot.planLabel, "DaBi Pro");
  assert.equal(snapshot.historyLimit, 200);
  assert.equal(snapshot.readinessTone, "pending");
  assert.equal(snapshot.readinessLabel, "Em estruturação");
  assert.equal(snapshot.channelsUsedCount, 0);
});

test("workspace validado com histórico e ERP sobe para pronto para venda", () => {
  const preferences = createPreferences({
    workspaceName: "Dabi Scale",
    operatorName: "Moysés",
    operatorEmail: "ops@dabitech3d.com",
    operatorRole: "owner",
    businessPresetId: "farm",
    onboardingCompleted: true,
    subscription: {
      planId: "scale",
      status: "active",
      seatsUsed: 3,
    },
  });
  const history = Array.from({ length: 20 }, (_, index) =>
    createSavedCalculation(index, {
      salesChannelId:
        index % 3 === 0
          ? "mercado-livre"
          : index % 3 === 1
            ? "shopee"
            : "direct",
      salesChannelLabel:
        index % 3 === 0
          ? "Mercado Livre"
          : index % 3 === 1
            ? "Shopee"
            : "Venda Direta",
      erpProduct:
        index < 8
          ? {
              id: `erp-${index}`,
              sku: `SKU-${index}`,
              syncedAt: new Date().toISOString(),
            }
          : undefined,
      siteProduct:
        index < 4
          ? {
              id: `site-${index}`,
              slug: `produto-${index}`,
              url: null,
              publishedAt: new Date().toISOString(),
            }
          : undefined,
      marginPercentage: 34 + (index % 4),
      profit: 35 + index,
    }),
  );
  const auditLog = Array.from({ length: 12 }, (_, index) =>
    createAuditEvent(index, {
      tone: index % 2 === 0 ? "success" : "neutral",
    }),
  );

  const snapshot = buildWorkspaceCommercialSnapshot({
    preferences,
    subscription: {
      planId: "scale",
      status: "active",
      billingCycle: "monthly",
      seatsUsed: 3,
      mercadoPagoSubscriptionId: null,
      checkoutStartedAt: null,
    },
    history,
    auditLog,
  });

  assert.equal(snapshot.readinessTone, "ready");
  assert.equal(snapshot.readinessLabel, "Pronto para venda");
  assert.equal(snapshot.channelsUsedCount, 3);
  assert.equal(snapshot.erpSyncCount, 8);
  assert.equal(snapshot.siteProductLinksCount, 4);
  assert.equal(snapshot.planLabel, "DaBi Max");
  assert.ok(snapshot.readinessScore >= 80);
});

test("excesso de assentos derruba o status de capacidade", () => {
  const preferences = createPreferences({
    workspaceName: "Dabi Starter",
    operatorName: "Moysés",
    operatorEmail: "financeiro@dabitech3d.com",
    businessPresetId: "maker",
    onboardingCompleted: true,
    subscription: {
      planId: "starter",
      status: "active",
      seatsUsed: 3,
    },
  });

  const snapshot = buildWorkspaceCommercialSnapshot({
    preferences,
    subscription: {
      planId: "starter",
      status: "active",
      billingCycle: "monthly",
      seatsUsed: 3,
      mercadoPagoSubscriptionId: null,
      checkoutStartedAt: null,
    },
    history: [createSavedCalculation(1)],
    auditLog: [createAuditEvent(1)],
  });

  const capacityItem = snapshot.readinessItems.find(
    (item) => item.id === "capacity",
  );

  assert.equal(snapshot.seatsBalance, -2);
  assert.equal(capacityItem?.status, "pending");
});

test("snapshot usa a assinatura comercial fornecida em vez do espelho de preferencias", () => {
  const snapshot = buildWorkspaceCommercialSnapshot({
    preferences: createPreferences({
      subscription: {
        planId: "scale",
        status: "active",
        seatsUsed: 99,
      },
    }),
    subscription: {
      planId: "starter",
      status: "unpaid",
      billingCycle: "monthly",
      seatsUsed: 1,
      mercadoPagoSubscriptionId: null,
      checkoutStartedAt: null,
    },
    history: [],
    auditLog: [],
  });

  assert.equal(snapshot.planLabel, "DaBi Start");
  assert.equal(snapshot.planStatusLabel, "Aguardando contratação");
  assert.equal(snapshot.seatsUsed, 1);
});
