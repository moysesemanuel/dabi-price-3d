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
import { canIgnorePendingSubscriptionCancellationError } from "@/lib/payments/mercado-pago";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";
import {
  applyWorkspaceSubscriptionUpdate,
  claimWorkspaceSubscriptionCheckout,
  releaseWorkspaceSubscriptionCheckout,
  type AuthenticatedWorkspaceSession,
} from "@/lib/server/platform";
import {
  workspacePlans,
  type WorkspacePlanId,
} from "@/lib/settings/app-preferences";

type CheckoutPixPayload = {
  planId?: string;
  billingCycle?: string;
};

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
  const billingCycle = normalizeBillingCycle(body.billingCycle);

  if (!planId || !billingCycle) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Informe um plano e um ciclo válidos.",
        code: "PIX_CHECKOUT_INVALID_INPUT",
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

  const currentBillingSubscription =
    await findCurrentBillingSubscriptionForWorkspace(session.workspace.id);

  if (isActiveLikeSubscription(currentBillingSubscription)) {
    return buildActiveSubscriptionConflict(requestContext);
  }

  if (isPausedSubscription(currentBillingSubscription)) {
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
      selectedBillingCycle: billingCycle,
      provider,
    });

    if (resumablePix) {
      shouldReleaseClaim = false;

      return jsonWithRequestId(requestContext, {
        ok: true,
        resumed: true,
        planId,
        billingCycle,
        invoiceId: resumablePix.invoiceId,
        paymentId: resumablePix.paymentId,
        redirectTo: `/app/checkout?plan=${planId}&billingCycle=${billingCycle}&method=pix_manual`,
      });
    }

    await replaceCurrentPendingState({
      session,
      currentBillingSubscription,
      provider,
      billingService,
    });

    const price = await findActiveBillingPrice({
      planId,
      billingCycle,
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
      billingCycle,
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
      idempotencyKey: invoice.id,
      payerEmail: session.user.email,
      reason: `${selectedPlan.label} - ${session.workspace.name}`,
      amountCents: price.amountCents,
      currency: price.currency,
      returnUrl: new URL("/app/checkout", request.url).toString(),
      notificationUrl: new URL(
        "/api/payments/mercado-pago/webhook?source_news=webhooks",
        request.url,
      ).toString(),
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
      billingCycle,
      source: "billing-pix-checkout",
      mercadoPagoSubscriptionId: null,
      description: `Checkout manual via Pix criado para ${selectedPlan.label} (${billingCycle === "annual" ? "anual" : "mensal"}) e aguardando pagamento.`,
    });
    shouldReleaseClaim = false;

    logRouteEvent(requestContext, "info", "billing_pix_checkout.created", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      planId,
      billingCycle,
      subscriptionId: localSubscription.id,
      invoiceId: updatedInvoice.id,
      paymentId: updatedInvoice.providerPaymentId,
    });

    return jsonWithRequestId(requestContext, {
      ok: true,
      planId,
      billingCycle,
      subscriptionId: localSubscription.id,
      invoiceId: updatedInvoice.id,
      paymentId: updatedInvoice.providerPaymentId,
      redirectTo: `/app/checkout?plan=${planId}&billingCycle=${billingCycle}&method=pix_manual`,
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
      billingCycle,
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
  selectedBillingCycle: BillingSubscription["billingCycle"];
  provider: ReturnType<typeof getBillingProvider>;
}) {
  if (
    !input.currentBillingSubscription ||
    input.currentBillingSubscription.status !== "pending" ||
    input.currentBillingSubscription.planId !== input.selectedPlanId ||
    input.currentBillingSubscription.billingCycle !== input.selectedBillingCycle
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
        if (
          !canIgnorePendingSubscriptionCancellationError(
            input.currentBillingSubscription.status,
            error,
          )
        ) {
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
}

function isActiveLikeSubscription(currentBillingSubscription: BillingSubscription | null) {
  const billingStatus = currentBillingSubscription?.status;

  if (
    billingStatus === "active" ||
    billingStatus === "past_due" ||
    billingStatus === "scheduled_cancel"
  ) {
    return true;
  }

  return false;
}

function isPausedSubscription(currentBillingSubscription: BillingSubscription | null) {
  return currentBillingSubscription?.status === "paused";
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

function normalizeBillingCycle(
  value?: string,
): BillingSubscription["billingCycle"] | null {
  return value === "annual" || value === "monthly" ? value : null;
}

function isAuthenticationRequiredError(error: unknown) {
  return error instanceof Error && error.message === "AUTHENTICATION_REQUIRED";
}
