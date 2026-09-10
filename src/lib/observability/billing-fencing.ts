import type { BillingFencingViolationEvent } from "../billing/subscription-operation-context.ts";

type CaptureMessage = (
  message: string,
  context: {
    level: "warning";
    extra: BillingFencingViolationEvent;
  },
) => unknown;

/**
 * Reporta uma escrita em `billing_subscriptions` sem o claim de posse esperado
 * — contexto ausente (escrita fora de `runWithBillingSubscriptionOperationClaim`)
 * ou token divergente (lease expirou e outra operação já assumiu o claim).
 * Enquanto o fencing estiver em modo permissivo
 * (`BILLING_FENCING_ENFORCED` desligado), essa escrita não é bloqueada — só
 * reportada, para medir antes de recusar.
 *
 * O `captureMessage` entra por parametro para manter o modulo testavel sem o
 * SDK do Sentry, no mesmo padrao de `billing-claim.ts`.
 */
export function createBillingFencingViolationReporter(captureMessage: CaptureMessage) {
  return (event: BillingFencingViolationEvent) => {
    captureMessage("billing.fencing_violation", {
      level: "warning",
      extra: event,
    });
  };
}
