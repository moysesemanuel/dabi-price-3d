import type {
  AdminAnalyticsPeriodPreset,
  AdminDashboardAnalytics,
} from "./admin-dashboard-analytics.ts";

export const defaultAdminAnalyticsPeriod: AdminAnalyticsPeriodPreset = "30d";

export function resolveAdminDashboardPeriod(value: unknown): AdminAnalyticsPeriodPreset {
  return value === "7d" || value === "30d" || value === "90d" || value === "year"
    ? value
    : defaultAdminAnalyticsPeriod;
}

export function formatAdminAnalyticsDate(value: string) {
  const date = new Date(`${value}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatAdminAnalyticsCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

export function getDistributionLabel(dimension: "plan" | "billingCycle" | "status", key: string) {
  const labels: Record<string, string> = {
    starter: "Start",
    growth: "Pro",
    scale: "Max",
    monthly: "Mensal",
    annual: "Anual",
    active: "Ativa",
    pending: "Pendente",
    past_due: "Em atraso",
    paused: "Pausada",
    scheduled_cancel: "Cancelamento agendado",
    canceled: "Cancelada",
    expired: "Expirada",
  };
  return labels[`${dimension}:${key}`] ?? labels[key] ?? key.replaceAll("_", " ");
}

export function hasAdminAnalyticsData(analytics: AdminDashboardAnalytics) {
  return analytics.revenue.some((row) => row.paidInvoiceCount > 0)
    || analytics.invoices.some((row) => row.created + row.paid + row.pending + row.failed > 0)
    || analytics.webhooks.some((row) => row.processed + row.failed + row.ignored > 0)
    || analytics.distributions.plan.some((row) => row.count > 0);
}
