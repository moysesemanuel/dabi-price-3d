import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAdminAnalyticsCurrency,
  formatAdminAnalyticsDate,
  getDistributionLabel,
  hasAdminAnalyticsData,
  resolveAdminDashboardPeriod,
} from "../src/lib/billing/admin-dashboard-chart-data.ts";

test("resolve o filtro de período com fallback de 30 dias", () => {
  assert.equal(resolveAdminDashboardPeriod("7d"), "7d");
  assert.equal(resolveAdminDashboardPeriod("year"), "year");
  assert.equal(resolveAdminDashboardPeriod("invalido"), "30d");
  assert.equal(resolveAdminDashboardPeriod(undefined), "30d");
});

test("formata valores e labels que serão usados nos gráficos", () => {
  assert.equal(formatAdminAnalyticsCurrency(12500), "R$ 125");
  assert.match(formatAdminAnalyticsDate("2030-08-27"), /27/);
  assert.equal(getDistributionLabel("status", "past_due"), "Em atraso");
  assert.equal(getDistributionLabel("billingCycle", "annual"), "Anual");
});

test("identifica o fallback sem dados sem depender do SVG do Recharts", () => {
  const empty = {
    revenue: [{ date: "2030-08-27", paidInvoiceCount: 0, paidRevenueCents: 0, cumulativePaidRevenueCents: 0 }],
    invoices: [{ date: "2030-08-27", created: 0, paid: 0, pending: 0, failed: 0 }],
    webhooks: [{ date: "2030-08-27", processed: 0, failed: 0, ignored: 0 }],
    distributions: { plan: [], billingCycle: [], status: [] },
  };
  assert.equal(hasAdminAnalyticsData(empty), false);
  assert.equal(hasAdminAnalyticsData({ ...empty, revenue: [{ ...empty.revenue[0], paidInvoiceCount: 1, paidRevenueCents: 1 }] }), true);
});
