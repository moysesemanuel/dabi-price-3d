import "server-only";

import {
  canAssignWorkspaceRole,
  canRemoveWorkspaceMember,
  describeWorkspaceAccessLevel,
  getAllowedInviteRoles,
  getMemberManagementPermissions,
  isSuperAdminSession,
  normalizeWorkspaceRole,
} from "@/lib/auth/access-control";
import {
  createLocalDevelopmentPasswordResetToken,
  findLocalDevelopmentWorkspaceMemberById,
  inviteLocalDevelopmentWorkspaceMember,
  listLocalDevelopmentWorkspaceMembers,
  removeLocalDevelopmentWorkspaceMember,
  updateLocalDevelopmentWorkspaceMemberProfile,
  updateLocalDevelopmentWorkspaceMemberRole,
  type LocalDevWorkspaceMember,
} from "@/lib/auth/local-dev-auth";
import {
  appendAuditEvent,
  findWorkspaceMemberById,
  inviteWorkspaceMember,
  issuePasswordResetToken,
  isPlatformPersistenceAvailable,
  listWorkspaceMembers,
  removeWorkspaceMember,
  type AuthenticatedWorkspaceSession,
  type WorkspaceMemberRecord,
  updateWorkspaceMemberProfile,
  updateWorkspaceMemberRole,
} from "@/lib/server/platform";
import { sendTransactionalEmail } from "@/lib/server/email";
import { workspaceRoleMeta } from "@/lib/workspace/catalog";

export async function getWorkspaceMembersSnapshot(
  session: AuthenticatedWorkspaceSession,
) {
  const members = isPlatformPersistenceAvailable()
    ? await listWorkspaceMembers(session.workspace.id)
    : listLocalDevelopmentWorkspaceMembers();

  return {
    session: {
      user: session.user,
      workspace: session.workspace,
      access: describeWorkspaceAccessLevel({
        platformRole: session.user.platformRole,
        workspaceRole: session.workspace.role,
      }),
    },
    permissions: {
      ...getMemberManagementPermissions(session),
      allowedInviteRoles: getAllowedInviteRoles(session),
    },
    summary: buildWorkspaceMembersSummary(members),
    members,
  };
}

export async function inviteWorkspaceMemberForSession(input: {
  session: AuthenticatedWorkspaceSession;
  fullName: string;
  email: string;
  workspaceRole: string;
  baseUrl: string;
}) {
  const allowedInviteRoles = getAllowedInviteRoles(input.session);
  const normalizedRole = normalizeWorkspaceRole(input.workspaceRole);

  if (!allowedInviteRoles.includes(normalizedRole)) {
    throw new Error("FORBIDDEN_ROLE_ASSIGNMENT");
  }

  const member = isPlatformPersistenceAvailable()
    ? await inviteWorkspaceMember({
        workspaceId: input.session.workspace.id,
        fullName: input.fullName,
        email: input.email,
        workspaceRole: normalizedRole,
        invitedByUserId: input.session.user.id,
      })
    : inviteLocalDevelopmentWorkspaceMember({
        fullName: input.fullName,
        email: input.email,
        workspaceRole: normalizedRole,
        invitedByUserId: input.session.user.id,
      });
  const issuedToken = isPlatformPersistenceAvailable()
    ? await issuePasswordResetToken(member.email, {
        allowedStatuses: ["active", "invited"],
      })
    : createLocalDevelopmentPasswordResetToken({
        email: member.email,
      });

  if (!issuedToken) {
    throw new Error("INVITE_TOKEN_ISSUE_FAILED");
  }

  const inviteUrl = new URL("/recuperar-acesso", input.baseUrl);
  inviteUrl.searchParams.set("token", issuedToken.token);

  let emailDelivered = false;
  let deliveryMode: "resend" | "disabled" | "error" = "disabled";

  try {
    const delivery = await sendTransactionalEmail({
      to: member.email,
      subject: "Voce foi convidado para o workspace da Dabi Price",
      text: buildWorkspaceInviteTextEmail({
        fullName: member.fullName,
        workspaceName: input.session.workspace.name,
        roleLabel: workspaceRoleMeta[normalizedRole].label,
        inviteUrl: inviteUrl.toString(),
        expiresAt: issuedToken.expiresAt,
      }),
      html: buildWorkspaceInviteHtmlEmail({
        fullName: member.fullName,
        workspaceName: input.session.workspace.name,
        roleLabel: workspaceRoleMeta[normalizedRole].label,
        inviteUrl: inviteUrl.toString(),
        expiresAt: issuedToken.expiresAt,
      }),
    });

    emailDelivered = delivery.delivered;
    deliveryMode = delivery.mode;
  } catch {
    deliveryMode = "error";
  }

  if (isPlatformPersistenceAvailable()) {
    await appendAuditEvent({
      workspaceId: input.session.workspace.id,
      userId: input.session.user.id,
      type: "workspace-member-invited",
      title: "Membro convidado",
      description: `${member.email} recebeu acesso como ${workspaceRoleMeta[normalizedRole].label.toLowerCase()} no workspace.`,
      tone: "success",
    });
  }

  return {
    member,
    emailDelivered,
    deliveryMode,
    inviteUrl:
      process.env.NODE_ENV === "production" && emailDelivered
        ? null
        : inviteUrl.toString(),
    expiresAt: issuedToken.expiresAt,
  };
}

