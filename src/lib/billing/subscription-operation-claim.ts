export class BillingSubscriptionOperationInProgressError extends Error {
  constructor(subscriptionId: string) {
    super(`A billing operation is already in progress for subscription ${subscriptionId}.`);
    this.name = "BillingSubscriptionOperationInProgressError";
  }
}

export async function runWithBillingSubscriptionOperationClaim<T>(input: {
  subscriptionId: string;
  claimSubscriptionOperation(subscriptionId: string): Promise<string | null>;
  releaseSubscriptionOperationClaim(input: {
    subscriptionId: string;
    claimToken: string;
  }): Promise<boolean>;
  reportClaimLost?(event: BillingClaimLostEvent): Promise<void> | void;
  operation(): Promise<T>;
}) {
  const claimToken = await input.claimSubscriptionOperation(input.subscriptionId);

  if (!claimToken) {
    throw new BillingSubscriptionOperationInProgressError(input.subscriptionId);
  }

  try {
    return await input.operation();
  } finally {
    const released = await input
      .releaseSubscriptionOperationClaim({
        subscriptionId: input.subscriptionId,
        claimToken,
      })
      .catch(() => false);

    if (!released) {
      await Promise.resolve(
        input.reportClaimLost?.({
          claimType: "subscription_operation",
          subscriptionId: input.subscriptionId,
        }),
      ).catch(() => undefined);
    }
  }
}
import type { BillingClaimLostEvent } from "../observability/billing-claim.ts";
