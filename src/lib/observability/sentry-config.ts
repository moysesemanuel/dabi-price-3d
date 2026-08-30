export type SentryEnvironment = "production" | "preview" | "hml" | "development";

const REDACTED_VALUE = "[REDACTED]";
const sensitiveFieldPattern =
  /^(?:authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|token|secret|password|cookie|signature|code[-_]?(?:verifier|challenge)|qr[-_]?code|(?:payer[-_]?|user[-_]?)?email)$/i;
const sensitiveValuePatterns = [
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /((?:access[-_]?token|refresh[-_]?token|token|secret|password|authorization|cookie|signature|code[-_]?(?:verifier|challenge))\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,}&]+)/gi,
  /([?&](?:access_token|refresh_token|token|secret|password|code_verifier|code_challenge)=)[^&#\s]+/gi,
];

type SentryConfigInput = {
  dsn?: string;
  vercelEnv?: string;
  sentryEnvironment?: string;
  release?: string;
};

export function resolveSentryEnvironment(
  input: Pick<SentryConfigInput, "vercelEnv" | "sentryEnvironment">,
): SentryEnvironment {
  if (input.sentryEnvironment === "hml") {
    return "hml";
  }

  if (input.vercelEnv === "production") {
    return "production";
  }

  if (input.vercelEnv === "preview") {
    return "preview";
  }

  return "development";
}

export function isSentryEnabled(
  input: Pick<SentryConfigInput, "dsn"> & {
    environment: SentryEnvironment;
  },
): boolean {
  return Boolean(input.dsn?.trim()) && input.environment !== "development";
}

export function isSentrySourceMapUploadEnabled(input: {
  authToken?: string;
  isVercel: boolean;
  org?: string;
  project?: string;
}): boolean {
  return (
    input.isVercel &&
    Boolean(input.authToken?.trim()) &&
    Boolean(input.org?.trim()) &&
    Boolean(input.project?.trim())
  );
}

export function createSentryOptions(input: SentryConfigInput): {
  dsn: string;
  environment: SentryEnvironment;
  release?: string;
  sendDefaultPii: false;
} | null {
  const environment = resolveSentryEnvironment(input);

  if (!isSentryEnabled({ dsn: input.dsn, environment })) {
    return null;
  }

  return {
    dsn: input.dsn!.trim(),
    environment,
    ...(input.release?.trim() ? { release: input.release.trim() } : {}),
    sendDefaultPii: false,
  };
}

export function sanitizeSentryEvent<
  T extends {
    request?: unknown;
    user?: unknown;
  },
>(event: T): Omit<T, "request" | "user"> {
  const safeEvent = sanitizeSentryValue(event) as T;

  delete safeEvent.request;
  delete safeEvent.user;

  return safeEvent;
}

function sanitizeSentryValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sensitiveValuePatterns.reduce(
      (sanitized, pattern) => sanitized.replace(pattern, `$1${REDACTED_VALUE}`),
      value,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSentryValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sensitiveFieldPattern.test(key.trim())
          ? REDACTED_VALUE
          : sanitizeSentryValue(nestedValue),
      ]),
    );
  }

  return value;
}
