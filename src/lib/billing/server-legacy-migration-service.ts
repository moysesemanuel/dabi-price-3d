import "server-only";

import { resolveLegacyBillingMigration } from "./legacy-migration.ts";
import { findLatestBillingSubscriptionForWorkspace } from "./repository.ts";
import { createBillingService } from "./server-service.ts";
import {
  getStoredWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "../server/platform.ts";

export async function ensureLegacyWorkspaceBillingMigration(input: {
  workspaceId: string;
}) {
  if (!isPlatformPersistenceAvailable()) {
    return {
      migrated: false,
      reason: "persistence_disabled",
      subscription: null,
    } as const;
  }

  const [storedPreferences, latestBillingSubscription] = await Promise.all([
    getStoredWorkspacePreferences(input.workspaceId),
    findLatestBillingSubscriptionForWorkspace(input.workspaceId),
  ]);

  const decision = resolveLegacyBillingMigration({
    legacySubscription: storedPreferences.subscription,
    hasAnyBillingSubscription: latestBillingSubscription !== null,
  });

  if (decision.type === "skip") {
    return {
      migrated: false,
      reason: decision.reason,
      subscription: latestBillingSubscription,
    } as const;
  }

  const subscription = await createBillingService().importLegacySubscription({
    workspaceId: input.workspaceId,
    planId: decision.planId,
    billingCycle: decision.billingCycle,
    status: decision.status,
    autoRenew: decision.autoRenew,
    provider: decision.provider,
    providerSubscriptionId: decision.providerSubscriptionId,
    endedAt: decision.endedAt,
    actorType: "system",
    legacyStatus: storedPreferences.subscription.status,
  });

  return {
    migrated: true,
    reason: decision.reason,
    subscription,
  } as const;
}
