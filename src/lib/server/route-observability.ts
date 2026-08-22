import { randomUUID } from "node:crypto";

export type RouteLogLevel = "info" | "warn" | "error";

export type RouteRequestContext = {
  route: string;
  requestId: string;
  method: string;
  pathname: string;
  startedAt: number;
};

const REDACTED_LOG_VALUE = "[REDACTED]";
const sensitiveLogFieldPattern =
  /^(?:authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|cookie|signature|code[-_]?(?:verifier|challenge)|qr[-_]?code|(?:payer[-_]?|user[-_]?)?email)$/i;
const sensitiveLogValuePatterns = [
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /((?:access[-_]?token|refresh[-_]?token|token|secret|password|authorization|cookie|signature|code[-_]?(?:verifier|challenge))\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,}&]+)/gi,
  /([?&](?:access_token|refresh_token|token|secret|password|code_verifier|code_challenge)=)[^&#\s]+/gi,
];

export function createRouteRequestContext(
  request: Request,
  route: string,
): RouteRequestContext {
  const url = new URL(request.url);

  return {
    route,
    requestId:
      request.headers.get("x-request-id")?.trim() ||
      request.headers.get("x-vercel-id")?.trim() ||
      randomUUID(),
    method: request.method,
    pathname: url.pathname,
    startedAt: Date.now(),
  };
}

export function logRouteEvent(
  context: RouteRequestContext,
  level: RouteLogLevel,
  event: string,
  details?: Record<string, unknown>,
) {
  const payload = {
    ts: new Date().toISOString(),
    route: context.route,
    requestId: context.requestId,
    method: context.method,
    pathname: context.pathname,
    durationMs: Date.now() - context.startedAt,
    event,
    ...(details ? sanitizeLogObject(details) : {}),
  };

  console[level](`[${context.route}] ${event}`, payload);
}

export function jsonWithRequestId(
  context: RouteRequestContext,
  body: Record<string, unknown>,
  init?: ResponseInit,
) {
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", context.requestId);

  return Response.json(
    {
      ...body,
      requestId: context.requestId,
    },
    {
      ...init,
      headers,
    },
  );
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeLogString(error.message),
      stack: sanitizeLogString(error.stack?.split("\n").slice(0, 5).join("\n")),
    };
  }

  if (typeof error === "string") {
    return { message: sanitizeLogString(error) };
  }

  return {
    message: "Unknown error",
    value: sanitizeUnknownValue(error),
  };
}

function sanitizeLogObject(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      isSensitiveLogField(key) ? REDACTED_LOG_VALUE : sanitizeUnknownValue(value),
    ]),
  );
}

function isSensitiveLogField(key: string) {
  return sensitiveLogFieldPattern.test(key.trim());
}

function sanitizeLogString(value: string | undefined) {
  if (!value) {
    return value;
  }

  return sensitiveLogValuePatterns.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, `$1${REDACTED_LOG_VALUE}`),
    value,
  );
}

function sanitizeUnknownValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string"
  ) {
    return sanitizeLogString(value);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknownValue(item));
  }

  if (value instanceof Error) {
    return serializeError(value);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        isSensitiveLogField(key)
          ? REDACTED_LOG_VALUE
          : sanitizeUnknownValue(nestedValue),
      ]),
    );
  }

  return String(value);
}
