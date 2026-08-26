import assert from "node:assert/strict";
import test from "node:test";
import { resolveLoginRedirect } from "../src/lib/auth/login-redirect.ts";

const base = { onboardingCompleted: true, accessReason: "active" };

test("super admin sem next abre o dashboard administrativo", () => {
  assert.equal(resolveLoginRedirect({ ...base, platformRole: "super_admin" }), "/admin/dashboard");
});

test("super admin preserva next administrativo interno", () => {
  assert.equal(resolveLoginRedirect({ ...base, platformRole: "super_admin", nextPath: "/admin/usuarios" }), "/admin/usuarios");
});

test("super admin rejeita next externo", () => {
  assert.equal(resolveLoginRedirect({ ...base, platformRole: "super_admin", nextPath: "https://malicioso.example" }), "/admin/dashboard");
});

test("usuario comum preserva somente next do app", () => {
  assert.equal(resolveLoginRedirect({ ...base, platformRole: "user", nextPath: "/app/precificacao" }), "/app/precificacao");
  assert.equal(resolveLoginRedirect({ ...base, platformRole: "user", nextPath: "/admin/usuarios" }), "/app/precificacao");
});
