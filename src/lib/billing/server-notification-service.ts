import "server-only";

import { ensureLegacyWorkspaceBillingMigration } from "./server-legacy-migration-service.ts";
import { findCurrentBillingSubscriptionForWorkspace } from "./repository.ts";
import {
  resolveBillingNotification,
  type BillingNotificationSubscription,
} from "./notification-service.ts";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "../server/platform";

export async function getWorkspaceBillingNotification(input: {
  workspaceId: string;
  fallbackSubscription?: BillingNotificationSubscription | null;
  now?: Date;
}) {
  if (!isPlatformPersistenceAvailable()) {
    return resolveBillingNotification({
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
    return resolveBillingNotification({
      subscription: {
        planId: billingSubscription.planId,
        status: billingSubscription.status,
        accessUntil: billingSubscription.accessUntil,
        currentPeriodEnd: billingSubscription.currentPeriodEnd,
        gracePeriodEndsAt: billingSubscription.gracePeriodEndsAt,
        autoRenew: billingSubscription.autoRenew,
      },
      now: input.now,
    });
  }

  const fallbackSubscription =
    input.fallbackSubscription ??
    (await getWorkspacePreferences(input.workspaceId)).subscription;

  return resolveBillingNotification({
    subscription: fallbackSubscription,
    now: input.now,
  });
}
