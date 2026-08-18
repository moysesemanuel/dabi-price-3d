import {
  currentBillingSubscriptionStatuses,
  terminalBillingSubscriptionStatuses,
  type BillingSubscriptionStatus,
} from "./types.ts";

const allowedBillingSubscriptionTransitions: Record<
  BillingSubscriptionStatus,
  readonly BillingSubscriptionStatus[]
> = {
  pending: ["active", "canceled"],
  active: ["past_due", "scheduled_cancel", "paused", "expired"],
  past_due: ["active", "paused", "scheduled_cancel"],
  scheduled_cancel: ["active", "canceled"],
  paused: ["active", "canceled"],
  canceled: [],
  expired: [],
};

export function canTransitionBillingSubscriptionStatus(
  from: BillingSubscriptionStatus,
  to: BillingSubscriptionStatus,
) {
  if (from === to) {
    return true;
  }

  return allowedBillingSubscriptionTransitions[from].includes(to);
}

export function assertValidBillingSubscriptionTransition(input: {
  from: BillingSubscriptionStatus;
  to: BillingSubscriptionStatus;
}) {
  if (!canTransitionBillingSubscriptionStatus(input.from, input.to)) {
    throw new Error(
      `Invalid billing subscription transition: ${input.from} -> ${input.to}`,
    );
  }
}

export function isCurrentBillingSubscriptionStatus(
  status: BillingSubscriptionStatus,
) {
  return currentBillingSubscriptionStatuses.includes(
    status as (typeof currentBillingSubscriptionStatuses)[number],
  );
}

export function isTerminalBillingSubscriptionStatus(
  status: BillingSubscriptionStatus,
) {
  return terminalBillingSubscriptionStatuses.includes(
    status as (typeof terminalBillingSubscriptionStatuses)[number],
  );
}
