import "server-only";

import { findCurrentBillingSubscriptionForWorkspace } from "./repository.ts";
import {
  resolveBillingNotification,
} from "./notification-service.ts";
import {
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

  return resolveBillingNotification({
    subscription: null,
    now: input.now,
  });
}
