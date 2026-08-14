import type { WorkspaceEntitlements } from "../billing/entitlement-service.ts";
import type { SubscriptionStatus } from "../workspace/catalog.ts";
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
  hasPaidWorkspaceAccess?: boolean;
  onboardingCompleted?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  entitlements?: WorkspaceEntitlements;
}) {
  const subscriptionStatus = input.subscriptionStatus ?? "unpaid";
  const canUseApp =
    input.entitlements?.canUseApp ?? input.hasPaidWorkspaceAccess !== false;

  if (input.isApiRequest) {
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
        error:
          getWorkspaceAccessBlockedMessage(
            input.entitlements?.accessReason ?? subscriptionStatus,
          ) ??
          "A assinatura atual não libera esta funcionalidade.",
        code: "SUBSCRIPTION_REQUIRED",
        redirectTo: resolveDefaultWorkspaceAppPath({
          onboardingCompleted: input.onboardingCompleted ?? false,
          subscriptionStatus,
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
        subscriptionStatus,
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
