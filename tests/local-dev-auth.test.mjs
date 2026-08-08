import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalDevelopmentSession,
  createLocalDevelopmentPasswordResetToken,
  createLocalDevelopmentSession,
  consumeLocalDevelopmentPasswordResetToken,
  findLocalDevelopmentWorkspaceMemberById,
  inviteLocalDevelopmentWorkspaceMember,
  listLocalDevelopmentWorkspaceMembers,
  resetLocalDevelopmentAuthStateForTests,
  resolveLocalDevelopmentSession,
  updateLocalDevelopmentWorkspaceMemberRole,
  removeLocalDevelopmentWorkspaceMember,
  verifyLocalDevelopmentCredentials,
  verifyLocalDevelopmentPasswordResetToken,
} from "../src/lib/auth/local-dev-auth.ts";

test.beforeEach(() => {
  resetLocalDevelopmentAuthStateForTests();
});

test("admin local default autentica e a sessao pode ser resolvida pelo token", () => {
  assert.equal(
    verifyLocalDevelopmentCredentials({
      email: "admin@dabitech3d.com",
      password: "admin123",
    }),
    true,
  );

  const loginResult = createLocalDevelopmentSession({
    email: "admin@dabitech3d.com",
  });

  assert.ok(loginResult);
  assert.match(loginResult.sessionToken, /^local-dev-session:/);
  assert.equal(
    resolveLocalDevelopmentSession(loginResult.sessionToken)?.user.email,
    "admin@dabitech3d.com",
  );
});

test("convite local ativa membro por token e permite login com a nova senha", () => {
  const invitedMember = inviteLocalDevelopmentWorkspaceMember({
    fullName: "Operadora Local",
    email: "operadora.local@example.com",
    workspaceRole: "operator",
    invitedByUserId: "local-dev-admin",
  });

  assert.equal(invitedMember.userStatus, "invited");
  assert.equal(listLocalDevelopmentWorkspaceMembers().length, 2);

  const issuedToken = createLocalDevelopmentPasswordResetToken({
    email: invitedMember.email,
  });

  assert.ok(issuedToken);
  assert.equal(
    verifyLocalDevelopmentPasswordResetToken(issuedToken.token)?.status,
    "invited",
  );

  const resetResult = consumeLocalDevelopmentPasswordResetToken({
    token: issuedToken.token,
    password: "novaSenha123",
  });

  assert.equal(resetResult?.email, invitedMember.email);
  assert.equal(resetResult?.status, "invited");
  assert.equal(
    verifyLocalDevelopmentCredentials({
      email: invitedMember.email,
      password: "novaSenha123",
    }),
    true,
  );

  const activatedMember = findLocalDevelopmentWorkspaceMemberById(
    invitedMember.membershipId,
  );

  assert.equal(activatedMember?.userStatus, "active");
});

test("owner local pode ser transferido para outro membro", () => {
  const invitedMember = inviteLocalDevelopmentWorkspaceMember({
    fullName: "Gestora Local",
    email: "gestora.local@example.com",
    workspaceRole: "manager",
    invitedByUserId: "local-dev-admin",
  });

  const issuedToken = createLocalDevelopmentPasswordResetToken({
    email: invitedMember.email,
  });

  assert.ok(issuedToken);
  consumeLocalDevelopmentPasswordResetToken({
    token: issuedToken.token,
    password: "gestora123",
  });

  const updatedMember = updateLocalDevelopmentWorkspaceMemberRole({
    membershipId: invitedMember.membershipId,
    workspaceRole: "owner",
  });

  assert.equal(updatedMember?.workspaceRole, "owner");

  const members = listLocalDevelopmentWorkspaceMembers();
  const newOwner = members.find((member) => member.email === invitedMember.email);
  const previousAdmin = members.find(
    (member) => member.email === "admin@dabitech3d.com",
  );

  assert.equal(newOwner?.isWorkspaceOwner, true);
  assert.equal(previousAdmin?.workspaceRole, "manager");
});

test("remocao local elimina membro da lista do workspace", () => {
  const invitedMember = inviteLocalDevelopmentWorkspaceMember({
    fullName: "Operadora para Remocao",
    email: "remocao.local@example.com",
    workspaceRole: "operator",
    invitedByUserId: "local-dev-admin",
  });

  const removedMember = removeLocalDevelopmentWorkspaceMember({
    membershipId: invitedMember.membershipId,
  });

  assert.equal(removedMember?.email, invitedMember.email);
  assert.equal(
    listLocalDevelopmentWorkspaceMembers().some(
      (member) => member.email === invitedMember.email,
    ),
    false,
  );
  assert.equal(buildLocalDevelopmentSession().user.email, "admin@dabitech3d.com");
});
