"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  defaultAppPreferences,
  readAppPreferences,
  subscribeAppPreferences,
} from "@/lib/settings/app-preferences";

const EXPANDED_WIDTH = 215;
const COLLAPSED_WIDTH = 88;
const THEME_STORAGE_KEY = "dabi-price-theme";
type ThemeMode = "light" | "dark";

const navigationItems = [
  { href: "/app/precificacao", label: "Precificadora" },
  { href: "/app/historico", label: "Histórico" },
  { href: "/app/preferencias", label: "Preferências" },
  { href: "/app/ajuda", label: "Ajuda" },
  { href: "/app/suporte", label: "Suporte" },
  { href: "/app/conta", label: "Conta" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [workspaceName, setWorkspaceName] = useState(
    defaultAppPreferences.workspaceName,
  );
  const [operatorLabel, setOperatorLabel] = useState("Configuração pendente");
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

  useEffect(() => {
    const syncPreferences = () => {
      const preferences = readAppPreferences();

      setWorkspaceName(preferences.workspaceName || "Dabi Price");
      setOperatorLabel(
        preferences.operatorEmail ||
          preferences.operatorName ||
          "Configuração pendente",
      );
    };

    syncPreferences();

    return subscribeAppPreferences(syncPreferences);
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
    <aside className="hidden transition-[width] duration-300 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[var(--app-sidebar-width)] lg:flex-col lg:bg-transparent lg:px-4 lg:py-4">
      <div className="rounded-[32px] border border-[var(--panel-border)] bg-[var(--sidebar-bg)] px-4 py-5 shadow-[0_18px_48px_rgba(57,37,118,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`min-w-0 transition-all duration-300 ${
              isExpanded ? "text-2xl" : "text-xl"
            } whitespace-nowrap font-semibold leading-none tracking-[-0.08em] text-[var(--foreground)]`}
          >
            {isExpanded ? (
              <>
                Dabi<span className="text-[var(--accent)]"> Price</span>
              </>
            ) : (
              <>
                D<span className="text-[var(--accent)]">P</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
            aria-label={isExpanded ? "Retrair menu lateral" : "Expandir menu lateral"}
            title={isExpanded ? "Retrair menu" : "Expandir menu"}
          >
            {isExpanded ? "←" : "→"}
          </button>
        </div>
      </div>

      <nav className="flex-1 px-2 py-5">
        <ul className="space-y-2">
          {navigationItems.map((item, index) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/app/precificacao" && pathname === "/app");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex w-full items-center rounded-[22px] border px-4 py-3 text-sm transition ${
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent)] font-medium text-white shadow-[0_14px_30px_rgba(108,86,255,0.28)]"
                      : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
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
        className={`rounded-[32px] border border-[var(--panel-border)] bg-[var(--sidebar-bg)] px-3 py-4 text-sm text-[var(--muted)] shadow-[0_18px_48px_rgba(57,37,118,0.08)] backdrop-blur-xl ${
          isExpanded ? "" : "text-center"
        }`}
      >
        {isExpanded ? (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
              Workspace
            </p>
            <p className="mt-2 truncate text-[var(--foreground)]">
              {workspaceName}
            </p>
            <p className="mt-1 truncate text-xs text-[var(--muted)]">
              {operatorLabel}
            </p>

            <div className="mt-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4">
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

        <Link
          href="/login"
          className={`mt-4 block rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.84)] px-4 py-2 text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white ${
            isExpanded ? "w-full text-left" : "w-10 px-0 text-center"
          }`}
          title={isExpanded ? undefined : "Trocar acesso"}
        >
          {isExpanded ? "Trocar acesso" : "↗"}
        </Link>
      </div>
    </aside>
  );
}
