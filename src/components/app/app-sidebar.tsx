"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const EXPANDED_WIDTH = 215;
const COLLAPSED_WIDTH = 88;

const navigationItems = [
  { href: "/", label: "Precificadora" },
  { href: "/historico", label: "Histórico" },
  { href: "/preferencias", label: "Preferências" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      `${isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}px`,
    );
  }, [isExpanded]);

  return (
    <aside className="hidden transition-[width] duration-300 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[var(--app-sidebar-width)] lg:flex-col lg:border-r lg:border-white/6 lg:bg-[#0a1629]">
      <div className="border-b border-white/6 px-3 py-4">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`min-w-0 transition-all duration-300 ${
              isExpanded ? "text-3xl" : "text-2xl"
            } whitespace-nowrap font-semibold leading-none tracking-[-0.08em] text-white`}
          >
            {isExpanded ? (
              <>
                DaBi<span className="text-[var(--accent)]">.e-com</span>
              </>
            ) : (
              <>
                D<span className="text-[var(--accent)]">.</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 text-white transition hover:border-white/14 hover:bg-white/4"
            aria-label={isExpanded ? "Retrair menu lateral" : "Expandir menu lateral"}
            title={isExpanded ? "Retrair menu" : "Expandir menu"}
          >
            {isExpanded ? "←" : "→"}
          </button>
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
                  } ${isExpanded ? "justify-start" : "justify-center"}`}
                  title={isExpanded ? undefined : item.label}
                >
                  <span
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-current/20 text-[10px] ${
                      isExpanded ? "mr-3" : ""
                    }`}
                  >
                    {isActive ? String(index + 1) : "."}
                  </span>

                  {isExpanded ? item.label : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div
        className={`border-t border-white/6 px-3 py-4 text-sm text-[var(--muted)] ${
          isExpanded ? "" : "text-center"
        }`}
      >
        {isExpanded ? <p className="truncate">mecs.cwb@gmail.com</p> : <p>•</p>}

        <button
          type="button"
          className={`mt-4 rounded-full border border-white/8 px-4 py-2 text-white transition hover:border-white/14 hover:bg-white/4 ${
            isExpanded ? "w-full text-left" : "w-10 px-0 text-center"
          }`}
          title={isExpanded ? undefined : "Sair"}
        >
          {isExpanded ? "Sair" : "↗"}
        </button>
      </div>
    </aside>
  );
}
