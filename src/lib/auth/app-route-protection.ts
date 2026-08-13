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
}) {
  const subscriptionStatus = input.subscriptionStatus ?? "unpaid";

  if (input.isApiRequest) {
    if (!input.hasSession || input.hasPaidWorkspaceAccess !== false) {
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
          getWorkspaceAccessBlockedMessage(subscriptionStatus) ??
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
    if (
      input.hasPaidWorkspaceAccess !== false ||
      canAccessAppPathWithoutPaidWorkspace(input.pathname)
    ) {
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
