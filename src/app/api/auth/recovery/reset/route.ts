import { resetPasswordWithRecoveryToken } from "@/lib/auth/password-recovery";
import { consumeRateLimit, getClientIpAddress } from "@/lib/server/rate-limit";

type PasswordRecoveryResetPayload = {
  token?: string;
  password?: string;
};

export async function POST(request: Request) {
  let body: PasswordRecoveryResetPayload;

  try {
    body = (await request.json()) as PasswordRecoveryResetPayload;
  } catch {
    return Response.json({ error: "Payload inválido." }, { status: 400 });
  }

  const token = body.token?.trim() ?? "";
  const password = body.password ?? "";

  if (!token) {
    return Response.json({ error: "Token ausente." }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json(
      { error: "A nova senha precisa ter pelo menos 8 caracteres." },
      { status: 400 },
    );
  }

  const clientIp = getClientIpAddress(request);
  const ipRateLimit = consumeRateLimit({
    key: `password-recovery:reset:ip:${clientIp}`,
    maxAttempts: 8,
    windowMs: 1000 * 60 * 15,
  });
  const tokenRateLimit = consumeRateLimit({
    key: `password-recovery:reset:token:${token}`,
    maxAttempts: 5,
    windowMs: 1000 * 60 * 30,
  });

  if (!ipRateLimit.allowed || !tokenRateLimit.allowed) {
    const retryAfterSeconds = Math.max(
      ipRateLimit.retryAfterSeconds,
      tokenRateLimit.retryAfterSeconds,
    );

    return Response.json(
      {
        error:
          "Muitas tentativas de redefinição em sequência. Aguarde alguns minutos antes de tentar novamente.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  const resetResult = await resetPasswordWithRecoveryToken({
    token,
    password,
  });

  if (!resetResult) {
    return Response.json(
      { error: "Token inválido ou expirado." },
      { status: 400 },
    );
  }

  return Response.json({
    success: true,
    email: resetResult.email,
  });
}
