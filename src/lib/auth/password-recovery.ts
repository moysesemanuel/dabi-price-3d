import "server-only";

import {
  consumeLocalDevelopmentPasswordResetToken,
  createLocalDevelopmentPasswordResetToken,
  getLocalDevelopmentBootstrapConfig,
  isLocalDevelopmentAuthEnabled,
  verifyLocalDevelopmentPasswordResetToken,
} from "@/lib/auth/local-dev-auth";
import { hashPassword } from "@/lib/auth/password";
import {
  appendAuditEvent,
  consumePasswordResetToken,
  findPrimaryWorkspaceForUser,
  issuePasswordResetToken,
  isPlatformPersistenceAvailable,
  verifyPasswordResetToken,
} from "@/lib/server/platform";
import { sendTransactionalEmail } from "@/lib/server/email";

export async function requestPasswordRecovery(input: {
  email: string;
  baseUrl: string;
}) {
  if (!isPlatformPersistenceAvailable()) {
    return requestLocalDevelopmentPasswordRecovery(input);
  }

  const issuedToken = await issuePasswordResetToken(input.email, {
    allowedStatuses: ["active", "invited"],
  });

  if (!issuedToken) {
    return { success: true as const, resetUrl: null, expiresAt: null };
  }

  const resetUrl = new URL("/recuperar-acesso", input.baseUrl);
  resetUrl.searchParams.set("token", issuedToken.token);
  const emailDelivery = await sendTransactionalEmail({
    to: issuedToken.email,
    subject: "Redefina sua senha da Dabi Price",
    text: buildPasswordRecoveryTextEmail({
      resetUrl: resetUrl.toString(),
      expiresAt: issuedToken.expiresAt,
    }),
    html: buildPasswordRecoveryHtmlEmail({
      resetUrl: resetUrl.toString(),
      expiresAt: issuedToken.expiresAt,
    }),
  });

  return {
    success: true as const,
    emailDelivered: emailDelivery.delivered,
    deliveryMode: emailDelivery.mode,
    resetUrl:
      process.env.NODE_ENV === "production" && emailDelivery.delivered
        ? null
        : resetUrl.toString(),
    expiresAt: issuedToken.expiresAt,
  };
}

export async function inspectPasswordRecoveryToken(token: string) {
  if (!token.trim()) {
    return null;
  }

  if (!isPlatformPersistenceAvailable()) {
    const localToken = verifyLocalDevelopmentPasswordResetToken(token);

    if (!localToken) {
      return null;
    }

    return {
      email: localToken.email,
      expiresAt: localToken.expiresAt,
    };
  }

  return verifyPasswordResetToken(token);
}

export async function resetPasswordWithRecoveryToken(input: {
  token: string;
  password: string;
}) {
  if (!isPlatformPersistenceAvailable()) {
    const resetResult = consumeLocalDevelopmentPasswordResetToken({
      token: input.token,
      password: input.password,
    });

    return resetResult ? { email: resetResult.email } : null;
  }

  const passwordHash = await hashPassword(input.password);
  const consumedToken = await consumePasswordResetToken({
    token: input.token,
    passwordHash,
  });

  if (!consumedToken) {
    return null;
  }

  const workspaceMembership = await findPrimaryWorkspaceForUser(consumedToken.userId);

  if (workspaceMembership) {
    await appendAuditEvent({
      workspaceId: workspaceMembership.workspace_id,
      userId: consumedToken.userId,
      type:
        consumedToken.status === "invited"
          ? "workspace-member-activated"
          : "password-reset",
      title:
        consumedToken.status === "invited"
          ? "Convite aceito"
          : "Senha redefinida",
      description:
        consumedToken.status === "invited"
          ? `${consumedToken.email} concluiu a ativacao inicial do acesso ao workspace.`
          : `${consumedToken.email} redefiniu a senha pela jornada pública de recuperação.`,
      tone: "success",
    });
  }

  return {
    email: consumedToken.email,
  };
}

function requestLocalDevelopmentPasswordRecovery(input: {
  email: string;
  baseUrl: string;
}) {
  if (!isLocalDevelopmentAuthEnabled()) {
    return { success: true as const, resetUrl: null, expiresAt: null };
  }

  const issuedToken = createLocalDevelopmentPasswordResetToken({
    email: input.email,
  });

  if (!issuedToken) {
    return { success: true as const, resetUrl: null, expiresAt: null };
  }

  const resetUrl = new URL("/recuperar-acesso", input.baseUrl);
  resetUrl.searchParams.set("token", issuedToken.token);

  return {
    success: true as const,
    emailDelivered: false,
    deliveryMode: "disabled" as const,
    resetUrl: resetUrl.toString(),
    expiresAt: issuedToken.expiresAt,
    hintEmail: getLocalDevelopmentBootstrapConfig().email,
  };
}

function buildPasswordRecoveryTextEmail(input: {
  resetUrl: string;
  expiresAt: string;
}) {
  return [
    "Recebemos uma solicitação para redefinir sua senha da Dabi Price.",
    "",
    `Abra este link para cadastrar uma nova senha: ${input.resetUrl}`,
    "",
    `Este link expira em ${formatEmailDateTime(input.expiresAt)}.`,
    "",
    "Se você não solicitou a redefinição, ignore este e-mail.",
  ].join("\n");
}

function buildPasswordRecoveryHtmlEmail(input: {
  resetUrl: string;
  expiresAt: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #22144f;">
      <h2 style="margin: 0 0 16px;">Redefina sua senha da Dabi Price</h2>
      <p>Recebemos uma solicitação para redefinir sua senha.</p>
      <p>
        <a
          href="${input.resetUrl}"
          style="display:inline-block;padding:12px 18px;background:#6c56ff;color:#ffffff;text-decoration:none;border-radius:999px;font-weight:600;"
        >
          Redefinir senha
        </a>
      </p>
      <p>Ou use este link diretamente:</p>
      <p><a href="${input.resetUrl}">${input.resetUrl}</a></p>
      <p>Este link expira em ${formatEmailDateTime(input.expiresAt)}.</p>
      <p>Se você não solicitou a redefinição, ignore este e-mail.</p>
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
