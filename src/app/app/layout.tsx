import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { AppSidebar } from "@/components/app/app-sidebar";
import { getPersistenceMode } from "@/lib/server/persistence-mode";
import {
  getWorkspacePreferences,
  isPlatformPersistenceAvailable,
} from "@/lib/server/platform";
import {
  businessTypeCookieName,
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
  const serverBusinessType =
    session && isPlatformPersistenceAvailable()
      ? await getWorkspacePreferences(session.workspace.id)
          .then((preferences) => preferences.businessType)
          .catch(() => null)
      : fallbackBusinessType;

  if (!session) {
    redirect("/login");
  }

  return (
    <main
      className="app-shell min-h-screen text-[var(--foreground)]"
      data-persistence-mode={persistenceMode}
      data-business-type={serverBusinessType ?? "default"}
    >
      <div className="min-h-screen pt-[76px] lg:pl-[var(--app-sidebar-width)] lg:pt-0">
        <AppSidebar platformRole={session.user.platformRole} />
        <div>
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
