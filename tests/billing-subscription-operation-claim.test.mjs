import assert from "node:assert/strict";
import test from "node:test";

import {
  BillingSubscriptionOperationInProgressError,
  runWithBillingSubscriptionOperationClaim,
} from "../src/lib/billing/subscription-operation-claim.ts";

test("claim de operação executa apenas uma mutação concorrente por assinatura", async () => {
  let claimAvailable = true;
  let effects = 0;
  const released = [];
  const operation = () =>
    runWithBillingSubscriptionOperationClaim({
      subscriptionId: "sub-claim-1",
      async claimSubscriptionOperation() {
        if (!claimAvailable) {
          return null;
        }

        claimAvailable = false;
        return "claim-1";
      },
      async releaseSubscriptionOperationClaim(input) {
        released.push(input);
        return true;
      },
      async operation() {
        effects += 1;
      },
    });

  const results = await Promise.allSettled([operation(), operation()]);

  assert.equal(effects, 1);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(
    results.some(
      (result) =>
        result.status === "rejected" &&
        result.reason instanceof BillingSubscriptionOperationInProgressError,
    ),
  );
  assert.deepEqual(released, [
    { subscriptionId: "sub-claim-1", claimToken: "claim-1" },
  ]);
});

test("claim de operação é liberado quando o efeito falha", async () => {
  const released = [];

  await assert.rejects(
    runWithBillingSubscriptionOperationClaim({
      subscriptionId: "sub-claim-2",
      async claimSubscriptionOperation() {
        return "claim-2";
      },
      async releaseSubscriptionOperationClaim(input) {
        released.push(input);
        return true;
      },
      async operation() {
        throw new Error("provider unavailable");
      },
    }),
    /provider unavailable/,
  );

  assert.deepEqual(released, [
    { subscriptionId: "sub-claim-2", claimToken: "claim-2" },
  ]);
});
