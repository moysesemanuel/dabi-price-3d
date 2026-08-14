import type { WorkspaceSubscription } from "../workspace/catalog.ts";
import type {
  BillingProviderName,
  BillingSubscriptionStatus,
} from "./types.ts";

export type LegacyBillingMigrationDecision =
  | {
      type: "skip";
      reason:
        | "billing_already_exists"
        | "legacy_unpaid"
        | "legacy_trial"
        | "legacy_internal";
    }
  | {
      type: "import_subscription";
      planId: WorkspaceSubscription["planId"];
      billingCycle: WorkspaceSubscription["billingCycle"];
      status: BillingSubscriptionStatus;
      autoRenew: boolean;
      provider: BillingProviderName | null;
      providerSubscriptionId: string | null;
      endedAt: string | null;
      reason:
        | "legacy_pending"
        | "legacy_active"
        | "legacy_past_due"
        | "legacy_scheduled_cancel"
        | "legacy_paused"
        | "legacy_canceled"
        | "legacy_expired";
    };

export function resolveLegacyBillingMigration(input: {
  legacySubscription: WorkspaceSubscription;
  hasAnyBillingSubscription: boolean;
  now?: Date;
}): LegacyBillingMigrationDecision {
  if (input.hasAnyBillingSubscription) {
    return {
      type: "skip",
      reason: "billing_already_exists",
    };
  }

  const providerSubscriptionId = normalizeOptionalString(
    input.legacySubscription.mercadoPagoSubscriptionId,
  );
  const provider = providerSubscriptionId ? "mercado_pago" : null;

  switch (input.legacySubscription.status) {
    case "unpaid":
      return {
        type: "skip",
        reason: "legacy_unpaid",
      };
    case "trial":
      return {
        type: "skip",
        reason: "legacy_trial",
      };
    case "internal":
      return {
        type: "skip",
        reason: "legacy_internal",
      };
    case "pending":
      return buildImportDecision(input, {
        status: "pending",
        autoRenew: providerSubscriptionId !== null,
        provider,
        providerSubscriptionId,
        endedAt: null,
        reason: "legacy_pending",
      });
    case "active":
      return buildImportDecision(input, {
        status: "active",
        autoRenew: providerSubscriptionId !== null,
        provider,
        providerSubscriptionId,
        endedAt: null,
        reason: "legacy_active",
      });
    case "past_due":
      return buildImportDecision(input, {
        status: "past_due",
        autoRenew: providerSubscriptionId !== null,
        provider,
        providerSubscriptionId,
        endedAt: null,
        reason: "legacy_past_due",
      });
    case "scheduled_cancel":
      return buildImportDecision(input, {
        status: "scheduled_cancel",
        autoRenew: false,
        provider,
        providerSubscriptionId,
        endedAt: null,
        reason: "legacy_scheduled_cancel",
      });
    case "paused":
      return buildImportDecision(input, {
        status: "paused",
        autoRenew: false,
        provider,
        providerSubscriptionId,
        endedAt: null,
        reason: "legacy_paused",
      });
    case "canceled":
      return buildImportDecision(input, {
        status: "canceled",
        autoRenew: false,
        provider,
        providerSubscriptionId,
        endedAt: resolveMigrationEndedAt(input.now),
        reason: "legacy_canceled",
      });
    case "expired":
      return buildImportDecision(input, {
        status: "expired",
        autoRenew: false,
        provider,
        providerSubscriptionId,
        endedAt: resolveMigrationEndedAt(input.now),
        reason: "legacy_expired",
      });
  }
}

function buildImportDecision(
  input: {
    legacySubscription: WorkspaceSubscription;
  },
  decision: Omit<
    Extract<LegacyBillingMigrationDecision, { type: "import_subscription" }>,
    "type" | "planId" | "billingCycle"
  >,
): Extract<LegacyBillingMigrationDecision, { type: "import_subscription" }> {
  return {
    type: "import_subscription",
    planId: input.legacySubscription.planId,
    billingCycle: input.legacySubscription.billingCycle,
    status: decision.status,
    autoRenew: decision.autoRenew,
    provider: decision.provider,
    providerSubscriptionId: decision.providerSubscriptionId,
    endedAt: decision.endedAt,
    reason: decision.reason,
  };
}

function normalizeOptionalString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveMigrationEndedAt(now?: Date) {
  return (now ?? new Date()).toISOString();
}
