import { getCurrentAuthSession } from "@/lib/auth/session";
import { createBillingAdminService } from "@/lib/billing/server-admin-service";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/admin/billing/reconciliation",
  );
  let subscriptionId: string | undefined;

  try {
    const session = await getCurrentAuthSession();

    if (!session) {
      return jsonWithRequestId(
        requestContext,
        { error: "Nao autenticado." },
        { status: 401 },
      );
    }

    const body = await readReconciliationScope(request);
    subscriptionId = body.subscriptionId;
    const result = await createBillingAdminService().runProviderReconciliation({
      session,
      subscriptionId,
    });

    return jsonWithRequestId(requestContext, result);
  } catch (error) {
    const status = mapBillingAdminStatus(error);

    if (status >= 500) {
      logRouteEvent(requestContext, "error", "billing_admin.reconciliation_failed", {
        subscriptionId,
        error: serializeError(error),
      });
    }

    return jsonWithRequestId(
      requestContext,
      { error: mapBillingAdminError(error) },
      { status },
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

    if ("code" in error && error.code === "ADMIN_BILLING_SUBSCRIPTION_NOT_FOUND") {
      return "Assinatura nao encontrada.";
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
