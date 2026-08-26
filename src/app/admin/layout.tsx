import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShellNav } from "@/components/admin/admin-shell-nav";
import { isSuperAdminSession } from "@/lib/auth/access-control";
import { getCurrentAuthSession } from "@/lib/auth/session";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getCurrentAuthSession();

  if (!session) {
    redirect("/login?next=/admin/dashboard");
  }

  if (!isSuperAdminSession(session)) {
    redirect("/app");
  }

  return (
    <main className="admin-shell min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <AdminShellNav userName={session.user.fullName} />
      <div className="min-h-screen px-4 pb-10 pt-20 sm:px-6 lg:ml-[264px] lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-[1440px]">{children}</div>
      </div>
    </main>
  );
}
