/**
 * Cliente HTTP para chamadas a servicos externos.
 *
 * Motivacao (07/09/2026): apenas a rota do ERP definia timeout. Mercado Pago,
 * Resend, Mercado Livre e o servico de cambio usavam `fetch` cru, entao um
 * upstream pendurado segurava a function ate o limite da plataforma e nenhuma
 * falha transitoria era reexecutada.
 *
 * Regras que este modulo garante:
 *
 * - toda chamada externa tem timeout, definido por integracao;
 * - retry so acontece em falha transitoria (timeout, rede, 5xx, 429);
 * - retry so acontece em metodo idempotente, ou quando quem chama declara
 *   explicitamente que a requisicao carrega idempotency key propria. Sem essa
 *   regra, um retry de POST poderia gerar segunda cobranca;
 * - a resposta e devolvida como veio, inclusive 4xx e 5xx: quem chama continua
 *   dono da propria semantica de erro. Este modulo so lanca quando a resposta
 *   nunca chegou (timeout ou falha de rede).
 */

export type OutboundIntegration =
  | "mercado_pago"
  | "mercado_livre"
  | "resend"
  | "erp"
  | "exchange_rates";

export type OutboundFailureKind = "timeout" | "network";

export type OutboundRetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type OutboundAttemptOutcome = "retry_status" | "retry_error" | "gave_up";

export type OutboundAttemptEvent = {
  integration: OutboundIntegration;
  requestId: string | null;
  method: string;
  target: string;
  attempt: number;
  maxAttempts: number;
  outcome: OutboundAttemptOutcome;
  status: number | null;
  kind: OutboundFailureKind | null;
  delayMs: number | null;
};

export type OutboundRequestInit = Omit<RequestInit, "signal"> & {
  integration: OutboundIntegration;
  /**
   * `requestId` da rota que originou a chamada, quando existir contexto. Sem
   * ele o log da tentativa nao pode ser amarrado a requisicao do usuario, e
   * uma falha externa vira um evento solto.
   */
  requestId?: string | null;
  timeoutMs?: number;
  retry?: Partial<OutboundRetryPolicy> | false;
  /**
   * Libera retry para metodo nao idempotente. So use quando a requisicao levar
   * uma idempotency key montada **antes** da primeira tentativa, de modo que
   * todas as tentativas cheguem ao provider com a mesma chave.
   */
  retryNonIdempotentMethod?: boolean;
};

/** Timeout por integracao. O provider de cobranca tolera menos que o ERP. */
const DEFAULT_TIMEOUT_MS: Record<OutboundIntegration, number> = {
  mercado_pago: 10_000,
  mercado_livre: 8_000,
  resend: 8_000,
  erp: 12_000,
  exchange_rates: 4_000,
};

const DEFAULT_RETRY_POLICY: OutboundRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 2_000,
};

const NO_RETRY_POLICY: OutboundRetryPolicy = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
};

/** 4xx nao entra: o pedido chegou e foi recusado, repetir daria o mesmo erro. */
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

const MAX_RETRY_AFTER_MS = 5_000;

export class OutboundHttpError extends Error {
  readonly kind: OutboundFailureKind;
  readonly integration: OutboundIntegration;
  readonly method: string;
  readonly target: string;
  readonly attempts: number;

  constructor(input: {
    kind: OutboundFailureKind;
    integration: OutboundIntegration;
    method: string;
    target: string;
    attempts: number;
    cause?: unknown;
  }) {
    const reason = input.kind === "timeout" ? "timeout" : "falha de rede";

    super(
      `${input.integration}: ${reason} em ${input.method} ${input.target} apos ${input.attempts} tentativa(s).`,
      { cause: input.cause },
    );

    this.name = "OutboundHttpError";
    this.kind = input.kind;
    this.integration = input.integration;
    this.method = input.method;
    this.target = input.target;
    this.attempts = input.attempts;
  }
}

export function isOutboundTimeoutError(error: unknown) {
  return error instanceof OutboundHttpError && error.kind === "timeout";
}

export function isOutboundHttpError(error: unknown) {
  return error instanceof OutboundHttpError;
}

export type OutboundHttpDependencies = {
  fetch?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
  random?: () => number;
  onAttempt?: (event: OutboundAttemptEvent) => void;
};

