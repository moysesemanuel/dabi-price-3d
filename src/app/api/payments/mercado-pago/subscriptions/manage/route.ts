import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getBillingProvider } from "@/lib/billing/providers";
import {
    getMercadoPagoAccessToken,
} from "@/lib/payments/mercado-pago";
import {
    getWorkspacePreferences,
} from "@/lib/server/platform";
import {
    createRouteRequestContext,
    jsonWithRequestId,
    logRouteEvent,
    serializeError,
} from "@/lib/server/route-observability";

type ManageSubscriptionPayload = {
    action?: "pause" | "resume" | "cancel";
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

    if (
        action !== "pause" &&
        action !== "resume" &&
        action !== "cancel"
    ) {
        return jsonWithRequestId(
            requestContext,
            {
                error: "Informe uma ação válida para a assinatura.",
                code: "SUBSCRIPTION_MANAGE_INVALID_ACTION",
            },
            { status: 400 },
        );
    }

    const preferences = await getWorkspacePreferences(session.workspace.id);
    const subscription = preferences.subscription;

    if (!subscription.mercadoPagoSubscriptionId) {
        return jsonWithRequestId(
            requestContext,
            {
                error: "Este workspace não possui uma assinatura do Mercado Pago.",
                code: "SUBSCRIPTION_NOT_FOUND",
            },
            { status: 404 },
        );
    }

    const actionAllowed =
        (action === "pause" && subscription.status === "active") ||
        (action === "resume" && subscription.status === "paused") ||
        (action === "cancel" &&
            (subscription.status === "active" ||
                subscription.status === "paused" ||
                subscription.status === "pending"));

    if (!actionAllowed) {
        return jsonWithRequestId(
            requestContext,
            {
                error: `A ação ${action} não é permitida para uma assinatura com status ${subscription.status}.`,
                code: "SUBSCRIPTION_MANAGE_INVALID_STATE",
            },
            { status: 409 },
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
        const updatedSubscription =
            action === "pause"
                ? await provider.pauseSubscription(subscription.mercadoPagoSubscriptionId)
                : action === "resume"
                    ? await provider.resumeSubscription(subscription.mercadoPagoSubscriptionId)
                    : await provider.cancelSubscription(subscription.mercadoPagoSubscriptionId);

        logRouteEvent(
            requestContext,
            "info",
            "mercado_pago_subscription_managed",
            {
                workspaceId: session.workspace.id,
                userId: session.user.id,
                action,
                subscriptionId: subscription.mercadoPagoSubscriptionId,
                mercadoPagoStatus: updatedSubscription.status ?? null,
            },
        );

        return jsonWithRequestId(requestContext, {
            ok: true,
            action,
            subscriptionId: subscription.mercadoPagoSubscriptionId,
            status: updatedSubscription.status,
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
                subscriptionId: subscription.mercadoPagoSubscriptionId,
                error: serializeError(error),
            },
        );

        return jsonWithRequestId(
            requestContext,
            {
                error:
                    "Não foi possível atualizar a assinatura no Mercado Pago.",
                code: "SUBSCRIPTION_MANAGE_FAILED",
            },
            { status: 502 },
        );
    }
}
