import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6f1e7_0%,#fbf8f3_46%,#ffffff_100%)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-[32px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.72)] px-6 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--accent)]">
                Super Admin
              </p>
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  Console administrativo de billing
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  Área operacional fora do entitlement do workspace para
                  acompanhar assinatura, pagamentos, eventos, backlog e exceções
                  administrativas.
                </p>
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-sm text-[var(--muted)]">
              <p className="font-medium text-[var(--foreground)]">
                {session.user.fullName}
              </p>
              <p>{session.user.email}</p>
            </div>
          </div>

          <div className="mt-5">
            <AdminNav />
          </div>
        </header>

        <div className="space-y-6 pb-10">{children}</div>
      </div>
    </main>
  );
}
