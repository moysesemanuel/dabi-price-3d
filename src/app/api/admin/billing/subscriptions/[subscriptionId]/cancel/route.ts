import { isSuperAdminSession } from "@/lib/auth/access-control";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { getBillingProvider } from "@/lib/billing/providers";
import { getBillingSubscriptionById } from "@/lib/billing/repository";
import { createBillingService } from "@/lib/billing/server-service";
import { runWithServerBillingSubscriptionOperationClaim } from "@/lib/billing/server-subscription-operation-claim";
import {
  ManageBillingSubscriptionError,
  manageCurrentMercadoPagoBillingSubscription,
} from "@/lib/billing/subscription-management";
import { BillingSubscriptionOperationInProgressError } from "@/lib/billing/subscription-operation-claim";
import { applyWorkspaceSubscriptionUpdate } from "@/lib/server/platform";

export async function POST(
  _request: Request,
  context: { params: Promise<{ subscriptionId: string }> },
) {
  const session = await getCurrentAuthSession();

  if (!session) {
    return Response.json({ error: "Nao autenticado." }, { status: 401 });
  }

  if (!isSuperAdminSession(session)) {
    return Response.json(
      { error: "Essa acao e exclusiva para super admin." },
      { status: 403 },
    );
  }

  const { subscriptionId } = await context.params;
  const subscription = await getBillingSubscriptionById(subscriptionId);

  if (!subscription) {
    return Response.json({ error: "Assinatura nao encontrada." }, { status: 404 });
  }

  try {
    const result = await manageCurrentMercadoPagoBillingSubscription({
      action: "cancel",
      actorId: session.user.id,
      actorType: "super_admin",
      subscription,
      getCurrentSubscription: () => getBillingSubscriptionById(subscription.id),
      runWithSubscriptionOperation:
        runWithServerBillingSubscriptionOperationClaim,
      dependencies: {
        provider: getBillingProvider("mercado_pago"),
        billingService: createBillingService(),
        applyWorkspaceSubscriptionUpdate,
      },
    });

    return Response.json({
      ok: true,
      subscriptionId: result.localSubscription.id,
      status: result.localSubscription.status,
    });
  } catch (error) {
    if (error instanceof ManageBillingSubscriptionError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }

    if (error instanceof BillingSubscriptionOperationInProgressError) {
      return Response.json(
        {
          error: "Uma atualização desta assinatura já está em andamento.",
          code: "SUBSCRIPTION_OPERATION_IN_PROGRESS",
        },
        { status: 409 },
      );
    }

    return Response.json(
      { error: "Falha ao agendar o cancelamento da assinatura." },
      { status: 502 },
    );
  }
}
