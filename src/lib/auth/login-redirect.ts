import type { PlatformRole } from "../server/platform.ts";
import { resolveDefaultWorkspaceAppPath } from "../workspace/subscription-access.ts";

export function resolveLoginRedirect(input: {
  nextPath?: string;
  platformRole: PlatformRole;
  onboardingCompleted: boolean;
  accessReason: Parameters<typeof resolveDefaultWorkspaceAppPath>[0]["accessReason"];
}) {
  const isAdminPath = input.nextPath?.startsWith("/admin/") ?? false;
  const isAppPath = input.nextPath?.startsWith("/app") ?? false;

  if (input.platformRole === "super_admin") {
    return isAdminPath ? input.nextPath! : "/admin/dashboard";
  }

  return isAppPath
    ? input.nextPath!
    : resolveDefaultWorkspaceAppPath({
        onboardingCompleted: input.onboardingCompleted,
        accessReason: input.accessReason,
      });
}
