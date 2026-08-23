import { canManageWorkspaceBilling } from "@/lib/auth/access-control";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import {
  RequestBillingUpgradeError,
  requestBillingSubscriptionUpgrade,
} from "@/lib/billing/upgrade-management";
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
import { normalizeBillingManualPaymentState } from "@/lib/billing/manual-payment-status";
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
import { workspacePlans, type WorkspacePlanId } from "@/lib/settings/app-preferences";

type UpgradePixPayload = {
  planId?: string;
};

export async function POST(request: Request) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/billing/subscriptions/upgrade/pix",
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
          error: "Faça login para gerar o Pix do upgrade.",
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

  let body: UpgradePixPayload;

  try {
    body = (await request.json()) as UpgradePixPayload;
  } catch {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Payload inválido.",
        code: "UPGRADE_INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const targetPlanId = normalizeUpgradePlanId(body.planId);

  if (!targetPlanId) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Informe um plano válido para o upgrade.",
        code: "UPGRADE_INVALID_PLAN",
      },
      { status: 400 },
    );
  }

  const selectedPlan = workspacePlans.find((plan) => plan.id === targetPlanId);

  if (!selectedPlan) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Plano não encontrado.",
        code: "UPGRADE_PLAN_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const subscription = await findCurrentBillingSubscriptionForWorkspace(
    session.workspace.id,
  );

  if (!subscription) {
    return jsonWithRequestId(
      requestContext,
      {
        error: "Este workspace não possui uma assinatura corrente para upgrade.",
        code: "UPGRADE_SUBSCRIPTION_NOT_FOUND",
      },
      { status: 404 },
    );
  }

  const provider = getBillingProvider("mercado_pago");
  let createdInvoiceId: string | null = null;
  let createdChangeId: string | null = null;
  let providerPaymentCreated = false;

  try {
    return await runWithServerBillingSubscriptionOperationClaim(
      subscription.id,
      async () => {
        const currentSubscription =
          await findCurrentBillingSubscriptionForWorkspace(session.workspace.id);

        if (!currentSubscription || currentSubscription.id !== subscription.id) {
          throw new RequestBillingUpgradeError(
            "A assinatura foi alterada enquanto o upgrade estava sendo iniciado. Atualize a página e tente novamente.",
            "UPGRADE_SUBSCRIPTION_CHANGED_CONCURRENTLY",
            409,
          );
        }

        const nowIso = new Date().toISOString();
        const currentPrice = await resolveCurrentSubscriptionPrice(
          currentSubscription,
          nowIso,
        );

        if (!currentPrice) {
          throw new RequestBillingUpgradeError(
            "Não foi possível localizar o preço atual da assinatura para calcular o upgrade.",
            "UPGRADE_CURRENT_PRICE_NOT_FOUND",
            503,
          );
        }

        const targetPrice = await findActiveBillingPrice({
          planId: targetPlanId,
          billingCycle: currentSubscription.billingCycle,
          asOf: nowIso,
        });

        if (!targetPrice) {
          throw new RequestBillingUpgradeError(
            "O plano de destino ainda não possui um preço ativo configurado para upgrade automático.",
            "UPGRADE_TARGET_PRICE_NOT_FOUND",
            503,
          );
        }

        const openUpgrade = await findLatestOpenBillingSubscriptionChange({
          subscriptionId: currentSubscription.id,
          type: "upgrade",
        });

        const resumableUpgrade = await resolveExistingPendingUpgradePix({
          subscription: currentSubscription,
          openUpgrade,
          targetPlanId,
          provider,
          payerEmail: session.user.email,
          workspaceName: session.workspace.name,
          requestUrl: request.url,
        });

        if (resumableUpgrade) {
          return jsonWithRequestId(requestContext, {
            ok: true,
            resumed: true,
            subscriptionId: currentSubscription.id,
            changeId: resumableUpgrade.changeId,
            invoiceId: resumableUpgrade.invoiceId,
            paymentId: resumableUpgrade.paymentId,
            redirectTo: "/app/assinatura/upgrade",
          });
        }

        if (openUpgrade?.invoiceId) {
          await updateBillingInvoice(openUpgrade.invoiceId, {
            status: "canceled",
          });
        }

        const upgradeRequest = await requestBillingSubscriptionUpgrade({
          subscription: currentSubscription,
          currentPrice,
          targetPrice,
          actorId: session.user.id,
          asOf: nowIso,
          billingService: createBillingService(),
        });

        createdChangeId = upgradeRequest.change.id;
        createdInvoiceId = upgradeRequest.invoice.id;

        const payment = await provider.createManualPayment({
          externalReference: `billing_invoice:${upgradeRequest.invoice.id}`,
          idempotencyKey: upgradeRequest.invoice.id,
          payerEmail: session.user.email,
          reason: `Upgrade ${currentSubscription.planId} -> ${targetPlanId} - ${session.workspace.name}`,
          amountCents: upgradeRequest.invoice.amountCents,
          currency: upgradeRequest.invoice.currency,
          returnUrl: new URL("/app/assinatura/upgrade", request.url).toString(),
          notificationUrl: new URL(
            "/api/payments/mercado-pago/webhook?source_news=webhooks",
            request.url,
          ).toString(),
        });

        if (!payment.providerPaymentId || !payment.qrCode) {
          throw new Error("Manual Pix payment was created without QR code data.");
        }
        providerPaymentCreated = true;

        const updatedInvoice = await updateBillingInvoice(upgradeRequest.invoice.id, {
          providerPaymentId: payment.providerPaymentId,
          providerAuthorizedPaymentId: payment.providerAuthorizedPaymentId,
          paymentExpiresAt: payment.expiresAt ?? null,
          paymentMethod: payment.paymentMethod ?? "pix_manual",
          provider: payment.provider,
        });

        if (!updatedInvoice) {
          throw new Error("Failed to update upgrade invoice with Pix payment data.");
        }

        logRouteEvent(requestContext, "info", "billing_upgrade_pix.created", {
          workspaceId: session.workspace.id,
          userId: session.user.id,
          subscriptionId: currentSubscription.id,
          currentPlanId: currentSubscription.planId,
          targetPlanId,
          changeId: upgradeRequest.change.id,
          invoiceId: updatedInvoice.id,
          paymentId: updatedInvoice.providerPaymentId,
          amountCents: updatedInvoice.amountCents,
        });

        return jsonWithRequestId(requestContext, {
          ok: true,
          subscriptionId: currentSubscription.id,
          changeId: upgradeRequest.change.id,
          invoiceId: updatedInvoice.id,
          paymentId: updatedInvoice.providerPaymentId,
          redirectTo: "/app/assinatura/upgrade",
        });
      },
    );
  } catch (error) {
    if (createdInvoiceId && !providerPaymentCreated) {
      await updateBillingInvoice(createdInvoiceId, {
        status: "canceled",
      }).catch(() => null);
    }

    if (createdChangeId && !providerPaymentCreated) {
      await updateBillingSubscriptionChange(createdChangeId, {
        status: "failed",
      }).catch(() => null);
    }

    logRouteEvent(requestContext, "error", "billing_upgrade_pix.failed", {
      workspaceId: session.workspace.id,
      userId: session.user.id,
      subscriptionId: subscription.id,
      targetPlanId,
      error: serializeError(error),
    });

    if (error instanceof RequestBillingUpgradeError) {
      return jsonWithRequestId(
        requestContext,
        {
          error: error.message,
          code: error.code,
        },
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

    if (error instanceof Error) {
      return jsonWithRequestId(
        requestContext,
        {
          error: error.message,
          code: "UPGRADE_PIX_CREATE_FAILED",
        },
        { status: 409 },
      );
    }

    return jsonWithRequestId(
      requestContext,
      {
        error: "Não foi possível gerar o Pix do upgrade.",
        code: "UPGRADE_PIX_CREATE_FAILED",
      },
      { status: 502 },
    );
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
    const priceById = await getBillingPriceById(subscription.priceId);

    if (priceById) {
      return priceById;
    }
  }

  return findActiveBillingPrice({
    planId: subscription.planId,
    billingCycle: subscription.billingCycle,
    asOf: subscription.currentPeriodStart ?? asOf,
  });
}

async function resolveExistingPendingUpgradePix(input: {
  subscription: BillingSubscription;
  openUpgrade: BillingSubscriptionChange | null;
  targetPlanId: WorkspacePlanId;
  provider: ReturnType<typeof getBillingProvider>;
  payerEmail: string;
  workspaceName: string;
  requestUrl: string;
}) {
  if (
    !input.openUpgrade ||
    input.openUpgrade.status !== "pending_payment" ||
    input.openUpgrade.toPlanId !== input.targetPlanId
  ) {
    return null;
  }

  const pendingInvoice = await findLatestPendingBillingInvoiceForSubscription({
    subscriptionId: input.subscription.id,
    paymentMethod: "pix_manual",
    type: "upgrade",
  });

  if (!pendingInvoice || pendingInvoice.id !== input.openUpgrade.invoiceId) {
    return null;
  }

  if (!pendingInvoice.providerPaymentId) {
    const payment = await input.provider.createManualPayment({
      externalReference: `billing_invoice:${pendingInvoice.id}`,
      idempotencyKey: pendingInvoice.id,
      payerEmail: input.payerEmail,
      reason: `Upgrade ${input.subscription.planId} -> ${input.targetPlanId} - ${input.workspaceName}`,
      amountCents: pendingInvoice.amountCents,
      currency: pendingInvoice.currency,
      returnUrl: new URL("/app/assinatura/upgrade", input.requestUrl).toString(),
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
      throw new Error("Failed to update upgrade invoice with Pix payment data.");
    }

    return {
      changeId: input.openUpgrade.id,
      invoiceId: updatedInvoice.id,
      paymentId: updatedInvoice.providerPaymentId,
    };
  }

  const payment = await input.provider.getManualPayment(
    pendingInvoice.providerPaymentId,
  );
  const paymentState = normalizeBillingManualPaymentState(payment.status);

  if (paymentState !== "pending") {
    return null;
  }

  return {
    changeId: input.openUpgrade.id,
    invoiceId: pendingInvoice.id,
    paymentId: pendingInvoice.providerPaymentId,
  };
}

function normalizeUpgradePlanId(value: string | undefined): WorkspacePlanId | null {
  if (!value) {
    return null;
  }

  return workspacePlans.some((plan) => plan.id === value)
    ? (value as WorkspacePlanId)
    : null;
}
