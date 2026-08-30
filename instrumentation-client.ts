import * as Sentry from "@sentry/nextjs";
import {
  createSentryOptions,
  sanitizeSentryEvent,
} from "./src/lib/observability/sentry-config";

const sentryOptions = createSentryOptions({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
  sentryEnvironment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
});

if (sentryOptions) {
  Sentry.init({
    ...sentryOptions,
    beforeSend: sanitizeSentryEvent,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
