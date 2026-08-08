import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { getMercadoLivreAuthorizationUrl } from "@/lib/marketplaces/mercado-livre-auth";

const OAUTH_STATE_COOKIE = "dabi-price-3d:meli-oauth-state";
const OAUTH_CODE_VERIFIER_COOKIE = "dabi-price-3d:meli-oauth-code-verifier";

export async function GET() {
  await requireCurrentAuthSession();

  const { state, codeVerifier, authorizationUrl } =
    getMercadoLivreAuthorizationUrl();
  const cookieStore = await cookies();

  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  cookieStore.set(OAUTH_CODE_VERIFIER_COOKIE, codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(authorizationUrl);
}
