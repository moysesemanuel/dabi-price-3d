import type { SubscriptionStatus, WorkspaceSubscription } from "./catalog.ts";

type SubscriptionLike = Pick<WorkspaceSubscription, "status">;

const ALLOWED_APP_PATHS_WITHOUT_PAID_ACCESS = new Set([
  "/app/onboarding",
  "/app/planos",
  "/app/perfil-empresa",
  "/app/conta",
]);

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
  const status =
    typeof subscription === "string" ? subscription : subscription.status;

  return status === "internal" || status === "active" || status === "trial";
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

export function getWorkspaceAccessBlockedMessage(status: SubscriptionStatus) {
  switch (status) {
    case "unpaid":
      return "Este workspace ainda não possui uma assinatura ativa. Contrate um plano para liberar esta funcionalidade.";
    case "pending":
      return "A assinatura está aguardando confirmação de pagamento. O acesso será liberado assim que a cobrança for confirmada.";
    case "paused":
      return "A assinatura está pausada. Reative o plano para voltar a usar esta funcionalidade.";
    case "canceled":
      return "A assinatura está cancelada. Contrate um plano para voltar a usar esta funcionalidade.";
    case "internal":
    case "trial":
    case "active":
      return null;
  }
}

export function canAccessAppPathWithoutPaidWorkspace(pathname: string) {
  return ALLOWED_APP_PATHS_WITHOUT_PAID_ACCESS.has(pathname);
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
  if (
    subscription.status === "unpaid" ||
    subscription.status === "trial" ||
    subscription.status === "pending"
  ) {
    return "starter";
  }

  return subscription.planId;
}
