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
  listLocalDevelopmentPlatformUsers,
  removeLocalDevelopmentPlatformUser,
  resetLocalDevelopmentAuthStateForTests,
  resolveLocalDevelopmentSession,
  updateLocalDevelopmentPlatformUserProfile,
  updateLocalDevelopmentWorkspaceMemberProfile,
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
    consumeLocalDevelopmentPasswordResetToken({
      token: issuedToken.token,
      password: operatorResetPassword,
    }),
    null,
  );
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

test("super admin local pode corrigir nome e email do usuario", () => {
  const invitedMember = inviteLocalDevelopmentWorkspaceMember({
    fullName: "Operadora Antiga",
    email: "operadora.antiga@example.com",
    workspaceRole: "operator",
    invitedByUserId: "local-dev-admin",
  });
  const issuedToken = createLocalDevelopmentPasswordResetToken({
    email: invitedMember.email,
  });

  assert.ok(issuedToken);
  const updatedMember = updateLocalDevelopmentWorkspaceMemberProfile({
    membershipId: invitedMember.membershipId,
    fullName: "Operadora Corrigida",
    email: "operadora.corrigida@example.com",
  });

  assert.equal(updatedMember?.fullName, "Operadora Corrigida");
  assert.equal(updatedMember?.email, "operadora.corrigida@example.com");
  assert.equal(
    listLocalDevelopmentWorkspaceMembers().some(
      (member) => member.email === "operadora.corrigida@example.com",
    ),
    true,
  );
  assert.equal(
    verifyLocalDevelopmentPasswordResetToken(issuedToken.token)?.email,
    "operadora.corrigida@example.com",
  );
});

test("listagem administrativa local retorna usuarios com workspace principal", () => {
  inviteLocalDevelopmentWorkspaceMember({
    fullName: "Operadora de Suporte",
    email: "suporte.local@example.com",
    workspaceRole: "operator",
    invitedByUserId: "local-dev-admin",
  });

  const users = listLocalDevelopmentPlatformUsers();
  const adminUser = users.find((user) => user.userId === "local-dev-admin");
  const invitedUser = users.find(
    (user) => user.email === "suporte.local@example.com",
  );

  assert.equal(users.length, 2);
  assert.equal(adminUser?.platformRole, "super_admin");
  assert.equal(invitedUser?.primaryWorkspaceRole, "operator");
  assert.equal(invitedUser?.primaryWorkspaceId, "local-dev-workspace");
});

test("edicao administrativa local atualiza usuario por userId", () => {
  const invitedMember = inviteLocalDevelopmentWorkspaceMember({
    fullName: "Operadora Base",
    email: "operadora.base@example.com",
    workspaceRole: "operator",
    invitedByUserId: "local-dev-admin",
  });

  const updatedUser = updateLocalDevelopmentPlatformUserProfile({
    userId: invitedMember.userId,
    fullName: "Operadora Ajustada",
    email: "operadora.ajustada@example.com",
  });

  assert.equal(updatedUser?.fullName, "Operadora Ajustada");
  assert.equal(updatedUser?.email, "operadora.ajustada@example.com");
});

test("exclusao administrativa local remove usuario comum", () => {
  const invitedMember = inviteLocalDevelopmentWorkspaceMember({
    fullName: "Operadora Excluivel",
    email: "operadora.excluir@example.com",
    workspaceRole: "operator",
    invitedByUserId: "local-dev-admin",
  });

  const removedUser = removeLocalDevelopmentPlatformUser({
    userId: invitedMember.userId,
  });

  assert.equal(removedUser?.email, "operadora.excluir@example.com");
  assert.equal(
    listLocalDevelopmentPlatformUsers().some(
      (user) => user.email === "operadora.excluir@example.com",
    ),
    false,
  );
});

test("exclusao administrativa local bloqueia owner do workspace", () => {
  assert.throws(
    () =>
      removeLocalDevelopmentPlatformUser({
        userId: "local-dev-admin",
      }),
    /OWNER_USER_DELETE_FORBIDDEN/,
  );
});

function buildTestPassword(label) {
  return `test-${label}-password-123`;
}
