import assert from "node:assert/strict";
import test from "node:test";
import { resolveAppRouteProtection } from "../src/lib/auth/app-route-protection.ts";

test("protege /app sem sessao e preserva a rota de retorno", () => {
  const result = resolveAppRouteProtection({
    hasSession: false,
    requestUrl: "http://127.0.0.1:3005/app/precificacao?canal=mercado-livre",
    pathname: "/app/precificacao",
    search: "?canal=mercado-livre",
  });

  assert.equal(result.type, "redirect");
  assert.equal(
    result.redirectUrl,
    "http://127.0.0.1:3005/login?next=%2Fapp%2Fprecificacao%3Fcanal%3Dmercado-livre",
  );
});

test("libera /app quando a sessao existe", () => {
  const result = resolveAppRouteProtection({
    hasSession: true,
    requestUrl: "http://127.0.0.1:3005/app/precificacao",
    pathname: "/app/precificacao",
    search: "",
  });

  assert.equal(result.type, "allow");
  assert.equal(result.redirectUrl, null);
});
