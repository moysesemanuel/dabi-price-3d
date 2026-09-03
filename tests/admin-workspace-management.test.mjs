import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditMemberRole,
  canRemoveMember,
  canTransferOwnership,
  editableMemberRoleOptions,
  getWorkspaceManagementError,
  inviteRoleOptions,
  isAdminWorkspaceMemberRole,
} from "../src/lib/auth/admin-workspace-management.ts";

test("owner nao recebe downgrade ou remocao na UI", () => {
  assert.equal(canEditMemberRole("owner"), false);
  assert.equal(canRemoveMember("owner"), false);
  assert.equal(canTransferOwnership("owner"), false);
});

test("membro nao-owner pode ter role alterada e receber transferencia explicita", () => {
  assert.equal(canEditMemberRole("manager"), true);
  assert.equal(canEditMemberRole("operator"), true);
  assert.equal(canTransferOwnership("manager"), true);
  assert.equal(canTransferOwnership("operator"), true);
  assert.deepEqual(editableMemberRoleOptions, ["manager", "operator"]);
});

test("convite e alteracao de role nao aceitam role invalida", () => {
  assert.deepEqual(inviteRoleOptions, ["manager", "operator"]);
  assert.equal(isAdminWorkspaceMemberRole("manager"), true);
  assert.equal(isAdminWorkspaceMemberRole("operator"), true);
  assert.equal(isAdminWorkspaceMemberRole("invalid"), false);
});

test("erros de ownership recebem orientacao explicita", () => {
  assert.equal(
    getWorkspaceManagementError({ action: "role", status: 409, message: "Transfira ownership antes de alterar ou remover o owner." }),
    "Transfira a propriedade antes de alterar ou remover o owner.",
  );
});
