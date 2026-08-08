import "server-only";

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

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
