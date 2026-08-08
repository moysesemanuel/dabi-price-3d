import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireCurrentAuthSession } from "@/lib/auth/session";
import { exchangeMercadoLivreCode } from "@/lib/marketplaces/mercado-livre-auth";
import { mapMercadoLivreOperationalError } from "@/lib/server/operational-messages";
import {
  createRouteRequestContext,
  logRouteEvent,
  serializeError,
} from "@/lib/server/route-observability";

const OAUTH_STATE_COOKIE = "dabi-price-3d:meli-oauth-state";
const OAUTH_CODE_VERIFIER_COOKIE = "dabi-price-3d:meli-oauth-code-verifier";

export async function GET(request: NextRequest) {
  const requestContext = createRouteRequestContext(
    request,
    "/api/auth/meli/callback",
  );
  await requireCurrentAuthSession();

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

  const redirectUrl = new URL("/app/preferencias", request.url);

  if (error) {
    logRouteEvent(requestContext, "warn", "meli.oauth_callback_provider_error", {
      providerError: error,
      providerErrorDescription: errorDescription,
    });

    redirectUrl.searchParams.set("meli", "error");
    redirectUrl.searchParams.set("reason", errorDescription ?? error);
    redirectUrl.searchParams.set("requestId", requestContext.requestId);

    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    logRouteEvent(requestContext, "warn", "meli.oauth_callback_missing_code", {});

    redirectUrl.searchParams.set("meli", "error");
    redirectUrl.searchParams.set("reason", "Código de autorização ausente.");
    redirectUrl.searchParams.set("requestId", requestContext.requestId);

    return NextResponse.redirect(redirectUrl);
  }

  if (!state || !expectedState || state !== expectedState) {
    logRouteEvent(requestContext, "warn", "meli.oauth_callback_invalid_state", {
      hasState: Boolean(state),
      hasExpectedState: Boolean(expectedState),
    });

    redirectUrl.searchParams.set("meli", "error");
    redirectUrl.searchParams.set("reason", "State OAuth inválido.");
    redirectUrl.searchParams.set("requestId", requestContext.requestId);

    return NextResponse.redirect(redirectUrl);
  }

  try {
    await exchangeMercadoLivreCode(code, codeVerifier);
    logRouteEvent(requestContext, "info", "meli.oauth_callback_connected", {});
    redirectUrl.searchParams.set("meli", "connected");
  } catch (callbackError) {
    const mappedError = mapMercadoLivreOperationalError(callbackError);

    logRouteEvent(requestContext, mappedError.severity, "meli.oauth_callback_failed", {
      error: serializeError(callbackError),
      mappedCode: mappedError.code,
    });

    redirectUrl.searchParams.set("meli", "error");
    redirectUrl.searchParams.set("reason", mappedError.message);
    redirectUrl.searchParams.set("requestId", requestContext.requestId);
  }

  return NextResponse.redirect(redirectUrl);
}
