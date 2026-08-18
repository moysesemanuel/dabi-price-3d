import type { BillingSubscriptionStatus } from "./types.ts";
import {
  getWorkspacePlan,
  type SubscriptionStatus,
  type WorkspacePlanId,
} from "../workspace/catalog.ts";

export type WorkspaceEntitlementAccessReason =
  | "active"
  | "grace_period"
  | "scheduled_cancel"
  | "pending"
  | "paused"
  | "expired"
  | "canceled"
  | "no_subscription";

export type WorkspaceEntitlementStatus =
  | BillingSubscriptionStatus
  | SubscriptionStatus
  | null
  | undefined;

export type WorkspaceEntitlementSubscription = {
  planId?: WorkspacePlanId | null;
  status?: WorkspaceEntitlementStatus;
  accessUntil?: string | null;
  currentPeriodEnd?: string | null;
  gracePeriodEndsAt?: string | null;
};

export type WorkspaceEntitlements = {
  canUseApp: boolean;
  canUsePricing: boolean;
  canExportPdf: boolean;
  canViewHistory: boolean;
  canManageIntegrations: boolean;
  historyLimit: number;
  seatsLimit: number;
  canManageBilling: boolean;
  accessReason: WorkspaceEntitlementAccessReason;
};

export function resolveWorkspaceEntitlements(input: {
  subscription?: WorkspaceEntitlementSubscription | null;
  now?: Date;
}): WorkspaceEntitlements {
  const subscription = input.subscription ?? null;
  const accessReason = resolveWorkspaceEntitlementAccessReason({
    subscription,
    now: input.now,
  });
  const plan = getWorkspacePlan(resolveHistoryLimitPlanId(subscription ?? {}));
  const canUseApp =
    accessReason === "active" ||
    accessReason === "grace_period" ||
    accessReason === "scheduled_cancel";

  return {
    canUseApp,
    canUsePricing: canUseApp,
    canExportPdf: canUseApp,
    canViewHistory: canUseApp,
    canManageIntegrations:
      canUseApp && (plan.erpSyncEnabled || plan.marketplaceAutomationEnabled),
    historyLimit: plan.historyLimit,
    seatsLimit: plan.seatsIncluded,
    canManageBilling: true,
    accessReason,
  };
}

export function resolveWorkspaceEntitlementAccessReason(input: {
  subscription?: WorkspaceEntitlementSubscription | null;
  now?: Date;
}): WorkspaceEntitlementAccessReason {
  const subscription = input.subscription ?? null;
  const status = subscription?.status ?? null;
  const now = input.now ?? new Date();

  if (hasFutureDate(subscription?.accessUntil, now)) {
    if (status === "past_due") {
      return "grace_period";
    }

    if (status === "scheduled_cancel") {
      return "scheduled_cancel";
    }

    return "active";
  }

  switch (status) {
    case "active":
      return "active";
    case "past_due":
      return hasFutureDate(
        subscription?.gracePeriodEndsAt ?? subscription?.currentPeriodEnd ?? null,
        now,
      )
        ? "grace_period"
        : "expired";
    case "scheduled_cancel":
      return hasFutureDate(subscription?.currentPeriodEnd ?? null, now)
        ? "scheduled_cancel"
        : "canceled";
    case "pending":
      return "pending";
    case "paused":
      return "paused";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    case "unpaid":
    case null:
    case undefined:
      return "no_subscription";
    default:
      return "no_subscription";
  }
}

export function getEntitlementAccessBlockedMessage(
  accessReason: WorkspaceEntitlementAccessReason,
) {
  switch (accessReason) {
    case "no_subscription":
      return "Este workspace ainda não possui uma assinatura ativa. Contrate um plano para liberar esta funcionalidade.";
    case "pending":
      return "A assinatura está aguardando confirmação de pagamento. O acesso será liberado assim que a cobrança for confirmada.";
    case "paused":
      return "A assinatura está pausada. Reative o plano para voltar a usar esta funcionalidade.";
    case "expired":
      return "A assinatura expirou. Contrate ou reative um plano para voltar a usar esta funcionalidade.";
    case "canceled":
      return "A assinatura está cancelada. Contrate um plano para voltar a usar esta funcionalidade.";
    case "active":
    case "grace_period":
    case "scheduled_cancel":
      return null;
  }
}

export function resolveHistoryLimitPlanId(
  subscription: Pick<WorkspaceEntitlementSubscription, "planId" | "status">,
) {
  if (
    subscription.status === "unpaid" ||
    subscription.status === "pending" ||
    !subscription.planId
  ) {
    return "starter";
  }

  return subscription.planId;
}

function hasFutureDate(value: string | null | undefined, now: Date) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return timestamp > now.getTime();
}
