import "server-only";

import { findCurrentBillingSubscriptionForWorkspace } from "./repository.ts";
import {
  resolveBillingNotification,
} from "./notification-service.ts";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "../server/platform";

export async function getWorkspaceBillingNotification(input: {
  workspaceId: string;
  now?: Date;
}) {
  if (!isPlatformPersistenceAvailable()) {
    return resolveBillingNotification({
      subscription: null,
      now: input.now,
    });
  }

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

  const projectedSubscription = (await getWorkspacePreferences(input.workspaceId))
    .subscription;

  return resolveBillingNotification({
    subscription: projectedSubscription,
    now: input.now,
  });
}
