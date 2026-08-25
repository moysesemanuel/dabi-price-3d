import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  RequestBillingCycleChangeError,
  requestMonthlyToAnnualCycleChange,
} from "@/lib/billing/cycle-change-management";
import { runBillingCycleChangePixOperation } from "@/lib/billing/cycle-change-pix-operation";
import { normalizeBillingManualPaymentState } from "@/lib/billing/manual-payment-status";
import { getBillingProvider } from "@/lib/billing/providers";
import {
  findActiveBillingPrice,
  findCurrentBillingSubscriptionForWorkspace,
  findLatestOpenBillingSubscriptionChange,
  findLatestPendingBillingInvoiceForSubscription,
  getBillingPriceById,
  updateBillingInvoice,
  updateBillingSubscriptionChange,
} from "@/lib/billing/repository";
import { createBillingService } from "@/lib/billing/server-service";
import { runWithServerBillingSubscriptionOperationClaim } from "@/lib/billing/server-subscription-operation-claim";
import { BillingSubscriptionOperationInProgressError } from "@/lib/billing/subscription-operation-claim";
import type {
  BillingSubscription,
  BillingSubscriptionChange,
} from "@/lib/billing/types";
import {
  createRouteRequestContext,
  jsonWithRequestId,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/billing/subscriptions/cycle-change/pix",
  );

  const session = await requireSession(requestContext);

  if (session instanceof Response) {
    return session;
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

  const subscription = await findCurrentBillingSubscriptionForWorkspace(
    session.workspace.id,
  );

  if (!subscription) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Este workspace não possui uma assinatura corrente para mudar o ciclo.",
        code: "CYCLE_CHANGE_SUBSCRIPTION_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const provider = getBillingProvider("mercado_pago");
  let createdChangeId: string | null = null;
  let createdInvoiceId: string | null = null;
  let providerPaymentCreated = false;

  try {
    return await runBillingCycleChangePixOperation({
      subscription,
      getCurrentSubscription: () =>
        findCurrentBillingSubscriptionForWorkspace(session.workspace.id),
      runWithSubscriptionOperation:
        runWithServerBillingSubscriptionOperationClaim,
      operation: async (currentSubscription) => {

        const nowIso = new Date().toISOString();
        const currentPrice = await resolveCurrentSubscriptionPrice(
          currentSubscription,
          nowIso,
        );
        const targetAnnualPrice = await findActiveBillingPrice({
          planId: currentSubscription.planId,
          billingCycle: "annual",
          asOf: nowIso,
        });

        if (!currentPrice || !targetAnnualPrice) {
          throw new RequestBillingCycleChangeError(
            "Não foi possível localizar os preços necessários para a mudança anual.",
            "CYCLE_CHANGE_PRICE_NOT_FOUND",
            503,
          );
        }

        const openChange = await findLatestOpenBillingSubscriptionChange({
          subscriptionId: currentSubscription.id,
          type: "cycle_change",
        });
        const resumableChange = await resolveExistingPendingCycleChangePix({
          subscription: currentSubscription,
          openChange,
          provider,
          payerEmail: session.user.email,
          workspaceName: session.workspace.name,
          requestUrl: request.url,
        });

        if (resumableChange) {
          return jsonWithRequestId(requestContext, {
            ok: true,
            resumed: true,
            subscriptionId: currentSubscription.id,
            changeId: resumableChange.changeId,
            invoiceId: resumableChange.invoiceId,
            paymentId: resumableChange.paymentId,
            redirectTo: "/app/planos",
          });
        }

        if (openChange?.invoiceId) {
          await updateBillingInvoice(openChange.invoiceId, { status: "canceled" });
        }

        const cycleChange = await requestMonthlyToAnnualCycleChange({
          subscription: currentSubscription,
          currentPrice,
          targetAnnualPrice,
          actorId: session.user.id,
          asOf: nowIso,
          billingService: createBillingService(),
        });

        createdChangeId = cycleChange.change.id;
        createdInvoiceId = cycleChange.invoice.id;

        const payment = await provider.createManualPayment({
          externalReference: `billing_invoice:${cycleChange.invoice.id}`,
          idempotencyKey: cycleChange.invoice.id,
          payerEmail: session.user.email,
          reason: `Mudança de ciclo mensal para anual - ${session.workspace.name}`,
          amountCents: cycleChange.invoice.amountCents,
          currency: cycleChange.invoice.currency,
          returnUrl: new URL("/app/planos", request.url).toString(),
          notificationUrl: new URL(
            "/api/payments/mercado-pago/webhook?source_news=webhooks",
            request.url,
          ).toString(),
        });

        if (!payment.providerPaymentId || !payment.qrCode) {
          throw new Error("Manual Pix payment was created without QR code data.");
        }
        providerPaymentCreated = true;

        const invoice = await updateBillingInvoice(cycleChange.invoice.id, {
          providerPaymentId: payment.providerPaymentId,
          providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
          paymentExpiresAt: payment.expiresAt ?? null,
          paymentMethod: payment.paymentMethod ?? "pix_manual",
          provider: payment.provider,
        });

        if (!invoice) {
          throw new Error("Failed to update cycle change invoice with Pix payment data.");
        }

        logRouteEvent(requestContext, "info", "billing_cycle_change_pix.created", {
          workspaceId: session.workspace.id,
          userId: session.user.id,
          subscriptionId: currentSubscription.id,
          changeId: cycleChange.change.id,
          invoiceId: invoice.id,
          amountCents: invoice.amountCents,
        });

        return jsonWithRequestId(requestContext, {
          ok: true,
          subscriptionId: currentSubscription.id,
          changeId: cycleChange.change.id,
          invoiceId: invoice.id,
          paymentId: invoice.providerPaymentId,
          redirectTo: "/app/planos",
        });
      },
    });
  } catch (error) {
    if (createdInvoiceId && !providerPaymentCreated) {
      await updateBillingInvoice(createdInvoiceId, { status: "canceled" }).catch(
        () => null,
      );
    }

    if (createdChangeId && !providerPaymentCreated) {
      await updateBillingSubscriptionChange(createdChangeId, {
        status: "failed",
      }).catch(() => null);
    }

    logRouteEvent(requestContext, "error", "billing_cycle_change_pix.failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      subscriptionId: subscription.id,
      error: serializeError(error),
    });

    if (error instanceof RequestBillingCycleChangeError) {
      return jsonWithRequestId(
        requestContext,
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    if (error instanceof BillingSubscriptionOperationInProgressError) {
      return jsonWithRequestId(
        requestContext,
        {
          error:
            "Uma atualização desta assinatura já está em andamento. Aguarde alguns segundos e tente novamente.",
          code: "SUBSCRIPTION_OPERATION_IN_PROGRESS",
        },
        { status: 409 },
      );
    }

    return jsonWithRequestId(
      requestContext,
      {
        error: "Não foi possível gerar o Pix da mudança de ciclo.",
        code: "CYCLE_CHANGE_PIX_CREATE_FAILED",
      },
      { status: 502 },
    );
  }
}

async function requireSession(requestContext: ReturnType<typeof createRouteRequestContext>) {
  try {
    return await requireCurrentAuthSession();
  } catch (error) {
    if (error instanceof Error && error.message === "AUTHENTICATION_REQUIRED") {
      return jsonWithRequestId(
        requestContext,
        {
          error: "Faça login para mudar o ciclo da assinatura.",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    throw error;
  }
}

async function resolveCurrentSubscriptionPrice(
  subscription: Pick<
    BillingSubscription,
    "priceId" | "planId" | "billingCycle" | "currentPeriodStart"
  >,
  asOf: string,
) {
  if (subscription.priceId) {
    const price = await getBillingPriceById(subscription.priceId);

    if (price) {
      return price;
    }
  }

  return findActiveBillingPrice({
    planId: subscription.planId,
    billingCycle: subscription.billingCycle,
    asOf: subscription.currentPeriodStart ?? asOf,
  });
}

async function resolveExistingPendingCycleChangePix(input: {
  subscription: BillingSubscription;
  openChange: BillingSubscriptionChange | null;
  provider: ReturnType<typeof getBillingProvider>;
  payerEmail: string;
  workspaceName: string;
  requestUrl: string;
}) {
  if (
    input.openChange?.status !== "pending_payment" ||
    input.openChange.toBillingCycle !== "annual"
  ) {
    return null;
  }

  const pendingInvoice = await findLatestPendingBillingInvoiceForSubscription({
    subscriptionId: input.subscription.id,
    paymentMethod: "pix_manual",
    type: "upgrade",
  });

  if (!pendingInvoice || pendingInvoice.id !== input.openChange.invoiceId) {
    return null;
  }

  if (!pendingInvoice.providerPaymentId) {
    const payment = await input.provider.createManualPayment({
      externalReference: `billing_invoice:${pendingInvoice.id}`,
      idempotencyKey: pendingInvoice.id,
      payerEmail: input.payerEmail,
      reason: `Mudança de ciclo mensal para anual - ${input.workspaceName}`,
      amountCents: pendingInvoice.amountCents,
      currency: pendingInvoice.currency,
      returnUrl: new URL("/app/planos", input.requestUrl).toString(),
      notificationUrl: new URL(
        "/api/payments/mercado-pago/webhook?source_news=webhooks",
        input.requestUrl,
      ).toString(),
    });

    if (!payment.providerPaymentId || !payment.qrCode) {
      throw new Error("Manual Pix payment was created without QR code data.");
    }

    const updatedInvoice = await updateBillingInvoice(pendingInvoice.id, {
      providerPaymentId: payment.providerPaymentId,
      providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
      paymentExpiresAt: payment.expiresAt ?? null,
      paymentMethod: payment.paymentMethod ?? "pix_manual",
      provider: payment.provider,
    });

    if (!updatedInvoice) {
      throw new Error(
        "Failed to update cycle change invoice with Pix payment data.",
      );
    }

    return {
      changeId: input.openChange.id,
      invoiceId: updatedInvoice.id,
      paymentId: updatedInvoice.providerPaymentId,
    };
  }

  const payment = await input.provider.getManualPayment(
    pendingInvoice.providerPaymentId,
  );

  if (normalizeBillingManualPaymentState(payment.status) !== "pending") {
    return null;
  }

  return {
    changeId: input.openChange.id,
    invoiceId: pendingInvoice.id,
    paymentId: pendingInvoice.providerPaymentId,
  };
}
