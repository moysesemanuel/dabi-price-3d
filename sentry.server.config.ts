import * as Sentry from "@sentry/nextjs";
import { registerSentryRouteErrorReporter } from "./src/lib/observability/route-error-reporter";
import { createBillingFencingViolationReporter } from "./src/lib/observability/billing-fencing";
import { setBillingFencingViolationReporter } from "./src/lib/billing/subscription-operation-context";
import {
  createSentryOptions,
  sanitizeSentryEvent,
} from "./src/lib/observability/sentry-config";

const sentryOptions = createSentryOptions({
  dsn: process.env.SENTRY_DSN,
  vercelEnv: process.env.VERCEL_ENV,
  sentryEnvironment: process.env.SENTRY_ENVIRONMENT,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
});

if (sentryOptions) {
  Sentry.init({
    ...sentryOptions,
    beforeSend: sanitizeSentryEvent,
  });

  registerSentryRouteErrorReporter();
  setBillingFencingViolationReporter(
    createBillingFencingViolationReporter(Sentry.captureMessage),
  );
}
