import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getBillingProvider } from "@/lib/billing/providers";
import {
  createBillingInvoice,
  findActiveBillingPrice,
  findCurrentBillingSubscriptionForWorkspace,
  findLatestPendingBillingInvoiceForSubscription,
  updateBillingInvoice,
} from "@/lib/billing/repository";
import { createBillingService } from "@/lib/billing/server-service";
import { normalizeBillingManualPaymentState } from "@/lib/billing/manual-payment-status";
import type { BillingSubscription } from "@/lib/billing/types";
import { isMercadoPagoApiError } from "@/lib/payments/mercado-pago";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import {
  applyWorkspaceSubscriptionUpdate,
  claimWorkspaceSubscriptionCheckout,
  getWorkspacePreferences,
  releaseWorkspaceSubscriptionCheckout,
  type AuthenticatedWorkspaceSession,
} from "@/lib/server/platform";
import {
  workspacePlans,
  type WorkspacePlanId,
} from "@/lib/settings/app-preferences";

type CheckoutPixPayload = {
  planId?: string;
};

type WorkspacePreferencesSubscription =
  Awaited<ReturnType<typeof getWorkspacePreferences>>["subscription"];

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/billing/checkout/pix",
  );

  let session: AuthenticatedWorkspaceSession;

  try {
    session = await requireCurrentAuthSession();
  } catch (error) {
    if (isAuthenticationRequiredError(error)) {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para gerar o Pix da assinatura.",
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

  let body: CheckoutPixPayload;

  try {
    body = (await request.json()) as CheckoutPixPayload;
  } catch {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Payload inválido.",
        code: "PIX_CHECKOUT_INVALID_JSON",
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
        code: "PIX_CHECKOUT_INVALID_PLAN",
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
        code: "PIX_CHECKOUT_PLAN_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  if (planId === "scale") {
    return jsonWithRequestId(
      requestContext,
      {
        error:
          "O plano DaBi Equipe possui contratação consultiva e não pode ser gerado por Pix direto.",
        code: "PIX_CHECKOUT_CONSULTATIVE_PLAN",
      },
      { status: 409 },
    );
  }

  const currentPreferences = await getWorkspacePreferences(session.workspace.id);
  const currentBillingSubscription =
    await findCurrentBillingSubscriptionForWorkspace(session.workspace.id);

  if (
    isActiveLikeSubscription(
      currentBillingSubscription,
      currentPreferences.subscription,
    )
  ) {
    return buildActiveSubscriptionConflict(requestContext);
  }

  if (
    isPausedSubscription(
      currentBillingSubscription,
      currentPreferences.subscription,
    )
  ) {
    return buildPausedSubscriptionConflict(requestContext);
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
        code: "PIX_CHECKOUT_ALREADY_IN_PROGRESS",
      },
      { status: 409 },
    );
  }

  const provider = getBillingProvider("mercado_pago");
  const billingService = createBillingService();
  let shouldReleaseClaim = true;
  let createdSubscriptionId: string | null = null;
  let createdInvoiceId: string | null = null;

  try {
    const resumablePix = await resolveExistingPendingPix({
      session,
      currentBillingSubscription,
      selectedPlanId: planId,
      provider,
    });

    if (resumablePix) {
      shouldReleaseClaim = false;

      return jsonWithRequestId(requestContext, {
        ok: true,
        resumed: true,
        planId,
        invoiceId: resumablePix.invoiceId,
        paymentId: resumablePix.paymentId,
        redirectTo: `/app/checkout?plan=${planId}&method=pix_manual`,
      });
    }

    await replaceCurrentPendingState({
      session,
      currentBillingSubscription,
      currentLegacySubscription: currentPreferences.subscription,
      provider,
      billingService,
    });

    const price = await findActiveBillingPrice({
      planId,
      billingCycle: "monthly",
    });

    if (!price) {
      return jsonWithRequestId(
        requestContext,
        {
          error:
            "Não existe um preço ativo configurado para este plano no billing atual.",
          code: "PIX_CHECKOUT_PRICE_NOT_FOUND",
        },
        { status: 503 },
      );
    }

    const localSubscription = await billingService.createSubscription({
      workspaceId: session.workspace.id,
      planId,
      billingCycle: "monthly",
      priceId: price.id,
      autoRenew: false,
      provider: "mercado_pago",
    });
    createdSubscriptionId = localSubscription.id;

    const invoice = await createBillingInvoice({
      subscriptionId: localSubscription.id,
      workspaceId: session.workspace.id,
      priceId: price.id,
      type: "subscription",
      status: "pending",
      amountCents: price.amountCents,
      currency: price.currency,
      paymentMethod: "pix_manual",
      provider: "mercado_pago",
    });

    if (!invoice) {
      throw new Error("Failed to create billing invoice for Pix checkout.");
    }

    createdInvoiceId = invoice.id;

    const payment = await provider.createManualPayment({
      externalReference: `billing_invoice:${invoice.id}`,
      payerEmail: session.user.email,
      reason: `${selectedPlan.label} - ${session.workspace.name}`,
      amountCents: price.amountCents,
      currency: price.currency,
      returnUrl: new URL("/app/checkout", request.url).toString(),
    });

    if (!payment.providerPaymentId || !payment.qrCode) {
      throw new Error("Manual Pix payment was created without QR code data.");
    }

    const updatedInvoice = await updateBillingInvoice(invoice.id, {
      providerPaymentId: payment.providerPaymentId,
      providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
      paymentExpiresAt: payment.expiresAt ?? null,
      paymentMethod: payment.paymentMethod ?? "pix_manual",
      provider: payment.provider,
    });

    if (!updatedInvoice) {
      throw new Error("Failed to update billing invoice with Pix payment data.");
    }

    await applyWorkspaceSubscriptionUpdate({
      workspaceId: session.workspace.id,
      planId,
      status: "pending",
      source: "billing-pix-checkout",
      mercadoPagoSubscriptionId: null,
      description: `Checkout manual via Pix criado para ${selectedPlan.label} e aguardando pagamento.`,
    });
    shouldReleaseClaim = false;

    logRouteEvent(requestContext, "info", "billing_pix_checkout.created", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      subscriptionId: localSubscription.id,
      invoiceId: updatedInvoice.id,
      paymentId: updatedInvoice.providerPaymentId,
    });

    return jsonWithRequestId(requestContext, {
      ok: true,
      planId,
      subscriptionId: localSubscription.id,
      invoiceId: updatedInvoice.id,
      paymentId: updatedInvoice.providerPaymentId,
      redirectTo: `/app/checkout?plan=${planId}&method=pix_manual`,
    });
  } catch (error) {
    if (createdInvoiceId) {
      await updateBillingInvoice(createdInvoiceId, {
        status: "canceled",
      }).catch(() => null);
    }

    if (createdSubscriptionId) {
      await billingService
        .finalizeCancellation(createdSubscriptionId, {
          actorType: "system",
        })
        .catch(() => null);
    }

    logRouteEvent(requestContext, "error", "billing_pix_checkout.failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      error: serializeError(error),
    });

    return jsonWithRequestId(
      requestContext,
      {
        error: "Não foi possível gerar o Pix da assinatura.",
        code: "PIX_CHECKOUT_CREATE_FAILED",
      },
      { status: 502 },
    );
  } finally {
    if (shouldReleaseClaim) {
      await releaseWorkspaceSubscriptionCheckout({
        workspaceId: session.workspace.id,
      });
    }
  }
}

