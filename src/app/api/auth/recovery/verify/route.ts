import { inspectPasswordRecoveryToken } from "@/lib/auth/password-recovery";
import { consumeRateLimit, getClientIpAddress } from "@/lib/server/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim() ?? "";

  if (!token) {
    return Response.json({ error: "Token ausente." }, { status: 400 });
  }

  const clientIp = getClientIpAddress(request);
  const ipRateLimit = await consumeRateLimit({
    key: `password-recovery:verify:ip:${clientIp}`,
    maxAttempts: 20,
    windowMs: 1000 * 60 * 15,
  });
  const tokenRateLimit = await consumeRateLimit({
    key: `password-recovery:verify:token:${token}`,
    maxAttempts: 12,
    windowMs: 1000 * 60 * 15,
  });

  if (!ipRateLimit.allowed || !tokenRateLimit.allowed) {
    const retryAfterSeconds = Math.max(
      ipRateLimit.retryAfterSeconds,
      tokenRateLimit.retryAfterSeconds,
    );

    return Response.json(
      {
        error:
          "Muitas verificações desse link em sequência. Aguarde um pouco antes de tentar novamente.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  const verifiedToken = await inspectPasswordRecoveryToken(token);

  if (!verifiedToken) {
    return Response.json(
      { error: "Token inválido ou expirado." },
      { status: 400 },
    );
  }

  return Response.json({
    valid: true,
    email: verifiedToken.email,
    expiresAt: verifiedToken.expiresAt,
  });
}
