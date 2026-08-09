import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentAuthSession } from "@/lib/auth/session";
import { AppSidebar } from "@/components/app/app-sidebar";
import { getPersistenceMode } from "@/lib/server/persistence-mode";

export default async function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentAuthSession();
  const persistenceMode = getPersistenceMode();

  if (!session) {
    redirect("/login");
  }

  return (
    <main
      className="app-shell min-h-screen text-[var(--foreground)]"
      data-persistence-mode={persistenceMode}
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