async function resolveExistingPendingPix(input: {
  session: AuthenticatedWorkspaceSession;
  currentBillingSubscription: BillingSubscription | null;
  selectedPlanId: WorkspacePlanId;
  provider: ReturnType<typeof getBillingProvider>;
}) {
  if (
    !input.currentBillingSubscription ||
    input.currentBillingSubscription.status !== "pending" ||
    input.currentBillingSubscription.planId !== input.selectedPlanId
  ) {
    return null;
  }

  const pendingInvoice = await findLatestPendingBillingInvoiceForSubscription({
    subscriptionId: input.currentBillingSubscription.id,
    paymentMethod: "pix_manual",
  });

  if (!pendingInvoice?.providerPaymentId) {
    return null;
  }

  const payment = await input.provider.getManualPayment(
    pendingInvoice.providerPaymentId,
  );
  const paymentState = normalizeBillingManualPaymentState(payment.status);

  if (paymentState !== "pending") {
    return null;
  }

  return {
    invoiceId: pendingInvoice.id,
    paymentId: pendingInvoice.providerPaymentId,
  };
}

async function replaceCurrentPendingState(input: {
  session: AuthenticatedWorkspaceSession;
  currentBillingSubscription: BillingSubscription | null;
  currentLegacySubscription: WorkspacePreferencesSubscription;
  provider: ReturnType<typeof getBillingProvider>;
  billingService: ReturnType<typeof createBillingService>;
}) {
  if (input.currentBillingSubscription?.status === "pending") {
    if (input.currentBillingSubscription.providerSubscriptionId) {
      try {
        await input.provider.cancelSubscription(
          input.currentBillingSubscription.providerSubscriptionId,
        );
      } catch (error) {
        if (!(isMercadoPagoApiError(error) && error.status === 404)) {
          throw error;
        }
      }
    }

    const pendingInvoice = await findLatestPendingBillingInvoiceForSubscription({
      subscriptionId: input.currentBillingSubscription.id,
    });

    if (pendingInvoice) {
      await updateBillingInvoice(pendingInvoice.id, {
        status: "canceled",
      });
    }

    await input.billingService.finalizeCancellation(
      input.currentBillingSubscription.id,
      {
        actorType: "system",
      },
    );
  }

  if (
    input.currentLegacySubscription.status === "pending" &&
    input.currentLegacySubscription.mercadoPagoSubscriptionId
  ) {
    try {
      await input.provider.cancelSubscription(
        input.currentLegacySubscription.mercadoPagoSubscriptionId,
      );
    } catch (error) {
      if (!(isMercadoPagoApiError(error) && error.status === 404)) {
        throw error;
      }
    }
  }

  if (input.currentLegacySubscription.status === "pending") {
    await applyWorkspaceSubscriptionUpdate({
      workspaceId: input.session.workspace.id,
      planId: input.currentLegacySubscription.planId,
      status: "unpaid",
      source: "billing-pix-checkout-reset",
      mercadoPagoSubscriptionId: null,
      description:
        "A contratação pendente anterior foi encerrada para abrir um novo checkout manual via Pix.",
    });
  }
}

