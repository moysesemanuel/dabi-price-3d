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

/**
 * Reporta um claim de operacao de assinatura que nao pode ser liberado. Um claim
 * preso bloqueia as operacoes seguintes daquela assinatura, entao a falha de
 * liberacao precisa ser visivel em vez de engolida.
 *
 * O `captureMessage` entra por parametro para manter o modulo testavel sem o SDK
 * do Sentry, no mesmo padrao de `route-error-reporter`. O evento carrega apenas
 * o tipo do claim e o id da assinatura — nenhum dado pessoal ou token.
 */
export function createBillingClaimReporter(captureMessage: CaptureMessage) {
  return (event: BillingClaimLostEvent) => {
    captureMessage("billing.claim_lost", {
      level: "warning",
      extra: event,
    });
  };
}
