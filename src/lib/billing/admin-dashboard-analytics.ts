export const adminAnalyticsTimezone = "America/Sao_Paulo" as const;
export const adminAnalyticsPeriodPresets = ["7d", "30d", "90d", "year"] as const;

export type AdminAnalyticsPeriodPreset = (typeof adminAnalyticsPeriodPresets)[number];

export type AdminAnalyticsPeriod = {
  preset: AdminAnalyticsPeriodPreset;
  timezone: typeof adminAnalyticsTimezone;
  start: string;
  end: string;
  granularity: "day";
  bucketDates: string[];
};

export type AdminDashboardAnalytics = {
  period: AdminAnalyticsPeriod;
  revenue: Array<{
    date: string;
    paidInvoiceCount: number;
    paidRevenueCents: number;
    cumulativePaidRevenueCents: number;
  }>;
  invoices: Array<{
    date: string;
    created: number;
    paid: number;
    pending: number;
    failed: number;
  }>;
  webhooks: Array<{
    date: string;
    processed: number;
    failed: number;
    ignored: number;
  }>;
  newPaidSubscriptions: Array<{ date: string; count: number }>;
  distributions: {
    plan: Array<{ key: string; count: number }>;
    billingCycle: Array<{ key: string; count: number }>;
    status: Array<{ key: string; count: number }>;
  };
};

export function isAdminAnalyticsPeriodPreset(value: unknown): value is AdminAnalyticsPeriodPreset {
  return typeof value === "string" && adminAnalyticsPeriodPresets.includes(value as AdminAnalyticsPeriodPreset);
}

export function resolveAdminAnalyticsPeriod(
  preset: AdminAnalyticsPeriodPreset,
  now = new Date(),
): AdminAnalyticsPeriod {
  const today = getLocalDate(now);
  const periodStart = preset === "year"
    ? { year: today.year, month: 1, day: 1 }
    : addDays(today, -({ "7d": 6, "30d": 29, "90d": 89 }[preset]));
  const endDate = addDays(today, 1);
  const bucketDates: string[] = [];

  for (let date = periodStart; compareDates(date, endDate) < 0; date = addDays(date, 1)) {
    bucketDates.push(formatDate(date));
  }

  return {
    preset,
    timezone: adminAnalyticsTimezone,
    start: localMidnightToUtc(periodStart).toISOString(),
    end: localMidnightToUtc(endDate).toISOString(),
    granularity: "day",
    bucketDates,
  };
}

export function fillDailyBuckets<T extends { date: string }>(
  period: AdminAnalyticsPeriod,
  rows: T[],
  empty: (date: string) => T,
): T[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return period.bucketDates.map((date) => byDate.get(date) ?? empty(date));
}

type LocalDate = { year: number; month: number; day: number };

function getLocalDate(value: Date): LocalDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: adminAnalyticsTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function localMidnightToUtc(date: LocalDate) {
  const utcGuess = Date.UTC(date.year, date.month - 1, date.day);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: adminAnalyticsTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcGuess));
  const value = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  const localAsUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return new Date(utcGuess - (localAsUtc - utcGuess));
}

function addDays(date: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

function compareDates(left: LocalDate, right: LocalDate) {
  return Date.UTC(left.year, left.month - 1, left.day) - Date.UTC(right.year, right.month - 1, right.day);
}

function formatDate(date: LocalDate) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}