function isActiveLikeSubscription(
  currentBillingSubscription: BillingSubscription | null,
  currentLegacySubscription: WorkspacePreferencesSubscription,
) {
  const billingStatus = currentBillingSubscription?.status;

  if (
    billingStatus === "active" ||
    billingStatus === "past_due" ||
    billingStatus === "scheduled_cancel"
  ) {
    return true;
  }

  return currentLegacySubscription.status === "active";
}

function isPausedSubscription(
  currentBillingSubscription: BillingSubscription | null,
  currentLegacySubscription: WorkspacePreferencesSubscription,
) {
  return (
    currentBillingSubscription?.status === "paused" ||
    currentLegacySubscription.status === "paused"
  );
}

function buildActiveSubscriptionConflict(
  requestContext: ReturnType<typeof createRouteRequestContext>,
) {
  return jsonWithRequestId(
    requestContext,
    {
      error: "Este workspace já possui uma assinatura ativa.",
      code: "SUBSCRIPTION_ALREADY_ACTIVE",
      refresh: false,
    },
    { status: 409 },
  );
}

function buildPausedSubscriptionConflict(
  requestContext: ReturnType<typeof createRouteRequestContext>,
) {
  return jsonWithRequestId(
    requestContext,
    {
      error:
        "Este workspace possui uma assinatura pausada. Reative ou cancele a assinatura atual antes de contratar outra.",
      code: "SUBSCRIPTION_ALREADY_PAUSED",
      refresh: false,
    },
    { status: 409 },
  );
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
  return error instanceof Error && error.message === "AUTHENTICATION_REQUIRED";
}
