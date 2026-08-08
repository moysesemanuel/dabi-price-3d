import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";

export default function ProductLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="app-shell min-h-screen text-[var(--foreground)]">
      <div className="min-h-screen transition-[padding] duration-300 lg:pl-[var(--app-sidebar-width)]">
        <AppSidebar />
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(108,86,255,0.14),transparent_68%)]" />
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
