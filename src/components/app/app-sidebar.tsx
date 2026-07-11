"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const EXPANDED_WIDTH = 215;
const COLLAPSED_WIDTH = 88;
const THEME_STORAGE_KEY = "dabi-price-theme";
type ThemeMode = "light" | "dark";

const navigationItems = [
  { href: "/", label: "Precificadora" },
  { href: "/historico", label: "Histórico" },
  { href: "/preferencias", label: "Preferências" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const themeSwitchRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      `${isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}px`,
    );
  }, [isExpanded]);

  useEffect(() => {
    const savedTheme =
      typeof window !== "undefined"
        ? window.localStorage.getItem(THEME_STORAGE_KEY)
        : null;
    const nextTheme: ThemeMode = savedTheme === "dark" ? "dark" : "light";

    document.documentElement.dataset.theme = nextTheme;
    themeSwitchRef.current?.setAttribute(
      "aria-pressed",
      String(nextTheme === "dark"),
    );
  }, []);

  function applyTheme(themeMode: ThemeMode) {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    themeSwitchRef.current?.setAttribute(
      "aria-pressed",
      String(themeMode === "dark"),
    );
  }

  function toggleTheme() {
    const currentTheme =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    applyTheme(currentTheme === "dark" ? "light" : "dark");
  }

  return (
    <aside className="hidden transition-[width] duration-300 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[var(--app-sidebar-width)] lg:flex-col lg:border-r lg:border-[color:var(--panel-border)] lg:bg-[var(--sidebar-bg)]">
      <div className="border-b border-[color:var(--panel-border)] px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`min-w-0 transition-all duration-300 ${
              isExpanded ? "text-2xl" : "text-xl"
            } whitespace-nowrap font-semibold leading-none tracking-[-0.08em] text-[var(--foreground)]`}
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
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--panel-border)] bg-[var(--panel)] text-[var(--foreground)] transition hover:border-[#ff6a00] hover:bg-[#ff6a00] hover:text-white"
            aria-label={isExpanded ? "Retrair menu lateral" : "Expandir menu lateral"}
            title={isExpanded ? "Retrair menu" : "Expandir menu"}
          >
            {isExpanded ? "←" : "→"}
          </button>
        </div>
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
                      : "text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)]"
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
        className={`border-t border-[color:var(--panel-border)] px-3 py-4 text-sm text-[var(--muted)] ${
          isExpanded ? "" : "text-center"
        }`}
      >
        {isExpanded ? (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Sessão
            </p>
            <p className="mt-2 truncate text-[var(--foreground)]">mecs.cwb@gmail.com</p>

            <div className="mt-4 rounded-[24px] border border-[color:var(--panel-border)] bg-[var(--panel)] px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                Tema
              </p>

              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Claro / Escuro
                  </p>
                </div>

                <button
                  ref={themeSwitchRef}
                  type="button"
                  data-theme-switch
                  onClick={toggleTheme}
                  aria-label="Alternar entre modo claro e escuro"
                  aria-pressed="false"
                  className="relative h-7 w-12 shrink-0 rounded-full border border-[color:var(--panel-border)] bg-[var(--foreground)] transition"
                >
                  <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <p>•</p>
        )}

        <button
          type="button"
          className={`mt-4 rounded-full border border-[color:var(--panel-border)] px-4 py-2 text-[var(--foreground)] transition hover:border-[#ff6a00] hover:bg-[#ff6a00] hover:text-white ${
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
