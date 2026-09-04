import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin shell reutiliza os tokens de design da landing", async () => {
  const [layout, styles] = await Promise.all([
    readFile(new URL("../src/app/admin/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /admin-shell landing-root/);
  assert.match(styles, /\.admin-shell\s*\{[\s\S]*--admin-surface:\s*var\(--landing-surface\)/);
  assert.match(styles, /--admin-radius:\s*var\(--landing-radius\)/);
  assert.match(styles, /--admin-font-display:\s*var\(--font-display-ui\)/);
});
