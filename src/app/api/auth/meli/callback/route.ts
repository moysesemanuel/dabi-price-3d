import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { exchangeMercadoLivreCode } from "@/lib/marketplaces/mercado-livre-auth";

const OAUTH_STATE_COOKIE = "dabi-price-3d:meli-oauth-state";
const OAUTH_CODE_VERIFIER_COOKIE = "dabi-price-3d:meli-oauth-code-verifier";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? null;
  const codeVerifier =
    cookieStore.get(OAUTH_CODE_VERIFIER_COOKIE)?.value ?? null;

  cookieStore.delete(OAUTH_STATE_COOKIE);
  cookieStore.delete(OAUTH_CODE_VERIFIER_COOKIE);

  const redirectUrl = new URL("/preferencias", request.url);

  if (error) {
    redirectUrl.searchParams.set("meli", "error");
    redirectUrl.searchParams.set("reason", errorDescription ?? error);

    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set("meli", "error");
    redirectUrl.searchParams.set("reason", "Código de autorização ausente.");

    return NextResponse.redirect(redirectUrl);
  }

  if (!state || !expectedState || state !== expectedState) {
    redirectUrl.searchParams.set("meli", "error");
    redirectUrl.searchParams.set("reason", "State OAuth inválido.");

    return NextResponse.redirect(redirectUrl);
  }

  try {
    await exchangeMercadoLivreCode(code, codeVerifier);
    redirectUrl.searchParams.set("meli", "connected");
  } catch (callbackError) {
    redirectUrl.searchParams.set("meli", "error");
    redirectUrl.searchParams.set(
      "reason",
      callbackError instanceof Error
        ? callbackError.message
        : "Falha ao salvar credenciais do Mercado Livre.",
    );
  }

  return NextResponse.redirect(redirectUrl);
}
