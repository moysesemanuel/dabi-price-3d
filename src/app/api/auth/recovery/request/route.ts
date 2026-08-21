import { requestPasswordRecovery } from "@/lib/auth/password-recovery";
import { consumeRateLimit, getClientIpAddress } from "@/lib/server/rate-limit";

type PasswordRecoveryRequestPayload = {
  email?: string;
};

export async function POST(request: Request) {
  let body: PasswordRecoveryRequestPayload;

  try {
    body = (await request.json()) as PasswordRecoveryRequestPayload;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";

  if (!email) {
    return Response.json(
      { error: "Informe o e-mail da conta." },
      { status: 400 },
    );
  }

  const clientIp = getClientIpAddress(request);
  const ipRateLimit = await consumeRateLimit({
    key: `password-recovery:request:ip:${clientIp}`,
    maxAttempts: 5,
    windowMs: 1000 * 60 * 15,
  });
  const emailRateLimit = await consumeRateLimit({
    key: `password-recovery:request:email:${email.toLowerCase()}`,
    maxAttempts: 3,
    windowMs: 1000 * 60 * 15,
  });

  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const retryAfterSeconds = Math.max(
      ipRateLimit.retryAfterSeconds,
      emailRateLimit.retryAfterSeconds,
    );

    return Response.json(
      {
        error:
          "Muitas tentativas de recuperação em sequência. Aguarde alguns minutos e tente novamente.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  const recovery = await requestPasswordRecovery({
    email,
    baseUrl: request.url,
  });

  return Response.json(recovery);
}
