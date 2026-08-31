import assert from "node:assert/strict";
import test from "node:test";

import { createBillingClaimReporter } from "../src/lib/observability/billing-claim.ts";

test("reporter de claim envia alerta sem dados pessoais ou tokens", () => {
  const messages = [];
  const reportClaimLost = createBillingClaimReporter((message, context) => {
    messages.push({ message, context });
  });

  reportClaimLost({
    claimType: "subscription_operation",
    subscriptionId: "sub-claim-observability-1",
  });

  assert.deepEqual(messages, [
    {
      message: "billing.claim_lost",
      context: {
        level: "warning",
        extra: {
          claimType: "subscription_operation",
          subscriptionId: "sub-claim-observability-1",
        },
      },
    },
  ]);
});
