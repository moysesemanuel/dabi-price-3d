import "server-only";

import {
  claimBillingSubscriptionOperation,
  releaseBillingSubscriptionOperationClaim,
} from "./repository.ts";
import { runWithBillingSubscriptionOperationClaim } from "./subscription-operation-claim.ts";

export function runWithServerBillingSubscriptionOperationClaim<T>(
  subscriptionId: string,
  operation: () => Promise<T>,
) {
  return runWithBillingSubscriptionOperationClaim({
    subscriptionId,
    claimSubscriptionOperation: claimBillingSubscriptionOperation,
    releaseSubscriptionOperationClaim: releaseBillingSubscriptionOperationClaim,
    operation,
  });
}
