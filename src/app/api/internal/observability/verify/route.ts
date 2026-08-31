import * as Sentry from "@sentry/nextjs";

import { createSentryOptions } from "@/lib/observability/sentry-config";
import {
  isAuthorizedSentryVerificationRequest,
  isSentryVerificationStatusRequest,
} from "@/lib/observability/sentry-test-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedSentryVerificationRequest(request)) {
    return new Response(null, { status: 404 });
  }

  if (isSentryVerificationStatusRequest(request)) {
    const sentryOptions = createSentryOptions({
      dsn: process.env.SENTRY_DSN,
      vercelEnv: process.env.VERCEL_ENV,
      sentryEnvironment: process.env.SENTRY_ENVIRONMENT,
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    });

    return new Response(null, {
      status: 204,
      headers: {
        "X-Next-Runtime": process.env.NEXT_RUNTIME ?? "unknown",
        "X-Sentry-Server-Configured": String(Boolean(sentryOptions)),
        "X-Sentry-Server-Enabled": String(Boolean(Sentry.getClient())),
      },
    });
  }

  const error = new Error("sentry-server-verification");
  Sentry.captureException(error);
  await Sentry.flush(2_000);
  throw error;
}
