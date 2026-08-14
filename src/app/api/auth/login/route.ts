import { cookies } from "next/headers";
import { loginWithEmailPassword, setSessionCookie } from "@/lib/auth/session";
import { getWorkspaceEntitlements } from "@/lib/billing/server-entitlement-service";
import { getWorkspacePreferences } from "@/lib/server/platform";
import { resolveDefaultWorkspaceAppPath } from "@/lib/workspace/subscription-access";

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

  const authResult = await loginWithEmailPassword({ email, password });

  if (!authResult) {
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
    fallbackSubscription: preferences.subscription,
  });

  return Response.json({
    session: authResult.session,
    redirectTo: resolveNextPath(body.next, {
      onboardingCompleted: preferences.onboardingCompleted,
      accessReason: entitlements.accessReason,
    }),
  });
}

function resolveNextPath(
  nextPath: string | undefined,
  fallbackState: {
    onboardingCompleted: boolean;
    accessReason: Parameters<typeof resolveDefaultWorkspaceAppPath>[0]["accessReason"];
  },
) {
  if (typeof nextPath !== "string") {
    return resolveDefaultWorkspaceAppPath(fallbackState);
  }

  return nextPath.startsWith("/app")
    ? nextPath
    : resolveDefaultWorkspaceAppPath(fallbackState);
}
