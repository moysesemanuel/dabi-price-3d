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

export function resetRateLimitStateForTests() {
  rateLimitWindows.clear();
}

export function consumeRateLimit(
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
