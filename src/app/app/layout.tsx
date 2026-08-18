import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BillingNotificationBanner } from "@/components/app/billing-notification-banner";
import { getWorkspaceBillingNotification } from "@/lib/billing/server-notification-service";
import { getPersistenceMode } from "@/lib/server/persistence-mode";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  businessTypeCookieName,
  defaultAppPreferences,
  normalizePersistedBusinessType,
} from "@/lib/settings/app-preferences";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentAuthSession();
  const persistenceMode = getPersistenceMode();
  const cookieStore = await cookies();
  const fallbackBusinessType = normalizePersistedBusinessType(
    cookieStore.get(businessTypeCookieName)?.value ?? null,
  );
  const serverPreferences =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id).catch(
          () => defaultAppPreferences,
        )
      : {
          ...defaultAppPreferences,
          businessType: fallbackBusinessType,
          onboardingCompleted: fallbackBusinessType !== null,
        };
  const serverBusinessType = serverPreferences.businessType;

  if (!session) {
    redirect("/login");
  }

  const billingNotification = await getWorkspaceBillingNotification({
    workspaceId: session.workspace.id,
  }).catch(() => null);

  return (
    <main
      className="app-shell min-h-screen text-[var(--foreground)]"
      data-persistence-mode={persistenceMode}
      data-business-type={serverBusinessType ?? "default"}
    >
      <div className="min-h-screen pt-[76px] lg:pl-[var(--app-sidebar-width)] lg:pt-0">
        <AppSidebar
          platformRole={session.user.platformRole}
          initialBusinessType={serverBusinessType}
        />
        <div>
          <BillingNotificationBanner notification={billingNotification} />
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
