import {
  getEntitlementAccessBlockedMessage,
  resolveHistoryLimitPlanId as resolveEntitlementHistoryLimitPlanId,
  resolveWorkspaceEntitlements,
  type WorkspaceEntitlementAccessReason,
} from "../billing/entitlement-service.ts";
import type { SubscriptionStatus, WorkspaceSubscription } from "./catalog.ts";

type SubscriptionLike = Pick<WorkspaceSubscription, "status">;

const ALLOWED_APP_PATHS_WITHOUT_PAID_ACCESS = new Set([
  "/app/onboarding",
  "/app/planos",
  "/app/perfil-empresa",
  "/app/conta",
  "/app/assinatura",
]);
const ALLOWED_APP_PREFIXES_WITHOUT_PAID_ACCESS = ["/app/assinatura/"];

const ALLOWED_API_PATHS_WITHOUT_PAID_ACCESS = new Set([
  "/api/auth/logout",
  "/api/auth/session",
  "/api/workspace/preferences",
  "/api/workspace/logo/upload",
]);

const ALLOWED_API_PREFIXES_WITHOUT_PAID_ACCESS = ["/api/payments/mercado-pago/"];

export function canAccessPaidWorkspaceFeatures(
  subscription: SubscriptionLike | SubscriptionStatus,
) {
  return resolveWorkspaceEntitlements({
    subscription:
      typeof subscription === "string"
        ? {
          planId: "starter",
          status: subscription,
        }
        : subscription,
  }).canUseApp;
}

export function getSubscriptionStatusLabel(status: SubscriptionStatus) {
  switch (status) {
    case "internal":
      return "Plano interno";
    case "unpaid":
      return "Aguardando contratação";
    case "trial":
      return "Período de avaliação";
    case "pending":
      return "Aguardando pagamento";
    case "active":
      return "Plano ativo";
    case "paused":
      return "Assinatura pausada";
    case "canceled":
      return "Assinatura cancelada";
  }
}

export function getWorkspaceAccessBlockedMessage(
  input: SubscriptionStatus | WorkspaceEntitlementAccessReason,
) {
  if (isWorkspaceEntitlementAccessReason(input)) {
    return getEntitlementAccessBlockedMessage(input);
  }

  return getEntitlementAccessBlockedMessage(
    resolveWorkspaceEntitlements({
      subscription: {
        planId: "starter",
        status: input,
      },
    }).accessReason,
  );
}

export function canAccessAppPathWithoutPaidWorkspace(pathname: string) {
  if (ALLOWED_APP_PATHS_WITHOUT_PAID_ACCESS.has(pathname)) {
    return true;
  }

  return ALLOWED_APP_PREFIXES_WITHOUT_PAID_ACCESS.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

export function canAccessApiPathWithoutPaidWorkspace(pathname: string) {
  if (ALLOWED_API_PATHS_WITHOUT_PAID_ACCESS.has(pathname)) {
    return true;
  }

  return ALLOWED_API_PREFIXES_WITHOUT_PAID_ACCESS.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

export function resolveDefaultWorkspaceAppPath(input: {
  onboardingCompleted: boolean;
  subscriptionStatus: SubscriptionStatus;
}) {
  if (!input.onboardingCompleted) {
    return "/app/onboarding";
  }

  return canAccessPaidWorkspaceFeatures(input.subscriptionStatus)
    ? "/app/precificacao"
    : "/app/planos";
}

export function resolveHistoryLimitPlanId(
  subscription: Pick<WorkspaceSubscription, "planId" | "status">,
) {
  return resolveEntitlementHistoryLimitPlanId(subscription);
}

function isWorkspaceEntitlementAccessReason(
  value: string,
): value is WorkspaceEntitlementAccessReason {
  return (
    value === "active" ||
    value === "grace_period" ||
    value === "scheduled_cancel" ||
    value === "pending" ||
    value === "paused" ||
    value === "expired" ||
    value === "canceled" ||
    value === "no_subscription"
  );
}
