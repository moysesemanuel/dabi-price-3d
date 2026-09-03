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

test("claim perdido é reportado quando a liberação devolve false", async () => {
  const reported = [];

  await runWithBillingSubscriptionOperationClaim({
    subscriptionId: "sub-claim-3",
    async claimSubscriptionOperation() {
      return "claim-3";
    },
    async releaseSubscriptionOperationClaim() {
      return false;
    },
    reportClaimLost(event) {
      reported.push(event);
    },
    async operation() {},
  });

  assert.deepEqual(reported, [
    { claimType: "subscription_operation", subscriptionId: "sub-claim-3" },
  ]);
});

test("claim perdido é reportado quando a liberação lança erro", async () => {
  const reported = [];

  await runWithBillingSubscriptionOperationClaim({
    subscriptionId: "sub-claim-4",
    async claimSubscriptionOperation() {
      return "claim-4";
    },
    async releaseSubscriptionOperationClaim() {
      throw new Error("conexao perdida");
    },
    reportClaimLost(event) {
      reported.push(event);
    },
    async operation() {},
  });

  assert.deepEqual(reported, [
    { claimType: "subscription_operation", subscriptionId: "sub-claim-4" },
  ]);
});

test("liberação bem-sucedida não reporta claim perdido", async () => {
  const reported = [];

  await runWithBillingSubscriptionOperationClaim({
    subscriptionId: "sub-claim-5",
    async claimSubscriptionOperation() {
      return "claim-5";
    },
    async releaseSubscriptionOperationClaim() {
      return true;
    },
    reportClaimLost(event) {
      reported.push(event);
    },
    async operation() {},
  });

  assert.deepEqual(reported, []);
});

test("falha do reporter não derruba a operação nem mascara o erro do efeito", async () => {
  await assert.rejects(
    runWithBillingSubscriptionOperationClaim({
      subscriptionId: "sub-claim-6",
      async claimSubscriptionOperation() {
        return "claim-6";
      },
      async releaseSubscriptionOperationClaim() {
        return false;
      },
      reportClaimLost() {
        throw new Error("sentry indisponivel");
      },
      async operation() {
        throw new Error("provider unavailable");
      },
    }),
    /provider unavailable/,
  );
});

test("sem reporter registrado a liberação falha em silêncio, como antes", async () => {
  await runWithBillingSubscriptionOperationClaim({
    subscriptionId: "sub-claim-7",
    async claimSubscriptionOperation() {
      return "claim-7";
    },
    async releaseSubscriptionOperationClaim() {
      throw new Error("conexao perdida");
    },
    async operation() {},
  });
});
