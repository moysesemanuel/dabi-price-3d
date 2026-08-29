import { getCurrentAuthSession } from "@/lib/auth/session";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";

export async function POST(request: Request) {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  try {
    const body = await readReconciliationScope(request);
    const result = await createBillingAdminService().runProviderReconciliation({
      session,
      subscriptionId: body.subscriptionId,
    });

    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: mapBillingAdminError(error) },
      { status: mapBillingAdminStatus(error) },
    );
  }
}

async function readReconciliationScope(request: Request) {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return { subscriptionId: undefined };
  }

  try {
    const body = JSON.parse(rawBody) as { subscriptionId?: unknown } | null;

    if (!body || typeof body.subscriptionId === "undefined") {
      return { subscriptionId: undefined };
    }

    if (typeof body.subscriptionId !== "string" || !body.subscriptionId.trim()) {
      throw new Error("invalid_subscription_id");
    }

    return { subscriptionId: body.subscriptionId.trim() };
  } catch {
    throw Object.assign(new Error("subscription_id_invalido"), { status: 400 });
  }
}

function mapBillingAdminError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "A area administrativa de billing e exclusiva para super admin.") {
      return "Essa acao e exclusiva para super admin.";
    }

    if (error.message === "Esse ambiente nao possui persistencia de billing habilitada.") {
      return "Esse ambiente nao possui persistencia de billing habilitada.";
    }

    if (error.message === "subscription_id_invalido") {
      return "subscriptionId invalido.";
    }
  }

  return "Falha ao executar a reconciliacao.";
}

function mapBillingAdminStatus(error: unknown) {
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    return error.status;
  }

  return 500;
}
