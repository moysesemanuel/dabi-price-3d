import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { isAuthorizedSentryVerificationRequest } from "../src/lib/observability/sentry-test-auth.ts";

const originalEnvironment = process.env.SENTRY_ENVIRONMENT;
const originalSecret = process.env.SENTRY_TEST_SECRET;

afterEach(() => {
  if (originalEnvironment === undefined) {
    delete process.env.SENTRY_ENVIRONMENT;
  } else {
    process.env.SENTRY_ENVIRONMENT = originalEnvironment;
  }

  if (originalSecret === undefined) {
    delete process.env.SENTRY_TEST_SECRET;
  } else {
    process.env.SENTRY_TEST_SECRET = originalSecret;
  }
});

test("a verificacao de servidor so autoriza HML com segredo Bearer valido", () => {
  process.env.SENTRY_ENVIRONMENT = "production";
  process.env.SENTRY_TEST_SECRET = "verification-secret";
  const request = new Request("https://dabi.app/api/internal/observability/verify", {
    headers: { authorization: "Bearer verification-secret" },
  });

  assert.equal(isAuthorizedSentryVerificationRequest(request), false);

  process.env.SENTRY_ENVIRONMENT = "hml";
  delete process.env.SENTRY_TEST_SECRET;
  assert.equal(isAuthorizedSentryVerificationRequest(request), false);

  process.env.SENTRY_TEST_SECRET = "verification-secret";
  assert.equal(isAuthorizedSentryVerificationRequest(request), true);
  assert.equal(
    isAuthorizedSentryVerificationRequest(
      new Request("https://dabi.app/api/internal/observability/verify", {
        headers: { authorization: "Bearer invalid" },
      }),
    ),
    false,
  );
});
