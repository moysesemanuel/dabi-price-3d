import "server-only";

import { randomUUID } from "node:crypto";

import { outboundFetch } from "./http.ts";

type TransactionalEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailDeliveryResult = {
  delivered: boolean;
  mode: "resend" | "disabled";
};

export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
): Promise<EmailDeliveryResult> {
  if (process.env.RESEND_API_KEY) {
    await sendViaResend(input);
    return {
      delivered: true,
      mode: "resend",
    };
  }

  return {
    delivered: false,
    mode: "disabled",
  };
}

async function sendViaResend(input: TransactionalEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress =
    normalizeOptionalEnv(process.env.AUTH_EMAIL_FROM) ??
    "no-reply@dabiprice.local";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  // Chave montada antes da primeira tentativa: um retry chega ao Resend com a
  // mesma chave e o destinatario nao recebe o e-mail duas vezes.
  const idempotencyKey = randomUUID();

  const response = await outboundFetch("https://api.resend.com/emails", {
    integration: "resend",
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    retryNonIdempotentMethod: true,
    body: JSON.stringify({
      from: fromAddress,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Falha ao enviar e-mail transacional via Resend: ${response.status} ${errorText}`,
    );
  }
}

function normalizeOptionalEnv(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}
