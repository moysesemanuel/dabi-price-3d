import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveAppRouteProtection } from "@/lib/auth/app-route-protection";
import { getWorkspaceEntitlements } from "@/lib/billing/server-entitlement-service";
import { authSessionCookieName } from "@/lib/auth/session";
import {
  getAuthenticatedSessionByToken,
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";

export async function proxy(request: NextRequest) {
  const isApiRequest = request.nextUrl.pathname.startsWith("/api/");
  const sessionCookie = request.cookies.get(authSessionCookieName)?.value;

  if (!sessionCookie) {
    const protection = resolveAppRouteProtection({
      hasSession: false,
      isApiRequest,
      requestUrl: request.url,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
    });

    return buildProxyResponse(protection);
  }

  if (!isPlatformPersistenceAvailable()) {
    return NextResponse.next();
  }

  const tokenHash = createHash("sha256").update(sessionCookie).digest("hex");
  const session = await getAuthenticatedSessionByToken(tokenHash);

  if (!session) {
    const protection = resolveAppRouteProtection({
      hasSession: false,
      isApiRequest,
      requestUrl: request.url,
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
    });

    return buildProxyResponse(protection);
  }

  const preferences = await getWorkspacePreferences(session.workspace.id);
  const entitlements = await getWorkspaceEntitlements({
    workspaceId: session.workspace.id,
  });
  const protection = resolveAppRouteProtection({
    hasSession: true,
    isApiRequest,
    entitlements,
    onboardingCompleted: preferences.onboardingCompleted,
    accessReason: entitlements.accessReason,
    requestUrl: request.url,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });

  return buildProxyResponse(protection);
}

function buildProxyResponse(
  protection: ReturnType<typeof resolveAppRouteProtection>,
) {
  if (protection.type === "allow") {
    return NextResponse.next();
  }

  if (protection.type === "deny") {
    return NextResponse.json(protection.responseBody, {
      status: protection.status,
    });
  }

  return NextResponse.redirect(protection.redirectUrl);
}

export const config = {
  matcher: ["/app/:path*", "/api/:path*"],
};
