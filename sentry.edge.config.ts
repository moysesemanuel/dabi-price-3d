import * as Sentry from "@sentry/nextjs";
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
}
