import assert from "node:assert/strict";
import test from "node:test";

import { createRouteErrorThrottle } from "../src/lib/observability/route-error-throttle.ts";

function createClock(startAt = 1_000_000) {
  let current = startAt;

  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

test("permite eventos ate o limite da janela", () => {
  const clock = createClock();
  const shouldReport = createRouteErrorThrottle({
    windowMs: 60_000,
    maxPerWindow: 3,
    now: clock.now,
  });

  assert.deepEqual(shouldReport("rota|evento"), { allowed: true, suppressed: 0 });
  assert.deepEqual(shouldReport("rota|evento"), { allowed: true, suppressed: 0 });
  assert.deepEqual(shouldReport("rota|evento"), { allowed: true, suppressed: 0 });
});

test("bloqueia eventos acima do limite dentro da mesma janela", () => {
  const clock = createClock();
  const shouldReport = createRouteErrorThrottle({
    windowMs: 60_000,
    maxPerWindow: 2,
    now: clock.now,
  });

  shouldReport("rota|evento");
  shouldReport("rota|evento");

  clock.advance(1_000);

  assert.deepEqual(shouldReport("rota|evento"), { allowed: false });
  assert.deepEqual(shouldReport("rota|evento"), { allowed: false });
});

test("libera de novo na janela seguinte e informa quantos foram suprimidos", () => {
  const clock = createClock();
  const shouldReport = createRouteErrorThrottle({
    windowMs: 60_000,
    maxPerWindow: 1,
    now: clock.now,
  });

  shouldReport("rota|evento");
  shouldReport("rota|evento");
  shouldReport("rota|evento");

  clock.advance(60_000);

  assert.deepEqual(shouldReport("rota|evento"), { allowed: true, suppressed: 2 });
});

test("o contador de suprimidos zera depois de ser reportado", () => {
  const clock = createClock();
  const shouldReport = createRouteErrorThrottle({
    windowMs: 60_000,
    maxPerWindow: 1,
    now: clock.now,
  });

  shouldReport("rota|evento");
  shouldReport("rota|evento");

  clock.advance(60_000);
  assert.deepEqual(shouldReport("rota|evento"), { allowed: true, suppressed: 1 });

  clock.advance(60_000);
  assert.deepEqual(shouldReport("rota|evento"), { allowed: true, suppressed: 0 });
});

test("cada par rota/evento tem orcamento independente", () => {
  const clock = createClock();
  const shouldReport = createRouteErrorThrottle({
    windowMs: 60_000,
    maxPerWindow: 1,
    now: clock.now,
  });

  assert.equal(shouldReport("webhook|falhou").allowed, true);
  assert.equal(shouldReport("webhook|falhou").allowed, false);
  assert.equal(shouldReport("checkout|falhou").allowed, true);
});

test("chaves ociosas por muitas janelas sao descartadas e voltam do zero", () => {
  const clock = createClock();
  const shouldReport = createRouteErrorThrottle({
    windowMs: 60_000,
    maxPerWindow: 1,
    now: clock.now,
  });

  shouldReport("rota|evento");
  shouldReport("rota|evento");

  clock.advance(60_000 * 10);

  assert.deepEqual(shouldReport("rota|evento"), { allowed: true, suppressed: 0 });
});
