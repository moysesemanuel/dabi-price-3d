import assert from "node:assert/strict";
import test from "node:test";
import {
  canAssignWorkspaceRole,
  canManageWorkspaceBilling,
  canRemoveWorkspaceMember,
  getAllowedInviteRoles,
  getMemberManagementPermissions,
  normalizeWorkspaceRole,
} from "../src/lib/auth/access-control.ts";

function createSession(overrides = {}) {
  return {
    sessionId: "test-session",
    user: {
      id: "user-1",
      email: "user@example.com",
      fullName: "User Test",
      platformRole: "user",
      status: "active",
      ...overrides.user,
    },
    workspace: {
      id: "workspace-1",
      name: "Workspace Test",
      slug: "workspace-test",
      role: "operator",
      ...overrides.workspace,
    },
  };
}

test("normaliza papel legado finance para operator", () => {
  assert.equal(normalizeWorkspaceRole("finance"), "operator");
  assert.equal(normalizeWorkspaceRole("owner"), "owner");
  assert.equal(normalizeWorkspaceRole("manager"), "manager");
  assert.equal(normalizeWorkspaceRole("qualquer-coisa"), "operator");
});

test("owner pode convidar manager e operator", () => {
  const session = createSession({
    workspace: {
      role: "owner",
    },
  });

  assert.deepEqual(getAllowedInviteRoles(session), ["manager", "operator"]);
  assert.equal(getMemberManagementPermissions(session).canTransferOwnership, true);
});

test("manager pode convidar apenas operator", () => {
  const session = createSession({
    workspace: {
      role: "manager",
    },
  });

  assert.deepEqual(getAllowedInviteRoles(session), ["operator"]);
  assert.equal(getMemberManagementPermissions(session).canTransferOwnership, false);
});

test("super admin ignora limites de convite do papel do workspace", () => {
  const session = createSession({
    user: {
      platformRole: "super_admin",
    },
    workspace: {
      role: "operator",
    },
  });

  assert.deepEqual(getAllowedInviteRoles(session), ["manager", "operator"]);
  assert.equal(getMemberManagementPermissions(session).canManageMembers, true);
  assert.equal(getMemberManagementPermissions(session).canEditUserProfiles, true);
});

test("owner pode gerenciar billing do workspace", () => {
  const session = createSession({
    workspace: {
      role: "owner",
    },
  });

  assert.equal(canManageWorkspaceBilling(session), true);
});

test("super admin pode gerenciar billing independentemente do papel no workspace", () => {
  const session = createSession({
    user: {
      platformRole: "super_admin",
    },
    workspace: {
      role: "operator",
    },
  });

  assert.equal(canManageWorkspaceBilling(session), true);
});

test("manager nao pode gerenciar billing do workspace", () => {
  const session = createSession({
    workspace: {
      role: "manager",
    },
  });

  assert.equal(canManageWorkspaceBilling(session), false);
});

test("operator nao pode gerenciar billing do workspace", () => {
  const session = createSession({
    workspace: {
      role: "operator",
    },
  });

  assert.equal(canManageWorkspaceBilling(session), false);
});

test("owner nao recebe permissao de editar dados cadastrais de usuario", () => {
  const session = createSession({
    workspace: {
      role: "owner",
    },
  });

  assert.equal(getMemberManagementPermissions(session).canEditUserProfiles, false);
});

test("owner nao pode rebaixar owner atual, mas pode promover manager para owner", () => {
  const ownerSession = createSession({
    workspace: {
      role: "owner",
    },
  });

  assert.equal(
    canAssignWorkspaceRole({
      actor: ownerSession,
      currentRole: "owner",
      nextRole: "manager",
      isCurrentUser: true,
    }),
    false,
  );

  assert.equal(
    canAssignWorkspaceRole({
      actor: ownerSession,
      currentRole: "manager",
      nextRole: "owner",
      isCurrentUser: false,
    }),
    true,
  );
});

test("manager nao pode promover outro manager nem trocar ownership", () => {
  const managerSession = createSession({
    workspace: {
      role: "manager",
    },
  });

  assert.equal(
    canAssignWorkspaceRole({
      actor: managerSession,
      currentRole: "operator",
      nextRole: "manager",
      isCurrentUser: false,
    }),
    false,
  );

  assert.equal(
    canAssignWorkspaceRole({
      actor: managerSession,
      currentRole: "operator",
      nextRole: "owner",
      isCurrentUser: false,
    }),
    false,
  );
});

test("regras de remocao respeitam owner e auto-remocao", () => {
  const ownerSession = createSession({
    workspace: {
      role: "owner",
    },
  });
  const managerSession = createSession({
    workspace: {
      role: "manager",
    },
  });
  const superAdminSession = createSession({
    user: {
      platformRole: "super_admin",
    },
    workspace: {
      role: "manager",
    },
  });

  assert.equal(
    canRemoveWorkspaceMember({
      actor: ownerSession,
      targetRole: "manager",
      isCurrentUser: false,
    }),
    true,
  );
  assert.equal(
    canRemoveWorkspaceMember({
      actor: ownerSession,
      targetRole: "owner",
      isCurrentUser: false,
    }),
    false,
  );
  assert.equal(
    canRemoveWorkspaceMember({
      actor: managerSession,
      targetRole: "operator",
      isCurrentUser: false,
    }),
    true,
  );
  assert.equal(
    canRemoveWorkspaceMember({
      actor: managerSession,
      targetRole: "manager",
      isCurrentUser: false,
    }),
    false,
  );
  assert.equal(
    canRemoveWorkspaceMember({
      actor: superAdminSession,
      targetRole: "owner",
      isCurrentUser: false,
    }),
    false,
  );
});
