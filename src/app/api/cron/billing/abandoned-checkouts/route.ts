import { isAuthorizedBillingCronRequest } from "@/lib/billing/cron-auth";
import { createBillingReconciliationRunner } from "@/lib/billing/server-reconciliation-runner";

export async function GET(request: Request) {
  const authorizationError = authorize(request);

  if (authorizationError) {
    return authorizationError;
  }

  const result =
    await createBillingReconciliationRunner().runAbandonedCheckoutCleanup();

  return Response.json({ ok: true, job: "abandoned-checkouts", ...result });
}

function authorize(request: Request) {
  if (!process.env.CRON_SECRET) {
    return Response.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorizedBillingCronRequest(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}