export async function updateWorkspaceMemberRoleForSession(input: {
  session: AuthenticatedWorkspaceSession;
  membershipId: string;
  workspaceRole: string;
}) {
  const targetMember = isPlatformPersistenceAvailable()
    ? await findWorkspaceMemberById({
        workspaceId: input.session.workspace.id,
        membershipId: input.membershipId,
      })
    : findLocalDevelopmentWorkspaceMemberById(input.membershipId);

  if (!targetMember) {
    return null;
  }

  const normalizedRole = normalizeWorkspaceRole(input.workspaceRole);
  const canAssign = canAssignWorkspaceRole({
    actor: input.session,
    currentRole: normalizeWorkspaceRole(targetMember.workspaceRole),
    nextRole: normalizedRole,
    isCurrentUser: targetMember.userId === input.session.user.id,
  });

  if (!canAssign) {
    throw new Error("FORBIDDEN_ROLE_ASSIGNMENT");
  }

  const updatedMember = isPlatformPersistenceAvailable()
    ? await updateWorkspaceMemberRole({
        workspaceId: input.session.workspace.id,
        membershipId: input.membershipId,
        workspaceRole: normalizedRole,
        updatedByUserId: input.session.user.id,
      })
    : updateLocalDevelopmentWorkspaceMemberRole({
        membershipId: input.membershipId,
        workspaceRole: normalizedRole,
      });

  if (!updatedMember) {
    return null;
  }

  const roleMeta = workspaceRoleMeta[normalizedRole];
  if (isPlatformPersistenceAvailable()) {
    await appendAuditEvent({
      workspaceId: input.session.workspace.id,
      userId: input.session.user.id,
      type:
        normalizedRole === "owner"
          ? "workspace-ownership-transferred"
          : "workspace-member-role-updated",
      title:
        normalizedRole === "owner"
          ? "Ownership transferido"
          : "Papel do membro atualizado",
      description:
        normalizedRole === "owner"
          ? `${updatedMember.email} agora responde como owner do workspace.`
          : `${updatedMember.email} agora atua como ${roleMeta.label.toLowerCase()}.`,
      tone: "neutral",
    });
  }

  return updatedMember;
}

