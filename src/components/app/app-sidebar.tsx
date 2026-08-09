"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { PersistenceMode } from "@/lib/server/persistence-mode";
import type { PlatformRole } from "@/lib/server/platform";
import {
  defaultAppPreferences,
  loadAppPreferences,
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
  { href: "/app/usuarios", label: "Usuários", superAdminOnly: true },
];

export function AppSidebar({
  persistenceMode,
  platformRole,
}: {
  persistenceMode: PersistenceMode;
  platformRole: PlatformRole;
}) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(
    defaultAppPreferences.workspaceName,
  );
  const [operatorLabel, setOperatorLabel] = useState("Configuração pendente");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
        ? "dark"
        : "light";
    }

    return "light";
  });
  const visibleNavigationItems = navigationItems.filter(
    (item) => !item.superAdminOnly || platformRole === "super_admin",
  );

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      `${isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}px`,
    );
  }, [isExpanded]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

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
    void loadAppPreferences()
      .then((preferences) => {
        setWorkspaceName(preferences.workspaceName || "Dabi Price");
        setOperatorLabel(
          preferences.operatorEmail ||
            preferences.operatorName ||
            "Configuração pendente",
        );
      })
      .catch(() => undefined);

    return subscribeAppPreferences(syncPreferences);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobileOpen]);

  function applyTheme(themeMode: ThemeMode) {
    setThemeMode(themeMode);
  }

  function toggleTheme() {
    applyTheme(themeMode === "dark" ? "light" : "dark");
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--panel-border)] bg-[rgba(255,255,255,0.86)] px-4 py-3 shadow-[0_12px_34px_rgba(57,37,118,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[1488px] items-center justify-between gap-3">
          <Link
            href="/app/precificacao"
            className="min-w-0 text-xl font-semibold tracking-[-0.08em] text-[var(--foreground)]"
          >
            Dabi<span className="text-[var(--accent)]"> Price</span>
          </Link>

          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
            aria-label="Abrir menu"
            title="Abrir menu"
          >
            ☰
          </button>
        </div>
      </div>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#0f0a23]/56 backdrop-blur-[3px]"
            aria-label="Fechar menu"
            onClick={() => setIsMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[88vw] max-w-[360px] flex-col border-r border-[var(--panel-border)] bg-[var(--sidebar-bg)] px-4 py-4 shadow-[0_24px_70px_rgba(12,8,32,0.24)] backdrop-blur-xl">
            <div className="rounded-[32px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.52)] px-4 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 text-2xl font-semibold leading-none tracking-[-0.08em] text-[var(--foreground)]">
                  Dabi<span className="text-[var(--accent)]"> Price</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                  aria-label="Fechar menu"
                  title="Fechar menu"
                >
                  ✕
                </button>
              </div>
            </div>

            <nav className="flex-1 px-1 py-5">
              <ul className="space-y-2">
                {visibleNavigationItems.map((item, index) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href === "/app/precificacao" && pathname === "/app");

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={`flex w-full items-center rounded-[22px] border px-4 py-3 text-sm transition ${
                          isActive
                            ? "border-[var(--accent)] bg-[var(--accent)] font-medium text-white shadow-[0_14px_30px_rgba(108,86,255,0.28)]"
                            : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <span className="mr-3 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-current/20 text-[10px]">
                          {isActive ? String(index + 1) : "."}
                        </span>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="rounded-[32px] border border-[var(--panel-border)] bg-[rgba(255,255,255,0.52)] px-3 py-4 text-sm text-[var(--muted)]">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                Workspace
              </p>
              <p className="mt-2 truncate text-[var(--foreground)]">
                {workspaceName}
              </p>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                {operatorLabel}
              </p>
              <p
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                  persistenceMode === "database"
                    ? "border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] text-[var(--muted)]"
                    : "border-[color:var(--warning)]/24 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
                }`}
                title={
                  persistenceMode === "database"
                    ? "Persistencia compartilhada ativa."
                    : "Modo local sem DATABASE_URL."
                }
              >
                {persistenceMode === "database" ? "Banco" : "Local"}
              </p>

              <div className="mt-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Tema
                </p>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Claro / Escuro
                  </p>

                  <button
                    type="button"
                    data-theme-switch
                    onClick={toggleTheme}
                    aria-label="Alternar entre modo claro e escuro"
                    aria-pressed={themeMode === "dark"}
                    className="relative h-7 w-12 shrink-0 rounded-full border border-[color:var(--panel-border)] bg-[var(--foreground)] transition"
                  >
                    <span className="absolute top-1 left-1 size-5 rounded-full bg-white shadow-sm transition" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                className="mt-4 block rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.84)] px-4 py-2 text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
              >
                {isSigningOut ? "Saindo..." : "Sair"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
            {visibleNavigationItems.map((item, index) => {
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
              <p
                className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                  persistenceMode === "database"
                    ? "border-[var(--panel-border)] bg-[rgba(255,255,255,0.76)] text-[var(--muted)]"
                    : "border-[color:var(--warning)]/24 bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
                }`}
                title={
                  persistenceMode === "database"
                    ? "Persistencia compartilhada ativa."
                    : "Modo local sem DATABASE_URL."
                }
              >
                {persistenceMode === "database" ? "Banco" : "Local"}
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
                    type="button"
                    data-theme-switch
                    onClick={toggleTheme}
                    aria-label="Alternar entre modo claro e escuro"
                    aria-pressed={themeMode === "dark"}
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
    </>
  );
}
