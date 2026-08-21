import { createHash } from "node:crypto";
import { getSql, hasDatabaseUrl } from "./neon.ts";

type RateLimitWindow = {
  count: number;
  resetAt: number;
};

type ConsumeRateLimitInput = {
  key: string;
  maxAttempts: number;
  windowMs: number;
};

type ConsumeRateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const rateLimitWindows = new Map<string, RateLimitWindow>();
let rateLimitStoreInitialization: Promise<void> | null = null;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastRateLimitCleanupAt = 0;

export function resetRateLimitStateForTests() {
  rateLimitWindows.clear();
}

export async function consumeRateLimit(
  input: ConsumeRateLimitInput,
): Promise<ConsumeRateLimitResult> {
  if (hasDatabaseUrl()) {
    return consumeDatabaseRateLimit(input);
  }

  return consumeInMemoryRateLimit(input);
}

export async function getRateLimitStatus(
  input: ConsumeRateLimitInput,
): Promise<ConsumeRateLimitResult> {
  if (hasDatabaseUrl()) {
    return getDatabaseRateLimitStatus(input);
  }

  return getInMemoryRateLimitStatus(input);
}

function consumeInMemoryRateLimit(
  input: ConsumeRateLimitInput,
): ConsumeRateLimitResult {
  const now = Date.now();
  const currentWindow = rateLimitWindows.get(input.key);

  if (!currentWindow || currentWindow.resetAt <= now) {
    const nextWindow: RateLimitWindow = {
      count: 1,
      resetAt: now + input.windowMs,
    };

    rateLimitWindows.set(input.key, nextWindow);

    return {
      allowed: true,
      remaining: Math.max(0, input.maxAttempts - 1),
      retryAfterSeconds: Math.ceil(input.windowMs / 1000),
    };
  }

  if (currentWindow.count >= input.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((currentWindow.resetAt - now) / 1000),
      ),
    };
  }

  currentWindow.count += 1;
  rateLimitWindows.set(input.key, currentWindow);

  return {
    allowed: true,
    remaining: Math.max(0, input.maxAttempts - currentWindow.count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((currentWindow.resetAt - now) / 1000),
    ),
  };
}

function getInMemoryRateLimitStatus(
  input: ConsumeRateLimitInput,
): ConsumeRateLimitResult {
  const now = Date.now();
  const currentWindow = rateLimitWindows.get(input.key);

  if (!currentWindow || currentWindow.resetAt <= now) {
    return {
      allowed: true,
      remaining: input.maxAttempts,
      retryAfterSeconds: Math.ceil(input.windowMs / 1000),
    };
  }

  return {
    allowed: currentWindow.count < input.maxAttempts,
    remaining: Math.max(0, input.maxAttempts - currentWindow.count),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((currentWindow.resetAt - now) / 1000),
    ),
  };
}

async function consumeDatabaseRateLimit(
  input: ConsumeRateLimitInput,
): Promise<ConsumeRateLimitResult> {
  await ensureRateLimitStore();
  await cleanupExpiredRateLimitsIfDue();

  const sql = getSql();
  const keyHash = createHash("sha256").update(input.key).digest("hex");
  const rows = (await sql`
    INSERT INTO api_rate_limits (
      rate_limit_key,
      attempts,
      reset_at
    )
    VALUES (
      ${keyHash},
      1,
      NOW() + (${input.windowMs} * INTERVAL '1 millisecond')
    )
    ON CONFLICT (rate_limit_key) DO UPDATE SET
      attempts = CASE
        WHEN api_rate_limits.reset_at <= NOW() THEN 1
        ELSE api_rate_limits.attempts + 1
      END,
      reset_at = CASE
        WHEN api_rate_limits.reset_at <= NOW()
          THEN NOW() + (${input.windowMs} * INTERVAL '1 millisecond')
        ELSE api_rate_limits.reset_at
      END
    RETURNING attempts, reset_at
  `) as Array<{ attempts: number; reset_at: string }>;
  const result = rows[0];

  if (!result) {
    throw new Error("RATE_LIMIT_STORE_WRITE_FAILED");
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(result.reset_at).getTime() - Date.now()) / 1000),
  );
  const attempts = Number(result.attempts);

  return {
    allowed: attempts <= input.maxAttempts,
    remaining: Math.max(0, input.maxAttempts - attempts),
    retryAfterSeconds,
  };
}

async function getDatabaseRateLimitStatus(
  input: ConsumeRateLimitInput,
): Promise<ConsumeRateLimitResult> {
  await ensureRateLimitStore();

  const sql = getSql();
  const keyHash = createHash("sha256").update(input.key).digest("hex");
  const rows = (await sql`
    SELECT attempts, reset_at
    FROM api_rate_limits
    WHERE rate_limit_key = ${keyHash}
  `) as Array<{ attempts: number; reset_at: string }>;
  const result = rows[0];
  const now = Date.now();

  if (!result || new Date(result.reset_at).getTime() <= now) {
    return {
      allowed: true,
      remaining: input.maxAttempts,
      retryAfterSeconds: Math.ceil(input.windowMs / 1000),
    };
  }

  const attempts = Number(result.attempts);

  return {
    allowed: attempts < input.maxAttempts,
    remaining: Math.max(0, input.maxAttempts - attempts),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((new Date(result.reset_at).getTime() - now) / 1000),
    ),
  };
}

async function ensureRateLimitStore() {
  if (!rateLimitStoreInitialization) {
    rateLimitStoreInitialization = (async () => {
      const sql = getSql();

      await sql`
        CREATE TABLE IF NOT EXISTS api_rate_limits (
          rate_limit_key TEXT PRIMARY KEY,
          attempts INTEGER NOT NULL,
          reset_at TIMESTAMPTZ NOT NULL
        )
      `;
    })();
  }

  return rateLimitStoreInitialization;
}

async function cleanupExpiredRateLimitsIfDue() {
  const now = Date.now();

  if (now - lastRateLimitCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) {
    return;
  }

  lastRateLimitCleanupAt = now;
  const sql = getSql();

  // Retain only recent windows without adding work to every request.
  await sql`
    DELETE FROM api_rate_limits
    WHERE reset_at < NOW() - INTERVAL '1 day'
  `;
}

export function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const providerIp =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip");

  return providerIp?.trim() || "unknown";
}
