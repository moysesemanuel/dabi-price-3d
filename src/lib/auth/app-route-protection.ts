import type { WorkspaceEntitlements } from "../billing/entitlement-service.ts";
import type { WorkspaceEntitlementAccessReason } from "../billing/entitlement-service.ts";
import {
  canAccessApiPathWithoutPaidWorkspace,
  canAccessAppPathWithoutPaidWorkspace,
  getWorkspaceAccessBlockedMessage,
  resolveDefaultWorkspaceAppPath,
} from "../workspace/subscription-access.ts";

export function resolveAppRouteProtection(input: {
  hasSession: boolean;
  requestUrl: string;
  pathname: string;
  search: string;
  isApiRequest?: boolean;
  onboardingCompleted?: boolean;
  accessReason?: WorkspaceEntitlementAccessReason;
  entitlements?: WorkspaceEntitlements;
}) {
  const accessReason =
    input.accessReason ?? input.entitlements?.accessReason ?? "no_subscription";
  const canUseApp =
    input.entitlements?.canUseApp ??
    (accessReason === "active" ||
      accessReason === "grace_period" ||
      accessReason === "scheduled_cancel");

  if (input.isApiRequest) {
    if (canAccessAdministrativeApiPath(input.pathname)) {
      return {
        type: "allow" as const,
        redirectUrl: null,
      };
    }

    if (!input.hasSession || canUseApp) {
      return {
        type: "allow" as const,
        redirectUrl: null,
      };
    }

    if (canAccessApiPathWithoutPaidWorkspace(input.pathname)) {
      return {
        type: "allow" as const,
        redirectUrl: null,
      };
    }

    return {
      type: "deny" as const,
      redirectUrl: null,
      status: 403,
      responseBody: {
        error: getWorkspaceAccessBlockedMessage(accessReason) ??
          "A assinatura atual não libera esta funcionalidade.",
        code: "SUBSCRIPTION_REQUIRED",
        redirectTo: resolveDefaultWorkspaceAppPath({
          onboardingCompleted: input.onboardingCompleted ?? false,
          accessReason,
        }),
      },
    };
  }

  if (input.hasSession) {
    if (canUseApp || canAccessAppPathWithoutPaidWorkspace(input.pathname)) {
      return {
        type: "allow" as const,
        redirectUrl: null,
      };
    }

    const redirectUrl = new URL(
      resolveDefaultWorkspaceAppPath({
        onboardingCompleted: input.onboardingCompleted ?? false,
        accessReason,
      }),
      input.requestUrl,
    );

    return {
      type: "redirect" as const,
      redirectUrl: redirectUrl.toString(),
    };
  }

  const loginUrl = new URL("/login", input.requestUrl);
  loginUrl.searchParams.set("next", `${input.pathname}${input.search}`);

  return {
    type: "redirect" as const,
    redirectUrl: loginUrl.toString(),
  };
}

function canAccessAdministrativeApiPath(pathname: string) {
  return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}
