import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalDevelopmentSession,
  createLocalDevelopmentPasswordResetToken,
  createLocalDevelopmentSession,
  consumeLocalDevelopmentPasswordResetToken,
  findLocalDevelopmentWorkspaceMemberById,
  getLocalDevelopmentBootstrapConfig,
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

const bootstrapConfig = getLocalDevelopmentBootstrapConfig();
const operatorResetPassword = buildTestPassword("operator");
const managerResetPassword = buildTestPassword("manager");

test("admin local default autentica e a sessao pode ser resolvida pelo token", () => {
  assert.equal(
    verifyLocalDevelopmentCredentials({
      email: bootstrapConfig.email,
      password: bootstrapConfig.password,
    }),
    true,
  );

  const loginResult = createLocalDevelopmentSession({
    email: bootstrapConfig.email,
  });

  assert.ok(loginResult);
  assert.match(loginResult.sessionToken, /^local-dev-session:/);
  assert.equal(
    resolveLocalDevelopmentSession(loginResult.sessionToken)?.user.email,
    bootstrapConfig.email,
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
    password: operatorResetPassword,
  });

  assert.equal(resetResult?.email, invitedMember.email);
  assert.equal(resetResult?.status, "invited");
  assert.equal(
    verifyLocalDevelopmentCredentials({
      email: invitedMember.email,
      password: operatorResetPassword,
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
    password: managerResetPassword,
  });

  const updatedMember = updateLocalDevelopmentWorkspaceMemberRole({
    membershipId: invitedMember.membershipId,
    workspaceRole: "owner",
  });

  assert.equal(updatedMember?.workspaceRole, "owner");

  const members = listLocalDevelopmentWorkspaceMembers();
  const newOwner = members.find((member) => member.email === invitedMember.email);
  const previousAdmin = members.find(
    (member) => member.email === bootstrapConfig.email,
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
  assert.equal(buildLocalDevelopmentSession().user.email, bootstrapConfig.email);
});

function buildTestPassword(label) {
  return `test-${label}-password-123`;
}
