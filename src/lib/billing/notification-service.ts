import { getWorkspacePlan, type WorkspacePlanId } from "../workspace/catalog.ts";
import {
  resolveWorkspaceEntitlementAccessReason,
  type WorkspaceEntitlementSubscription,
} from "./entitlement-service.ts";

export type BillingNotificationKind =
  | "paused"
  | "past_due"
  | "scheduled_cancel"
  | "expiring_soon";

export type BillingNotificationTone = "warning" | "danger" | "neutral";

export type BillingNotificationAction =
  | {
      type: "link";
      label: string;
      href: string;
    }
  | {
      type: "manage_subscription";
      label: string;
      action: "resume" | "cancel";
    };

export type BillingNotification = {
  kind: BillingNotificationKind;
  priority: number;
  tone: BillingNotificationTone;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: BillingNotificationAction;
  secondaryAction?: BillingNotificationAction | null;
};

export type BillingNotificationSubscription = WorkspaceEntitlementSubscription & {
  autoRenew?: boolean | null;
};

export function resolveBillingNotification(input: {
  subscription?: BillingNotificationSubscription | null;
  now?: Date;
}) {
  const subscription = input.subscription ?? null;
  const now = input.now ?? new Date();
  const accessReason = resolveWorkspaceEntitlementAccessReason({
    subscription,
    now,
  });
  const planLabel = getWorkspacePlan(resolvePlanId(subscription)).label;
  const currentPeriodEndLabel = formatDate(subscription?.currentPeriodEnd);
  const gracePeriodEndLabel = formatDate(
    subscription?.gracePeriodEndsAt ?? subscription?.currentPeriodEnd,
  );

  if (accessReason === "paused") {
    return {
      kind: "paused",
      priority: 4,
      tone: "danger",
      eyebrow: "Assinatura pausada",
      title: "Seu acesso pago está temporariamente suspenso.",
      description:
        "O workspace continua preservado, mas a assinatura precisa ser retomada para liberar novamente os módulos pagos.",
      primaryAction: {
        type: "link",
        label: "Ver detalhes",
        href: "/app/assinatura",
      },
      secondaryAction: {
        type: "link",
        label: "Comparar planos",
        href: "/app/planos",
      },
    } satisfies BillingNotification;
  }

  if (accessReason === "grace_period" && gracePeriodEndLabel) {
    return {
      kind: "past_due",
      priority: 3,
      tone: "danger",
      eyebrow: "Pagamento pendente",
      title: "Não conseguimos renovar sua assinatura.",
      description: `Seu acesso continuará até ${gracePeriodEndLabel}. Regularize antes dessa data para evitar a suspensão.`,
      primaryAction: {
        type: "link",
        label: "Ver detalhes",
        href: "/app/assinatura",
      },
      secondaryAction: {
        type: "link",
        label: "Comparar planos",
        href: "/app/planos",
      },
    } satisfies BillingNotification;
  }

  if (accessReason === "scheduled_cancel" && currentPeriodEndLabel) {
    return {
      kind: "scheduled_cancel",
      priority: 2,
      tone: "warning",
      eyebrow: "Renovação desligada",
      title: "A renovação da sua assinatura foi cancelada.",
      description: `Você continuará com acesso ao ${planLabel} até ${currentPeriodEndLabel}.`,
      primaryAction: {
        type: "manage_subscription",
        label: "Manter assinatura",
        action: "resume",
      },
      secondaryAction: {
        type: "link",
        label: "Ver detalhes",
        href: "/app/assinatura",
      },
    } satisfies BillingNotification;
  }

  if (
    accessReason === "active" &&
    subscription?.autoRenew === false &&
    isWithinDays(subscription.currentPeriodEnd, now, 7) &&
    currentPeriodEndLabel
  ) {
    return {
      kind: "expiring_soon",
      priority: 1,
      tone: "warning",
      eyebrow: "Fim do período",
      title: "Sua assinatura está perto do fim.",
      description: `O acesso atual termina em ${currentPeriodEndLabel}. Revise a renovação antes do encerramento do período.`,
      primaryAction: {
        type: "link",
        label: "Ver detalhes",
        href: "/app/assinatura",
      },
      secondaryAction: {
        type: "link",
        label: "Comparar planos",
        href: "/app/planos",
      },
    } satisfies BillingNotification;
  }

  return null;
}

function resolvePlanId(subscription: BillingNotificationSubscription | null) {
  return (subscription?.planId ?? "starter") as WorkspacePlanId;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

function isWithinDays(
  value: string | null | undefined,
  now: Date,
  days: number,
) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return false;
  }

  const diff = timestamp - now.getTime();

  return diff > 0 && diff <= days * 24 * 60 * 60 * 1000;
}
