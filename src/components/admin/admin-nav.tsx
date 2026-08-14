"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/assinaturas", label: "Assinaturas" },
  { href: "/admin/pagamentos", label: "Pagamentos" },
  { href: "/admin/eventos", label: "Eventos" },
  { href: "/admin/sistema", label: "Sistema" },
  { href: "/admin/usuarios", label: "Usuarios" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {adminLinks.map((link) => {
        const isActive =
          pathname === link.href ||
          (link.href !== "/admin/dashboard" && pathname.startsWith(`${link.href}/`));

        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? "inline-flex items-center rounded-full border border-[var(--accent)] bg-[rgba(255,255,255,0.96)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] shadow-[0_16px_36px_rgba(15,23,42,0.08)]"
                : "inline-flex items-center rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.72)] px-4 py-2 text-sm font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
