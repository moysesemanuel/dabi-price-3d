import assert from "node:assert/strict";
import test from "node:test";

import { calculateProratedUpgradeAmounts } from "../src/lib/billing/upgrade-proration.ts";

test("calcula crédito e cobrança proporcionais no upgrade", () => {
  const result = calculateProratedUpgradeAmounts({
    currentPrice: {
      amountCents: 5000,
    },
    targetPrice: {
      amountCents: 15000,
    },
    subscription: {
      currentPeriodStart: "2026-08-01T00:00:00.000Z",
      currentPeriodEnd: "2026-08-11T00:00:00.000Z",
    },
    asOf: "2026-08-06T00:00:00.000Z",
  });

  assert.deepEqual(result, {
    remainingRatio: 0.5,
    creditAmountCents: 2500,
    chargeAmountCents: 7500,
    netAmountCents: 5000,
  });
});

test("falha quando o plano de destino não representa upgrade", () => {
  assert.throws(
    () =>
      calculateProratedUpgradeAmounts({
        currentPrice: {
          amountCents: 15000,
        },
        targetPrice: {
          amountCents: 15000,
        },
        subscription: {
          currentPeriodStart: "2026-08-01T00:00:00.000Z",
          currentPeriodEnd: "2026-08-11T00:00:00.000Z",
        },
        asOf: "2026-08-06T00:00:00.000Z",
      }),
    /greater than the current plan amount/,
  );
});
