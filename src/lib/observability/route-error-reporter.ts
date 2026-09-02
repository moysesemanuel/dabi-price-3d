import * as Sentry from "@sentry/nextjs";

import { setRouteErrorReporter } from "../server/route-observability";

/**
 * Liga o logger de rotas ao Sentry. E chamado pelas configuracoes de servidor e
 * edge apenas quando o Sentry esta habilitado, entao em desenvolvimento (ou sem
 * DSN) nenhum reporter fica registrado e `logRouteEvent` segue sendo so console.
 *
 * O payload recebido ja passou pela sanitizacao de `route-observability`, que
 * usa as mesmas regras de redacao do `sentry-config`.
 */
export function registerSentryRouteErrorReporter() {
  setRouteErrorReporter((payload) => {
    const route = typeof payload.route === "string" ? payload.route : "unknown";
    const event = typeof payload.event === "string" ? payload.event : "unknown";

    Sentry.captureMessage(`[${route}] ${event}`, {
      level: "error",
      fingerprint: [route, event],
      tags: {
        route,
        route_event: event,
      },
      extra: payload,
    });
  });
}