export function createOutboundHttpClient(
  dependencies: OutboundHttpDependencies = {},
) {
  // Resolvido a cada chamada, e nao no momento da criacao do cliente: assim um
  // duplo de `globalThis.fetch` instalado depois do import continua valendo.
  const baseFetch =
    dependencies.fetch ??
    ((input: string | URL, requestInit: RequestInit) =>
      globalThis.fetch(input, requestInit));
  const sleep =
    dependencies.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      }));
  const random = dependencies.random ?? Math.random;
  const onAttempt = dependencies.onAttempt ?? logOutboundAttempt;

  return async function outboundFetch(
    url: string | URL,
    init: OutboundRequestInit,
  ): Promise<Response> {
    const {
      integration,
      requestId,
      timeoutMs,
      retry,
      retryNonIdempotentMethod,
      ...requestInit
    } = init;

    const method = (requestInit.method ?? "GET").toUpperCase();
    const target = describeTarget(url);
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS[integration];
    const policy = resolveRetryPolicy({
      retry,
      method,
      retryNonIdempotentMethod: retryNonIdempotentMethod === true,
      body: requestInit.body,
    });

    let attempt = 0;

    for (;;) {
      attempt += 1;

      try {
        const response = await baseFetch(url, {
          ...requestInit,
          signal: AbortSignal.timeout(timeout),
        });

        if (attempt >= policy.maxAttempts || !RETRYABLE_STATUSES.has(response.status)) {
          return response;
        }

        const delayMs = resolveDelayMs({
          attempt,
          policy,
          random,
          retryAfter: response.headers.get("retry-after"),
        });

        onAttempt({
          integration,
          requestId: requestId ?? null,
          method,
          target,
          attempt,
          maxAttempts: policy.maxAttempts,
          outcome: "retry_status",
          status: response.status,
          kind: null,
          delayMs,
        });

        // Sem isso a conexao fica presa ao corpo que ninguem vai ler.
        await discardResponseBody(response);
        await sleep(delayMs);
      } catch (error) {
        if (error instanceof OutboundHttpError) {
          throw error;
        }

        const kind: OutboundFailureKind = isTransportTimeout(error)
          ? "timeout"
          : "network";

        if (attempt >= policy.maxAttempts) {
          onAttempt({
            integration,
            requestId: requestId ?? null,
            method,
            target,
            attempt,
            maxAttempts: policy.maxAttempts,
            outcome: "gave_up",
            status: null,
            kind,
            delayMs: null,
          });

          throw new OutboundHttpError({
            kind,
            integration,
            method,
            target,
            attempts: attempt,
            cause: error,
          });
        }

        const delayMs = resolveDelayMs({
          attempt,
          policy,
          random,
          retryAfter: null,
        });

        onAttempt({
          integration,
          requestId: requestId ?? null,
          method,
          target,
          attempt,
          maxAttempts: policy.maxAttempts,
          outcome: "retry_error",
          status: null,
          kind,
          delayMs,
        });

        await sleep(delayMs);
      }
    }
  };
}

export const outboundFetch = createOutboundHttpClient();

function resolveRetryPolicy(input: {
  retry: Partial<OutboundRetryPolicy> | false | undefined;
  method: string;
  retryNonIdempotentMethod: boolean;
  body: BodyInit | null | undefined;
}): OutboundRetryPolicy {
  if (input.retry === false) {
    return NO_RETRY_POLICY;
  }

  // Um corpo em stream so pode ser lido uma vez: repetir enviaria vazio.
  if (isStreamingBody(input.body)) {
    return NO_RETRY_POLICY;
  }

  if (!IDEMPOTENT_METHODS.has(input.method) && !input.retryNonIdempotentMethod) {
    return NO_RETRY_POLICY;
  }

  const policy: OutboundRetryPolicy = {
    ...DEFAULT_RETRY_POLICY,
    ...(input.retry ?? {}),
  };

  return {
    maxAttempts: Math.max(1, Math.floor(policy.maxAttempts)),
    baseDelayMs: Math.max(0, policy.baseDelayMs),
    maxDelayMs: Math.max(0, policy.maxDelayMs),
  };
}

function resolveDelayMs(input: {
  attempt: number;
  policy: OutboundRetryPolicy;
  random: () => number;
  retryAfter: string | null;
}) {
  const retryAfterMs = parseRetryAfterMs(input.retryAfter);

  if (retryAfterMs !== null) {
    return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
  }

  const ceiling = Math.min(
    input.policy.maxDelayMs,
    input.policy.baseDelayMs * 2 ** (input.attempt - 1),
  );

  // Metade fixa, metade sorteada: espalha rajadas sem virar espera imprevisivel.
  return Math.round(ceiling / 2 + input.random() * (ceiling / 2));
}

function parseRetryAfterMs(value: string | null) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();

  if (/^\d+$/.test(normalizedValue)) {
    return Number(normalizedValue) * 1_000;
  }

  const parsedDate = Date.parse(normalizedValue);

  if (Number.isNaN(parsedDate)) {
    return null;
  }

  return Math.max(0, parsedDate - Date.now());
}

function isStreamingBody(body: BodyInit | null | undefined) {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as ReadableStream).getReader === "function"
  );
}

function isTransportTimeout(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

async function discardResponseBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Descartar o corpo nunca pode derrubar a chamada que sera repetida.
  }
}

/**
 * Host e caminho, sem query string: parametros de rota externa carregam token,
 * e este valor vai para log e para a mensagem de erro.
 */
function describeTarget(url: string | URL) {
  try {
    const parsedUrl = typeof url === "string" ? new URL(url) : url;
    return `${parsedUrl.host}${parsedUrl.pathname}`;
  } catch {
    return "url_invalida";
  }
}

function logOutboundAttempt(event: OutboundAttemptEvent) {
  const level = event.outcome === "gave_up" ? "error" : "warn";

  console[level](
    `[outbound:${event.integration}] ${event.outcome}`,
    {
      ts: new Date().toISOString(),
      integration: event.integration,
      requestId: event.requestId,
      method: event.method,
      target: event.target,
      attempt: event.attempt,
      maxAttempts: event.maxAttempts,
      status: event.status,
      kind: event.kind,
      delayMs: event.delayMs,
    },
  );
}
