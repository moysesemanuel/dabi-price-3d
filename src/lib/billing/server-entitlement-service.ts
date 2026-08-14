import "server-only";

import { ensureLegacyWorkspaceBillingMigration } from "./server-legacy-migration-service.ts";
import { findCurrentBillingSubscriptionForWorkspace } from "./repository.ts";
import {
  resolveWorkspaceEntitlements,
  type WorkspaceEntitlementSubscription,
} from "./entitlement-service.ts";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "../server/platform";

export async function getWorkspaceEntitlements(input: {
  workspaceId: string;
  fallbackSubscription?: WorkspaceEntitlementSubscription | null;
  now?: Date;
}) {
  if (!isPlatformPersistenceAvailable()) {
    return resolveWorkspaceEntitlements({
      subscription: input.fallbackSubscription ?? null,
      now: input.now,
    });
  }

  await ensureLegacyWorkspaceBillingMigration({
    workspaceId: input.workspaceId,
  });

  const billingSubscription = await findCurrentBillingSubscriptionForWorkspace(
    input.workspaceId,
  );

  if (billingSubscription) {
    return resolveWorkspaceEntitlements({
      subscription: {
        planId: billingSubscription.planId,
        status: billingSubscription.status,
        accessUntil: billingSubscription.accessUntil,
        currentPeriodEnd: billingSubscription.currentPeriodEnd,
        gracePeriodEndsAt: billingSubscription.gracePeriodEndsAt,
      },
      now: input.now,
    });
  }

  const fallbackSubscription =
    input.fallbackSubscription ??
    (await getWorkspacePreferences(input.workspaceId)).subscription;

  return resolveWorkspaceEntitlements({
    subscription: fallbackSubscription,
    now: input.now,
  });
}
