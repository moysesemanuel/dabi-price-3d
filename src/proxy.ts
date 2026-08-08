import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveAppRouteProtection } from "@/lib/auth/app-route-protection";
import { authSessionCookieName } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get(authSessionCookieName)?.value;
  const protection = resolveAppRouteProtection({
    hasSession: Boolean(sessionCookie),
    requestUrl: request.url,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });

  if (protection.type === "allow") {
    return NextResponse.next();
  }

  return NextResponse.redirect(protection.redirectUrl);
}

export const config = {
  matcher: ["/app/:path*"],
};
