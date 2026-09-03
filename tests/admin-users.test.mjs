import assert from "node:assert/strict";
import test from "node:test";
import { canChangeAdminUserStatus, getAdminUserManagementError } from "../src/lib/auth/admin-user-management.ts";
import { isAdminUserActionPayload, mapAdminUserMutationStatus } from "../src/lib/auth/admin-user-route-contract.ts";

test("UI bloqueia desativacao da ultima conta super admin ativa", () => {
  assert.equal(canChangeAdminUserStatus({ userId: "admin", currentUserId: "other", platformRole: "super_admin", userStatus: "active", activeSuperAdmins: 1 }), false);
  assert.equal(canChangeAdminUserStatus({ userId: "admin", currentUserId: "other", platformRole: "super_admin", userStatus: "active", activeSuperAdmins: 2 }), true);
});

test("UI bloqueia auto desativacao e permite reativacao", () => {
  assert.equal(canChangeAdminUserStatus({ userId: "self", currentUserId: "self", platformRole: "user", userStatus: "active", activeSuperAdmins: 1 }), false);
  assert.equal(canChangeAdminUserStatus({ userId: "self", currentUserId: "self", platformRole: "user", userStatus: "disabled", activeSuperAdmins: 1 }), true);
});

test("erros de rota administrativos recebem mensagens consistentes", () => {
  assert.equal(getAdminUserManagementError({ action: "status", status: 404 }), "Usuario nao encontrado. Atualize a pagina.");
  assert.equal(getAdminUserManagementError({ action: "sessions", status: 403 }), "Esta acao e exclusiva para super admin.");
});

test("contrato da rota PATCH rejeita payloads invalidos e mapeia protecoes", () => {
  assert.equal(isAdminUserActionPayload({ action: "set_status", status: "disabled" }), true);
  assert.equal(isAdminUserActionPayload({ action: "set_status", status: "invalid" }), false);
  assert.equal(isAdminUserActionPayload({ action: "unknown" }), false);
  assert.equal(mapAdminUserMutationStatus(new Error("FORBIDDEN_ADMIN_USERS")), 403);
  assert.equal(mapAdminUserMutationStatus(new Error("LAST_SUPER_ADMIN_PROTECTED")), 409);
});
