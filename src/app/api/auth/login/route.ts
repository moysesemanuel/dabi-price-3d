import { cookies } from "next/headers";
import { loginWithEmailPassword, setSessionCookie } from "@/lib/auth/session";

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

  return Response.json({
    session: authResult.session,
    redirectTo: resolveNextPath(body.next),
  });
}

function resolveNextPath(nextPath: string | undefined) {
  if (typeof nextPath !== "string") {
    return "/app/precificacao";
  }

  return nextPath.startsWith("/app") ? nextPath : "/app/precificacao";
}
