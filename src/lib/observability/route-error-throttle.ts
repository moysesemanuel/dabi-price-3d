export type RouteErrorThrottleDecision =
  | { allowed: true; suppressed: number }
  | { allowed: false };

export type RouteErrorThrottleOptions = {
  windowMs?: number;
  maxPerWindow?: number;
  now?: () => number;
};

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_PER_WINDOW = 5;
const IDLE_WINDOWS_BEFORE_DISCARD = 5;

type WindowState = {
  startedAt: number;
  sent: number;
  suppressed: number;
  lastSeenAt: number;
};

/**
 * Limita quantos eventos de um mesmo par rota/evento sao enviados ao Sentry por
 * janela de tempo. O objetivo e o cenario de rajada: quando o banco ou o
 * provider cai, o Mercado Pago reenvia o mesmo webhook varias vezes e cada
 * tentativa geraria um evento, consumindo a cota justamente quando ela e mais
 * necessaria.
 *
 * O log de console nunca e afetado: ele registra todas as ocorrencias. Quando a
 * janela vira, o proximo evento enviado carrega quantas ocorrencias foram
 * suprimidas no intervalo, entao a contagem nao se perde silenciosamente.
 *
 * O estado e por instancia do processo. Em serverless isso significa que cada
 * instancia tem seu proprio orcamento, o que e aceitavel: o limite existe para
 * cortar a rajada, nao para garantir uma contagem global exata.
 */
export function createRouteErrorThrottle({
  windowMs = DEFAULT_WINDOW_MS,
  maxPerWindow = DEFAULT_MAX_PER_WINDOW,
  now = Date.now,
}: RouteErrorThrottleOptions = {}) {
  const states = new Map<string, WindowState>();

  return function shouldReport(key: string): RouteErrorThrottleDecision {
    const timestamp = now();

    discardIdleStates(states, timestamp, windowMs);

    const state = states.get(key);

    if (!state || timestamp - state.startedAt >= windowMs) {
      states.set(key, {
        startedAt: timestamp,
        sent: 1,
        suppressed: 0,
        lastSeenAt: timestamp,
      });

      return { allowed: true, suppressed: state?.suppressed ?? 0 };
    }

    state.lastSeenAt = timestamp;

    if (state.sent < maxPerWindow) {
      state.sent += 1;

      return { allowed: true, suppressed: 0 };
    }

    state.suppressed += 1;

    return { allowed: false };
  };
}

function discardIdleStates(
  states: Map<string, WindowState>,
  timestamp: number,
  windowMs: number,
) {
  const idleLimit = windowMs * IDLE_WINDOWS_BEFORE_DISCARD;

  for (const [key, state] of states) {
    if (timestamp - state.lastSeenAt >= idleLimit) {
      states.delete(key);
    }
  }
}
