import * as Sentry from "@sentry/nextjs";

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
    return new Response(null, {
      status: 204,
      headers: {
        "X-Sentry-Server-Enabled": String(Boolean(Sentry.getClient())),
      },
    });
  }

  throw new Error("sentry-server-verification");
}
