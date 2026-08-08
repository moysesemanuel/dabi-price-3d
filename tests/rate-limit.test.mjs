import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeRateLimit,
  getClientIpAddress,
  resetRateLimitStateForTests,
} from "../src/lib/server/rate-limit.ts";

test.beforeEach(() => {
  resetRateLimitStateForTests();
});

test("rate limit bloqueia apos exceder a janela", () => {
  const first = consumeRateLimit({
    key: "recovery:ip:127.0.0.1",
    maxAttempts: 3,
    windowMs: 60_000,
  });
  const second = consumeRateLimit({
    key: "recovery:ip:127.0.0.1",
    maxAttempts: 3,
    windowMs: 60_000,
  });
  const third = consumeRateLimit({
    key: "recovery:ip:127.0.0.1",
    maxAttempts: 3,
    windowMs: 60_000,
  });
  const blocked = consumeRateLimit({
    key: "recovery:ip:127.0.0.1",
    maxAttempts: 3,
    windowMs: 60_000,
  });

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 2);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 1);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterSeconds >= 1);
});

test("rate limit reseta estado entre cenarios de teste", () => {
  const allowed = consumeRateLimit({
    key: "recovery:token:abc",
    maxAttempts: 1,
    windowMs: 60_000,
  });

  assert.equal(allowed.allowed, true);

  resetRateLimitStateForTests();

  const afterReset = consumeRateLimit({
    key: "recovery:token:abc",
    maxAttempts: 1,
    windowMs: 60_000,
  });

  assert.equal(afterReset.allowed, true);
  assert.equal(afterReset.remaining, 0);
});

test("getClientIpAddress prioriza x-forwarded-for", () => {
  const ip = getClientIpAddress(
    new Request("http://127.0.0.1:3005/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "cf-connecting-ip": "198.51.100.9",
      },
    }),
  );

  assert.equal(ip, "203.0.113.10");
});

test("getClientIpAddress usa fallback do provedor ou unknown", () => {
  const providerIp = getClientIpAddress(
    new Request("http://127.0.0.1:3005/api/test", {
      headers: {
        "cf-connecting-ip": "198.51.100.9",
      },
    }),
  );
  const unknownIp = getClientIpAddress(
    new Request("http://127.0.0.1:3005/api/test"),
  );

  assert.equal(providerIp, "198.51.100.9");
  assert.equal(unknownIp, "unknown");
});
