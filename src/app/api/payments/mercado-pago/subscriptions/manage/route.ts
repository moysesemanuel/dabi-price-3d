import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getBillingProvider } from "@/lib/billing/providers";
import { findCurrentBillingSubscriptionForWorkspace } from "@/lib/billing/repository";
import { createBillingService } from "@/lib/billing/server-service";
import {
  manageMercadoPagoBillingSubscription,
  ManageBillingSubscriptionError,
} from "@/lib/billing/subscription-management";
import {
  getMercadoPagoAccessToken,
} from "@/lib/payments/mercado-pago";
import {
  applyWorkspaceSubscriptionUpdate,
} from "@/lib/server/platform";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";

type ManageSubscriptionPayload = {
  action?: "resume" | "cancel";
};

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/payments/mercado-pago/subscriptions/manage",
  );

  let session;

  try {
    session = await requireCurrentAuthSession();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
    ) {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para gerenciar a assinatura.",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    throw error;
  }

  if (!canManageWorkspaceBilling(session)) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "Apenas o proprietário do workspace pode gerenciar a assinatura.",
        code: "BILLING_FORBIDDEN",
      },
      { status: 403 },
    );
  }

  let body: ManageSubscriptionPayload;

  try {
    body = (await request.json()) as ManageSubscriptionPayload;
  } catch {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Payload inválido.",
        code: "SUBSCRIPTION_MANAGE_INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const action = body.action;

  if (action !== "resume" && action !== "cancel") {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Informe uma ação válida para a assinatura.",
        code: "SUBSCRIPTION_MANAGE_INVALID_ACTION",
      },
      { status: 400 },
    );
  }

  const subscription = await findCurrentBillingSubscriptionForWorkspace(
    session.workspace.id,
  );

  if (!subscription) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Este workspace não possui uma assinatura corrente para gerenciar.",
        code: "SUBSCRIPTION_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  if (!getMercadoPagoAccessToken()) {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "A integração de pagamentos ainda não está configurada neste ambiente.",
        code: "MERCADO_PAGO_ACCESS_TOKEN_MISSING",
      },
      { status: 503 },
    );
  }

  try {
    const provider = getBillingProvider("mercado_pago");
    const billingService = createBillingService();
    const result = await manageMercadoPagoBillingSubscription({
      action,
      actorId: session.user.id,
      subscription,
      dependencies: {
        provider,
        billingService,
        applyWorkspaceSubscriptionUpdate,
      },
    });

    logRouteEvent(
      requestContext,
      "info",
      "mercado_pago_subscription_managed",
      {
        workspaceId: session.workspace.id,
        userId: session.user.id,
        action,
        subscriptionId: subscription.id,
        providerSubscriptionId: subscription.providerSubscriptionId,
        billingStatus: result.localSubscription.status,
        mercadoPagoStatus: result.providerSubscription.status ?? null,
      },
    );

    return jsonWithRequestId(requestContext, {
      ok: true,
      action,
      subscriptionId: subscription.id,
      providerSubscriptionId: subscription.providerSubscriptionId,
      status: result.localSubscription.status,
    });
  } catch (error) {
    logRouteEvent(
      requestContext,
      "error",
      "mercado_pago_subscription_manage_failed",
      {
        workspaceId: session.workspace.id,
        userId: session.user.id,
        action,
        subscriptionId: subscription.id,
        providerSubscriptionId: subscription.providerSubscriptionId,
        error: serializeError(error),
      },
    );

    if (error instanceof ManageBillingSubscriptionError) {
      return jsonWithRequestId(
        requestContext,
        {
          error: error.message,
          code: error.code,
        },
        { status: error.status },
      );
    }

    return jsonWithRequestId(
      requestContext,
      {
        error: "Não foi possível atualizar a assinatura no Mercado Pago.",
        code: "SUBSCRIPTION_MANAGE_FAILED",
      },
      { status: 502 },
    );
  }
}
