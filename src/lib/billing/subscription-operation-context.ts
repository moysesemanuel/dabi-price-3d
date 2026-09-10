import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Contexto implícito de posse de operação, carregado durante o corpo de
 * `runWithBillingSubscriptionOperationClaim`. Existe para o repositório poder
 * conferir, no momento da escrita, que quem está mutando a assinatura ainda é
 * dono do claim adquirido — sem precisar passar o token por parâmetro em toda
 * função entre o claim e a escrita. Ver `docs/architecture/W2_CONCORRENCIA_DESIGN.md`,
 * Parte 1.
 */
export type BillingSubscriptionOperationContext = {
  claimToken: string;
};

const storage = new AsyncLocalStorage<BillingSubscriptionOperationContext>();

export function runInBillingSubscriptionOperationContext<T>(
  context: BillingSubscriptionOperationContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(context, fn);
}

export function getBillingSubscriptionOperationContext(): BillingSubscriptionOperationContext | null {
  return storage.getStore() ?? null;
}

/**
 * Enquanto desligado (padrão), a ausência ou divergência do claim é apenas
 * reportada — a escrita continua passando, no mesmo comportamento de hoje.
 * Ligar depois de uma semana sem violação reportada é decisão operacional,
 * não requer nova PR de código.
 */
export function isBillingSubscriptionFencingEnforced() {
  return process.env.BILLING_FENCING_ENFORCED === "true";
}

export type BillingFencingViolationEvent = {
  subscriptionId: string;
  reason: "context_missing" | "claim_token_mismatch";
};

export type BillingFencingViolationReporter = (
  event: BillingFencingViolationEvent,
) => void;

// Mesmo padrão de globalThis + Symbol.for de src/lib/server/route-observability.ts
// (setRouteErrorReporter/reportRouteError): o repositório não pode importar o SDK
// do Sentry diretamente — fica testável só contra Postgres real — e não há um
// único ponto de entrada por onde injetar essa dependência, já que
// updateBillingSubscription é chamada por vários serviços.
const FENCING_VIOLATION_REPORTER_KEY = Symbol.for(
  "dabi-price.billing-fencing-violation-reporter",
);

type FencingViolationReporterRegistry = typeof globalThis & {
  [FENCING_VIOLATION_REPORTER_KEY]?: BillingFencingViolationReporter | null;
};

export function setBillingFencingViolationReporter(
  reporter: BillingFencingViolationReporter | null,
) {
  (globalThis as FencingViolationReporterRegistry)[
    FENCING_VIOLATION_REPORTER_KEY
  ] = reporter;
}

export function reportBillingFencingViolation(event: BillingFencingViolationEvent) {
  const reporter = (globalThis as FencingViolationReporterRegistry)[
    FENCING_VIOLATION_REPORTER_KEY
  ];

  if (typeof reporter !== "function") {
    return;
  }

  try {
    reporter(event);
  } catch {
    // Observabilidade nunca pode derrubar a escrita que estava sendo observada.
  }
}
