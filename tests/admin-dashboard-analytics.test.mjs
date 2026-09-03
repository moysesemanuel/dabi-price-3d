import assert from "node:assert/strict";
import test from "node:test";
import {
  fillDailyBuckets,
  resolveAdminAnalyticsPeriod,
} from "../src/lib/billing/admin-dashboard-analytics.ts";

const now = new Date("2026-08-28T15:00:00.000Z");

test("resolve periodos diarios no calendario de Sao Paulo", () => {
  const expectations = [
    ["7d", "2026-08-22", "2026-08-29", 7],
    ["30d", "2026-07-30", "2026-08-29", 30],
    ["90d", "2026-05-31", "2026-08-29", 90],
    ["year", "2026-01-01", "2026-08-29", 240],
  ];
  for (const [preset, first, end, count] of expectations) {
    const period = resolveAdminAnalyticsPeriod(preset, now);
    assert.equal(period.timezone, "America/Sao_Paulo");
    assert.equal(period.bucketDates[0], first);
    assert.equal(period.bucketDates.at(-1), "2026-08-28");
    assert.equal(period.end.slice(0, 10), end);
    assert.equal(period.bucketDates.length, count);
  }
});

test("preenche buckets sem movimento", () => {
  const period = resolveAdminAnalyticsPeriod("7d", now);
  const rows = fillDailyBuckets(period, [{ date: "2026-08-27", value: 3 }], (date) => ({ date, value: 0 }));
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.at(-2), { date: "2026-08-27", value: 3 });
  assert.deepEqual(rows.at(-1), { date: "2026-08-28", value: 0 });
});
