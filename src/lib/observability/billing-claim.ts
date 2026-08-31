export type BillingClaimLostEvent = {
  claimType: "subscription_operation";
  subscriptionId: string;
};

type CaptureMessage = (
  message: string,
  context: {
    level: "warning";
    extra: BillingClaimLostEvent;
  },
) => unknown;

export function createBillingClaimReporter(captureMessage: CaptureMessage) {
  return (event: BillingClaimLostEvent) => {
    captureMessage("billing.claim_lost", {
      level: "warning",
      extra: event,
    });
  };
}
