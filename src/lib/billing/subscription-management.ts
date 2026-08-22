import type { BillingProvider } from "./providers/billing-provider.ts";
import type { BillingService } from "./service.ts";
import type { BillingAuditActorType, BillingSubscription } from "./types.ts";

export type ManageBillingSubscriptionAction = "cancel" | "resume";

export class ManageBillingSubscriptionError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ManageBillingSubscriptionError";
    this.code = code;
    this.status = status;
  }
}

type ManagedBillingSubscription = Pick<
  BillingSubscription,
  | "id"
  | "workspaceId"
  | "planId"
  | "billingCycle"
  | "status"
  | "provider"
  | "providerSubscriptionId"
>;

type BillingSubscriptionManagerDependencies = {
  provider: Pick<BillingProvider, "cancelSubscription" | "resumeSubscription">;
  billingService: Pick<BillingService, "scheduleCancellation" | "revertCancellation">;
  applyWorkspaceSubscriptionUpdate(input: {
    workspaceId: string;
    planId: BillingSubscription["planId"];
    billingCycle?: BillingSubscription["billingCycle"];
    status: "active" | "canceled";
    source: string;
    mercadoPagoSubscriptionId?: string | null;
    description?: string | null;
  }): Promise<unknown>;
};

export async function manageMercadoPagoBillingSubscription(input: {
  action: ManageBillingSubscriptionAction;
  subscription: ManagedBillingSubscription;
  actorId: string;
  actorType?: BillingAuditActorType;
  dependencies: BillingSubscriptionManagerDependencies;
}) {
  const { action, subscription, actorId, dependencies } = input;
  const actorType = input.actorType ?? "user";

  if (
    subscription.provider !== "mercado_pago" ||
    !subscription.providerSubscriptionId
  ) {
    throw new ManageBillingSubscriptionError(
      "Este workspace não possui uma assinatura do Mercado Pago.",
      "SUBSCRIPTION_NOT_FOUND",
      404,
    );
  }

  if (!canManageBillingSubscriptionAction(action, subscription.status)) {
    throw new ManageBillingSubscriptionError(
      `A ação ${action} não é permitida para uma assinatura com status ${subscription.status}.`,
      "SUBSCRIPTION_MANAGE_INVALID_STATE",
      409,
    );
  }

  const providerSubscription =
    action === "cancel"
      ? await dependencies.provider.cancelSubscription(
          subscription.providerSubscriptionId,
        )
      : await dependencies.provider.resumeSubscription(
          subscription.providerSubscriptionId,
        );

  const localSubscription =
    action === "cancel"
      ? await dependencies.billingService.scheduleCancellation(subscription.id, {
          actorType,
          actorId,
        })
      : await dependencies.billingService.revertCancellation(subscription.id, {
          actorType,
          actorId,
        });

  await dependencies.applyWorkspaceSubscriptionUpdate({
    workspaceId: subscription.workspaceId,
    planId: localSubscription.planId,
    billingCycle: localSubscription.billingCycle,
    status: action === "cancel" ? "canceled" : "active",
    source: "billing-subscription-manage",
    mercadoPagoSubscriptionId: subscription.providerSubscriptionId,
    description:
      action === "cancel"
        ? "Renovação da assinatura cancelada pelo workspace."
        : "Renovação da assinatura reativada pelo workspace.",
  });

  return {
    action,
    localSubscription,
    providerSubscription,
  };
}

export function canManageBillingSubscriptionAction(
  action: ManageBillingSubscriptionAction,
  status: BillingSubscription["status"],
) {
  if (action === "cancel") {
    return status === "active";
  }

  return status === "scheduled_cancel";
}
