import {
  getEntitlementAccessBlockedMessage,
  resolveHistoryLimitPlanId as resolveEntitlementHistoryLimitPlanId,
  resolveWorkspaceEntitlementAccessReason,
  resolveWorkspaceEntitlements,
  type WorkspaceEntitlementAccessReason,
} from "../billing/entitlement-service.ts";
import type { SubscriptionStatus, WorkspaceSubscription } from "./catalog.ts";

type SubscriptionLike = Pick<WorkspaceSubscription, "status">;

const ALLOWED_APP_PATHS_WITHOUT_PAID_ACCESS = new Set([
  "/app/onboarding",
  "/app/checkout",
  "/app/planos",
  "/app/perfil-empresa",
  "/app/conta",
  "/app/assinatura",
]);
const ALLOWED_APP_PREFIXES_WITHOUT_PAID_ACCESS = ["/app/assinatura/"];

const ALLOWED_API_PATHS_WITHOUT_PAID_ACCESS = new Set([
  "/api/auth/logout",
  "/api/auth/session",
  "/api/billing/checkout/pix",
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
    case "unpaid":
      return "Aguardando contratação";
    case "pending":
      return "Aguardando pagamento";
    case "active":
      return "Plano ativo";
    case "past_due":
      return "Pagamento em atraso";
    case "scheduled_cancel":
      return "Cancelamento agendado";
    case "paused":
      return "Assinatura pausada";
    case "canceled":
      return "Assinatura cancelada";
    case "expired":
      return "Assinatura expirada";
  }
}

export function getWorkspaceAccessBlockedMessage(
  accessReason: WorkspaceEntitlementAccessReason,
) {
  return getEntitlementAccessBlockedMessage(accessReason);
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
  accessReason: WorkspaceEntitlementAccessReason;
}) {
  if (!input.onboardingCompleted) {
    return "/app/onboarding";
  }

  if (input.accessReason === "pending") {
    return "/app/checkout";
  }

  if (
    input.accessReason === "paused" ||
    input.accessReason === "canceled" ||
    input.accessReason === "expired"
  ) {
    return "/app/assinatura";
  }

  return (
    input.accessReason === "super_admin" ||
    input.accessReason === "active" ||
    input.accessReason === "grace_period" ||
    input.accessReason === "scheduled_cancel"
  )
    ? "/app/precificacao"
    : "/app/planos";
}

export function resolveHistoryLimitPlanId(subscription: Pick<WorkspaceSubscription, "planId" | "status">) {
  return resolveEntitlementHistoryLimitPlanId(subscription);
}

export function resolveWorkspaceAccessReason(
  subscription: SubscriptionStatus | WorkspaceSubscription,
) {
  return resolveWorkspaceEntitlementAccessReason({
    subscription:
      typeof subscription === "string"
        ? {
            planId: "starter",
            status: subscription,
          }
        : subscription,
  });
}
