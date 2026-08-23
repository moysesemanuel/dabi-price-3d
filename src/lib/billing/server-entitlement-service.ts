import "server-only";

import { findCurrentBillingSubscriptionForWorkspace } from "./repository.ts";
import {
  resolveWorkspaceEntitlements,
} from "./entitlement-service.ts";
import {
  isPlatformPersistenceAvailable,
} from "../server/platform";

export async function getWorkspaceEntitlements(input: {
  workspaceId: string;
  now?: Date;
}) {
  if (!isPlatformPersistenceAvailable()) {
    return resolveWorkspaceEntitlements({
      subscription: null,
      now: input.now,
    });
  }

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

  return resolveWorkspaceEntitlements({
    subscription: null,
    now: input.now,
  });
}
