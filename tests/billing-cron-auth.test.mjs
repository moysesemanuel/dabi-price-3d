import assert from "node:assert/strict";
import test from "node:test";

import { isAuthorizedBillingCronRequest } from "../src/lib/billing/cron-auth.ts";

test("cron exige segredo configurado e header Bearer correspondente", (t) => {
  const previousSecret = process.env.CRON_SECRET;
  t.after(() => {
    if (previousSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previousSecret;
    }
  });

  delete process.env.CRON_SECRET;
  assert.equal(
    isAuthorizedBillingCronRequest(new Request("https://dabi.app/api/cron")),
    false,
  );

  process.env.CRON_SECRET = "secret-test";
  assert.equal(
    isAuthorizedBillingCronRequest(
      new Request("https://dabi.app/api/cron", {
        headers: { authorization: "Bearer secret-test" },
      }),
    ),
    true,
  );
  assert.equal(
    isAuthorizedBillingCronRequest(
      new Request("https://dabi.app/api/cron", {
        headers: { authorization: "Bearer incorrect" },
      }),
    ),
    false,
  );
});
