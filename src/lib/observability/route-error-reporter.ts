import * as Sentry from "@sentry/nextjs";

import { setRouteErrorReporter } from "../server/route-observability";
import { createRouteErrorThrottle } from "./route-error-throttle";

const shouldReportRouteError = createRouteErrorThrottle();

/**
 * Liga o logger de rotas ao Sentry. E chamado pelas configuracoes de servidor e
 * edge apenas quando o Sentry esta habilitado, entao em desenvolvimento (ou sem
 * DSN) nenhum reporter fica registrado e `logRouteEvent` segue sendo so console.
 *
 * O payload recebido ja passou pela sanitizacao de `route-observability`, que
 * usa as mesmas regras de redacao do `sentry-config`.
 *
 * O envio passa por um limite por janela para que uma rajada (webhook reenviado
 * pelo provider enquanto o banco esta fora, por exemplo) nao consuma a cota do
 * Sentry. O console continua registrando todas as ocorrencias, e o primeiro
 * evento apos a janela informa quantas foram suprimidas.
 */
export function registerSentryRouteErrorReporter() {
  setRouteErrorReporter((payload) => {
    const route = typeof payload.route === "string" ? payload.route : "unknown";
    const event = typeof payload.event === "string" ? payload.event : "unknown";

    const decision = shouldReportRouteError(`${route}|${event}`);

    if (!decision.allowed) {
      return;
    }

    Sentry.captureMessage(`[${route}] ${event}`, {
      level: "error",
      fingerprint: [route, event],
      tags: {
        route,
        route_event: event,
      },
      extra:
        decision.suppressed > 0
          ? { ...payload, suppressedSinceLastEvent: decision.suppressed }
          : payload,
    });
  });
}
