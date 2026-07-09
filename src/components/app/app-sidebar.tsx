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
    <aside className="hidden transition-[width] duration-300 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[var(--app-sidebar-width)] lg:flex-col lg:border-r lg:border-black/8 lg:bg-white">
      <div className="border-b border-black/8 px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`min-w-0 transition-all duration-300 ${
              isExpanded ? "text-2xl" : "text-xl"
            } whitespace-nowrap font-semibold leading-none tracking-[-0.08em] text-[#18120d]`}
          >
            {isExpanded ? (
              <>
                Dabi<span className="text-[#ff6a00]"> Price</span>
              </>
            ) : (
              <>
                D<span className="text-[#ff6a00]">P</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-black/8 bg-white text-[#18120d] transition hover:border-[#ff6a00]/25 hover:bg-[#ff6a00]"
            aria-label={isExpanded ? "Retrair menu lateral" : "Expandir menu lateral"}
            title={isExpanded ? "Retrair menu" : "Expandir menu"}
          >
            {isExpanded ? "←" : "→"}
          </button>
        </div>

        {isExpanded ? (
          <p className="mt-4 max-w-[160px] text-sm leading-6 text-[#7c6858]">
            Precificação guiada para produtos físicos e impressão 3D.
          </p>
        ) : null}
      </div>

      <nav className="flex-1 px-3 py-5">
        <ul className="space-y-2">
          {navigationItems.map((item, index) => {
            const isActive = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex w-full items-center rounded-2xl px-4 py-3 text-sm transition ${
                    isActive
                      ? "bg-[#ff6a00] font-medium text-white"
                      : "text-[#7c6858] hover:bg-black/[0.03] hover:text-[#18120d]"
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
        className={`border-t border-black/8 px-3 py-4 text-sm text-[#7c6858] ${
          isExpanded ? "" : "text-center"
        }`}
      >
        {isExpanded ? (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#7c6858]">
              Sessão
            </p>
            <p className="mt-2 truncate text-[#18120d]">mecs.cwb@gmail.com</p>
          </>
        ) : (
          <p>•</p>
        )}

        <button
          type="button"
          className={`mt-4 rounded-full border border-black/8 px-4 py-2 text-[#18120d] transition hover:border-[#ff6a00]/30 hover:bg-[#ff6a00] ${
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
