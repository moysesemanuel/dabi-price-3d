import { RequestBillingCycleChangeError } from "./cycle-change-management.ts";
import type { BillingSubscription } from "./types.ts";

export async function runBillingCycleChangePixOperation<
  TSubscription extends BillingSubscription,
  TResult,
>(input: {
  subscription: TSubscription;
  getCurrentSubscription(): Promise<TSubscription | null>;
  runWithSubscriptionOperation<T>(
    subscriptionId: string,
    operation: () => Promise<T>,
  ): Promise<T>;
  operation(subscription: TSubscription): Promise<TResult>;
}) {
  return input.runWithSubscriptionOperation(input.subscription.id, async () => {
    const currentSubscription = await input.getCurrentSubscription();

    if (!currentSubscription || currentSubscription.id !== input.subscription.id) {
      throw new RequestBillingCycleChangeError(
        "A assinatura foi alterada enquanto a mudança de ciclo estava sendo iniciada. Atualize a página e tente novamente.",
        "CYCLE_CHANGE_SUBSCRIPTION_CHANGED_CONCURRENTLY",
        409,
      );
    }

    return input.operation(currentSubscription);
  });
}
