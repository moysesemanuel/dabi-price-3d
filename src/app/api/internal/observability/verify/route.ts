import { isAuthorizedSentryVerificationRequest } from "@/lib/observability/sentry-test-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedSentryVerificationRequest(request)) {
    return new Response(null, { status: 404 });
  }

  throw new Error("sentry-server-verification");
}
