import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

import { createSentryOptions } from "./lib/observability/sentry-config";

const sentryOptions = createSentryOptions({
  dsn: process.env.SENTRY_DSN,
  vercelEnv: process.env.VERCEL_ENV,
  sentryEnvironment: process.env.SENTRY_ENVIRONMENT,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
});

export async function register(): Promise<void> {
  if (!sentryOptions) {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  errorContext,
) => {
  if (sentryOptions) {
    Sentry.captureRequestError(error, request, errorContext);
  }
};
