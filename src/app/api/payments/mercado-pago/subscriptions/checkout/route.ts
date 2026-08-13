import {
    canManageWorkspaceBilling,
} from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
    createMercadoPagoSubscriptionCheckout,
    getMercadoPagoAccessToken,
} from "@/lib/payments/mercado-pago";
import {
    createRouteRequestContext,
    jsonWithRequestId,
    logRouteEvent,
    serializeError,
} from "@/lib/server/route-observability";
import {
    workspacePlans,
    type WorkspacePlanId,
} from "@/lib/settings/app-preferences";
import {
    applyWorkspaceSubscriptionUpdate, claimWorkspaceSubscriptionCheckout, getWorkspacePreferences, releaseWorkspaceSubscriptionCheckout,
} from "@/lib/server/platform";

type CheckoutSubscriptionPayload = {
    planId?: string;
};

export async function POST(request: Request) {
    const requestContext = createRouteRequestContext(
        request,
        "/api/payments/mercado-pago/subscriptions/checkout",
    );

    let session;

    try {
        session = await requireCurrentAuthSession();
    } catch (error) {
        if (isAuthenticationRequiredError(error)) {
            return jsonWithRequestId(
                requestContext,
                {
                    error: "Faça login para contratar um plano.",
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
                error: "Apenas o proprietário do workspace pode alterar a assinatura.",
                code: "BILLING_FORBIDDEN",
            },
            { status: 403 },
        );
    }

    let body: CheckoutSubscriptionPayload;

    try {
        body = (await request.json()) as CheckoutSubscriptionPayload;
    } catch {
        return jsonWithRequestId(
            requestContext,
            {
                error: "Payload inválido.",
                code: "SUBSCRIPTION_CHECKOUT_INVALID_JSON",
            },
            { status: 400 },
        );
    }

    const planId = normalizePlanId(body.planId);

    if (!planId) {
        return jsonWithRequestId(
            requestContext,
            {
                error: "Informe um plano válido.",
                code: "SUBSCRIPTION_CHECKOUT_INVALID_PLAN",
            },
            { status: 400 },
        );
    }

    const selectedPlan = workspacePlans.find((plan) => plan.id === planId);

    if (!selectedPlan) {
        return jsonWithRequestId(
            requestContext,
            {
                error: "Plano não encontrado.",
                code: "SUBSCRIPTION_CHECKOUT_PLAN_NOT_FOUND",
            },
            { status: 404 },
        );
    }

    if (planId === "scale") {
        return jsonWithRequestId(
            requestContext,
            {
                error:
                    "O plano DaBi Equipe possui contratação consultiva e não pode ser assinado diretamente pelo checkout.",
                code: "SUBSCRIPTION_CHECKOUT_CONSULTATIVE_PLAN",
            },
            { status: 409 },
        );
    }

    const currentPreferences = await getWorkspacePreferences(session.workspace.id);

    const currentSubscription = currentPreferences.subscription;

    if (
        currentSubscription.mercadoPagoSubscriptionId &&
        (currentSubscription.status === "pending" ||
            currentSubscription.status === "active" ||
            currentSubscription.status === "paused")
    ) {
        const subscriptionConflict =
            currentSubscription.status === "active"
                ? {
                    error: "Este workspace já possui uma assinatura ativa.",
                    code: "SUBSCRIPTION_ALREADY_ACTIVE",
                }
                : currentSubscription.status === "paused"
                    ? {
                        error:
                            "Este workspace possui uma assinatura pausada. Reative ou cancele a assinatura atual antes de contratar outra.",
                        code: "SUBSCRIPTION_ALREADY_PAUSED",
                    }
                    : {
                        error:
                            "Este workspace já possui uma assinatura aguardando confirmação.",
                        code: "SUBSCRIPTION_ALREADY_PENDING",
                    };

        return jsonWithRequestId(
            requestContext,
            subscriptionConflict,
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

    const checkoutClaim = await claimWorkspaceSubscriptionCheckout({
        workspaceId: session.workspace.id,
        startedAt: new Date().toISOString(),
    });

    if (!checkoutClaim.claimed) {
        return jsonWithRequestId(
            requestContext,
            {
                error:
                    "Já existe uma tentativa de contratação em andamento para este workspace.",
                code: "SUBSCRIPTION_CHECKOUT_ALREADY_IN_PROGRESS",
            },
            { status: 409 },
        );
    }

    const appBaseUrl = new URL(request.url).origin;
    const backUrl = new URL("/app/planos", appBaseUrl);

    backUrl.searchParams.set("origin", "mercado-pago");
    backUrl.searchParams.set("plan", planId);

    try {
        const subscription = await createMercadoPagoSubscriptionCheckout({
            planId,
            payerEmail: session.user.email,
            workspaceId: session.workspace.id,
            reason: `${selectedPlan.label} - ${session.workspace.name}`,
            backUrl: backUrl.toString(),
        });

        if (!subscription.init_point) {
            await releaseWorkspaceSubscriptionCheckout({
                workspaceId: session.workspace.id,
            });

            return jsonWithRequestId(
                requestContext,
                {
                    error:
                        "O Mercado Pago criou a assinatura, mas não retornou a URL de checkout.",
                    code: "SUBSCRIPTION_CHECKOUT_MISSING_INIT_POINT",
                },
                { status: 502 },
            );
        }

        await applyWorkspaceSubscriptionUpdate({
            workspaceId: session.workspace.id,
            planId,
            status: "pending",
            source: "mercado-pago-checkout",
            mercadoPagoSubscriptionId: subscription.id,
            description: `Checkout da assinatura ${selectedPlan.label} criado no Mercado Pago e aguardando confirmação.`,
        });

        logRouteEvent(
            requestContext,
            "info",
            "mercado_pago_subscription_checkout_created",
            {
                workspaceId: session.workspace.id,
                userId: session.user.id,
                planId,
                subscriptionId: subscription.id,
                accessTokenSource: "production",
            },
        );

        return jsonWithRequestId(requestContext, {
            ok: true,
            planId,
            subscriptionId: subscription.id,
            initPoint: subscription.init_point,
        });
    } catch (error) {
        await releaseWorkspaceSubscriptionCheckout({
            workspaceId: session.workspace.id,
        });

        logRouteEvent(
            requestContext,
            "error",
            "mercado_pago_subscription_checkout_failed",
            {
                workspaceId: session.workspace.id,
                userId: session.user.id,
                planId,
                error: serializeError(error),
            },
        );

        return jsonWithRequestId(
            requestContext,
            {
                error: "Não foi possível iniciar a assinatura no Mercado Pago.",
                code: "SUBSCRIPTION_CHECKOUT_CREATE_FAILED",
            },
            { status: 502 },
        );
    }
}

function normalizePlanId(value?: string): WorkspacePlanId | null {
    if (!value) {
        return null;
    }

    return workspacePlans.some((plan) => plan.id === value)
        ? (value as WorkspacePlanId)
        : null;
}

function isAuthenticationRequiredError(error: unknown) {
    return (
        error instanceof Error &&
        error.message === "AUTHENTICATION_REQUIRED"
    );
}