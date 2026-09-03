import { cookies } from "next/headers";
import { loginWithEmailPassword, setSessionCookie } from "@/lib/auth/session";
import { getWorkspaceEntitlements } from "@/lib/billing/server-entitlement-service";
import { getWorkspacePreferences } from "@/lib/server/platform";
import {
  consumeRateLimit,
  getClientIpAddress,
  getRateLimitStatus,
} from "@/lib/server/rate-limit";
import { resolveLoginRedirect } from "@/lib/auth/login-redirect";

type LoginRequestPayload = {
  email?: string;
  password?: string;
  next?: string;
};

export async function POST(request: Request) {
  let body: LoginRequestPayload;

  try {
    body = (await request.json()) as LoginRequestPayload;
  } catch {
    return Response.json({ error: "Payload de login inválido." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return Response.json(
      { error: "Informe e-mail e senha para entrar." },
      { status: 400 },
    );
  }

  const clientIp = getClientIpAddress(request);
  const ipRateLimit = await consumeRateLimit({
    key: `login:ip:${clientIp}`,
    maxAttempts: 10,
    windowMs: 1000 * 60 * 15,
  });
  const emailRateLimit = await getRateLimitStatus({
    key: `login:email:${email.toLowerCase()}`,
    maxAttempts: 5,
    windowMs: 1000 * 60 * 15,
  });

  if (!ipRateLimit.allowed || !emailRateLimit.allowed) {
    const retryAfterSeconds = Math.max(
      ipRateLimit.retryAfterSeconds,
      emailRateLimit.retryAfterSeconds,
    );

    return Response.json(
      { error: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      },
    );
  }

  const authResult = await loginWithEmailPassword({ email, password });

  if (!authResult) {
    const failedEmailRateLimit = await consumeRateLimit({
      key: `login:email:${email.toLowerCase()}`,
      maxAttempts: 5,
      windowMs: 1000 * 60 * 15,
    });

    if (!failedEmailRateLimit.allowed) {
      return Response.json(
        { error: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente." },
        {
          status: 429,
          headers: {
            "Retry-After": String(failedEmailRateLimit.retryAfterSeconds),
          },
        },
      );
    }

    return Response.json(
      { error: "E-mail ou senha inválidos." },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  setSessionCookie(cookieStore, authResult.sessionToken, authResult.expiresAt);
  const preferences = await getWorkspacePreferences(authResult.session.workspace.id);
  const entitlements = await getWorkspaceEntitlements({
    workspaceId: authResult.session.workspace.id,
    platformRole: authResult.session.user.platformRole,
  });

  return Response.json({
    session: authResult.session,
    redirectTo: resolveLoginRedirect({
      nextPath: body.next,
      platformRole: authResult.session.user.platformRole,
      onboardingCompleted: preferences.onboardingCompleted,
      accessReason: entitlements.accessReason,
    }),
  });
}
