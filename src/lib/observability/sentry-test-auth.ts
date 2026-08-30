export function isAuthorizedSentryVerificationRequest(request: Request): boolean {
  const secret = process.env.SENTRY_TEST_SECRET;

  return (
    process.env.SENTRY_ENVIRONMENT === "hml" &&
    Boolean(secret) &&
    request.headers.get("authorization") === `Bearer ${secret}`
  );
}
