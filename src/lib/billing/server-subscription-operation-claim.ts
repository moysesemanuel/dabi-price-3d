import "server-only";

import * as Sentry from "@sentry/nextjs";

import {
  claimBillingSubscriptionOperation,
  releaseBillingSubscriptionOperationClaim,
} from "./repository.ts";
import { runWithBillingSubscriptionOperationClaim } from "./subscription-operation-claim.ts";
import { createBillingClaimReporter } from "../observability/billing-claim.ts";

export function runWithServerBillingSubscriptionOperationClaim<T>(
  subscriptionId: string,
  operation: () => Promise<T>,
) {
  return runWithBillingSubscriptionOperationClaim({
    subscriptionId,
    claimSubscriptionOperation: claimBillingSubscriptionOperation,
    releaseSubscriptionOperationClaim: releaseBillingSubscriptionOperationClaim,
    reportClaimLost: createBillingClaimReporter(Sentry.captureMessage),
    operation,
  });
}