export async function removeWorkspaceMemberForSession(input: {
  session: AuthenticatedWorkspaceSession;
  membershipId: string;
}) {
  const targetMember = isPlatformPersistenceAvailable()
    ? await findWorkspaceMemberById({
        workspaceId: input.session.workspace.id,
        membershipId: input.membershipId,
      })
    : findLocalDevelopmentWorkspaceMemberById(input.membershipId);

  if (!targetMember) {
    return null;
  }

  const canRemove = canRemoveWorkspaceMember({
    actor: input.session,
    targetRole: normalizeWorkspaceRole(targetMember.workspaceRole),
    isCurrentUser: targetMember.userId === input.session.user.id,
  });

  if (!canRemove) {
    throw new Error("FORBIDDEN_MEMBER_REMOVAL");
  }

  const removedMember = isPlatformPersistenceAvailable()
    ? await removeWorkspaceMember({
        workspaceId: input.session.workspace.id,
        membershipId: input.membershipId,
        removedByUserId: input.session.user.id,
      })
    : removeLocalDevelopmentWorkspaceMember({
        membershipId: input.membershipId,
      });

  if (!removedMember) {
    return null;
  }

  if (isPlatformPersistenceAvailable()) {
    await appendAuditEvent({
      workspaceId: input.session.workspace.id,
      userId: input.session.user.id,
      type: "workspace-member-removed",
      title: "Acesso removido",
      description: `${removedMember.email} perdeu o acesso ao workspace atual.`,
      tone: "warning",
    });
  }

  return removedMember;
}

export async function updateWorkspaceMemberProfileForSession(input: {
  session: AuthenticatedWorkspaceSession;
  membershipId: string;
  fullName: string;
  email: string;
}) {
  if (!isSuperAdminSession(input.session)) {
    throw new Error("FORBIDDEN_PROFILE_EDIT");
  }

  const updatedMember = isPlatformPersistenceAvailable()
    ? await updateWorkspaceMemberProfile({
        workspaceId: input.session.workspace.id,
        membershipId: input.membershipId,
        fullName: input.fullName,
        email: input.email,
      })
    : updateLocalDevelopmentWorkspaceMemberProfile({
        membershipId: input.membershipId,
        fullName: input.fullName,
        email: input.email,
      });

  if (!updatedMember) {
    return null;
  }

  if (isPlatformPersistenceAvailable()) {
    await appendAuditEvent({
      workspaceId: input.session.workspace.id,
      userId: input.session.user.id,
      type: "workspace-member-profile-updated",
      title: "Perfil do membro atualizado",
      description: `${updatedMember.email} teve nome ou e-mail ajustado por suporte administrativo.`,
      tone: "neutral",
    });
  }

  return updatedMember;
}

function buildWorkspaceMembersSummary(
  members: WorkspaceMemberRecord[] | LocalDevWorkspaceMember[],
) {
  return {
    totalMembers: members.length,
    activeMembers: members.filter((member) => member.userStatus === "active").length,
    invitedMembers: members.filter((member) => member.userStatus === "invited").length,
    ownerCount: members.filter((member) => member.workspaceRole === "owner").length,
    managerCount: members.filter((member) => member.workspaceRole === "manager").length,
    operatorCount: members.filter((member) => member.workspaceRole === "operator").length,
  };
}

function buildWorkspaceInviteTextEmail(input: {
  fullName: string;
  workspaceName: string;
  roleLabel: string;
  inviteUrl: string;
  expiresAt: string;
}) {
  return [
    `Ola ${input.fullName},`,
    "",
    `Voce foi convidado para o workspace ${input.workspaceName} na Dabi Price como ${input.roleLabel}.`,
    "",
    `Abra este link para definir sua senha e concluir o acesso: ${input.inviteUrl}`,
    "",
    `Esse link expira em ${formatEmailDateTime(input.expiresAt)}.`,
  ].join("\n");
}

function buildWorkspaceInviteHtmlEmail(input: {
  fullName: string;
  workspaceName: string;
  roleLabel: string;
  inviteUrl: string;
  expiresAt: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #22144f;">
      <h2 style="margin: 0 0 16px;">Convite para a Dabi Price</h2>
      <p>Ola ${escapeHtml(input.fullName)},</p>
      <p>
        Voce foi convidado para o workspace
        <strong>${escapeHtml(input.workspaceName)}</strong>
        como <strong>${escapeHtml(input.roleLabel)}</strong>.
      </p>
      <p>
        <a
          href="${input.inviteUrl}"
          style="display:inline-block;padding:12px 18px;background:#6c56ff;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;"
        >
          Ativar acesso
        </a>
      </p>
      <p>Ou use este link diretamente:</p>
      <p><a href="${input.inviteUrl}">${input.inviteUrl}</a></p>
      <p>Esse link expira em ${formatEmailDateTime(input.expiresAt)}.</p>
    </div>
  `;
}

function formatEmailDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
