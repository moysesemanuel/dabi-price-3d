"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
  { href: "/", label: "Precificadora" },
  { href: "/historico", label: "Histórico" },
  { href: "/preferencias", label: "Preferências" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[215px] lg:flex-col lg:border-r lg:border-white/6 lg:bg-[#0a1629]">
      <div className="border-b border-white/6 px-3 py-4">
        <div className="text-4xl font-semibold tracking-[-0.08em] text-white">
          DaBi<span className="text-[var(--accent)]">.e-com</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-2">
          {navigationItems.map((item, index) => {
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-sm transition ${
                    isActive
                      ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                      : "text-[var(--muted)] hover:bg-white/4 hover:text-white"
                  }`}
                >
                  <span className="mr-3 inline-flex size-5 items-center justify-center rounded-full border border-current/20 text-[10px]">
                    {isActive ? String(index + 1) : "."}
                  </span>

                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/6 px-3 py-4 text-sm text-[var(--muted)]">
        <p className="truncate">mecs.cwb@gmail.com</p>

        <button
          type="button"
          className="mt-4 rounded-full border border-white/8 px-4 py-2 text-left text-white transition hover:border-white/14 hover:bg-white/4"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
