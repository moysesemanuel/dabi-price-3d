"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import horizontalLogo from "@/app/dabi-price-horizontal.svg";
import whiteLogo from "@/app/logo-dabi-branco.svg";
import blackLogo from "@/app/logo-dabi-preto.svg";
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
type SidebarIconProps = SVGProps<SVGSVGElement>;
type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<SidebarIconProps>;
  superAdminOnly?: boolean;
};

function CalculatorFillIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 .5v2a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5m0 4v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M4.5 9a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM4 12.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M7.5 6a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM7 9.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m.5 2.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM10 6.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m.5 2.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z" />
    </svg>
  );
}

function ClockHistoryIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.515 1.019A7 7 0 0 0 8 1V0a8 8 0 0 1 .589.022zm2.004.45a7 7 0 0 0-.985-.299l.219-.976q.576.129 1.126.342zm1.37.71a7 7 0 0 0-.439-.27l.493-.87a8 8 0 0 1 .979.654l-.615.789a7 7 0 0 0-.418-.302zm1.834 1.79a7 7 0 0 0-.653-.796l.724-.69q.406.429.747.91zm.744 1.352a7 7 0 0 0-.214-.468l.893-.45a8 8 0 0 1 .45 1.088l-.95.313a7 7 0 0 0-.179-.483m.53 2.507a7 7 0 0 0-.1-1.025l.985-.17q.1.58.116 1.17zm-.131 1.538q.05-.254.081-.51l.993.123a8 8 0 0 1-.23 1.155l-.964-.267q.069-.247.12-.501m-.952 2.379q.276-.436.486-.908l.914.405q-.24.54-.555 1.038zm-.964 1.205q.183-.183.35-.378l.758.653a8 8 0 0 1-.401.432z" />
      <path d="M8 1a7 7 0 1 0 4.95 11.95l.707.707A8.001 8.001 0 1 1 8 0z" />
      <path d="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5" />
    </svg>
  );
}

function SlidersIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1z"
      />
    </svg>
  );
}

function QuestionCircleIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
      <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286m1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94" />
    </svg>
  );
}

function HeadsetIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 1a5 5 0 0 0-5 5v1h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a6 6 0 1 1 12 0v6a2.5 2.5 0 0 1-2.5 2.5H9.366a1 1 0 0 1-.866.5h-1a1 1 0 1 1 0-2h1a1 1 0 0 1 .866.5H11.5A1.5 1.5 0 0 0 13 12h-1a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h1V6a5 5 0 0 0-5-5" />
    </svg>
  );
}

function PersonCircleIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0" />
      <path
        fillRule="evenodd"
        d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1"
      />
    </svg>
  );
}

function PeopleIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M15 14s1 0 1-1-1-4-5-4-5 3-5 4 1 1 1 1zm-7.978-1L7 12.996c.001-.264.167-1.03.76-1.72C8.312 10.629 9.282 10 11 10c1.717 0 2.687.63 3.24 1.276.593.69.758 1.457.76 1.72l-.008.002-.014.002zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4m3-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0M6.936 9.28a6 6 0 0 0-1.23-.247A7 7 0 0 0 5 9c-4 0-5 3-5 4q0 1 1 1h4.216A2.24 2.24 0 0 1 5 13c0-1.01.377-2.042 1.09-2.904.243-.294.526-.569.846-.816M4.92 10A5.5 5.5 0 0 0 4 13H1c0-.26.164-1.03.76-1.724.545-.636 1.492-1.256 3.16-1.275ZM1.5 5.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0m3-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />
    </svg>
  );
}

const navigationItems: NavigationItem[] = [
  {
    href: "/app/precificacao",
    label: "Precificadora",
    icon: CalculatorFillIcon,
  },
  { href: "/app/historico", label: "Histórico", icon: ClockHistoryIcon },
  { href: "/app/preferencias", label: "Preferências", icon: SlidersIcon },
  { href: "/app/ajuda", label: "Ajuda", icon: QuestionCircleIcon },
  { href: "/app/suporte", label: "Suporte", icon: HeadsetIcon },
  { href: "/app/conta", label: "Conta", icon: PersonCircleIcon },
  {
    href: "/app/usuarios",
    label: "Usuários",
    icon: PeopleIcon,
    superAdminOnly: true,
  },
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

  const sidebarCollapsedLogoSrc =
    themeMode === "dark"
      ? whiteLogo
      : blackLogo;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--panel-border)] bg-[rgba(255,255,255,0.86)] px-4 py-3 shadow-[0_12px_34px_rgba(57,37,118,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[1488px] items-center justify-between gap-3">
          <Link
            href="/app/precificacao"
            className="min-w-0"
            aria-label="Dabi Price"
          >
            {themeMode === "dark" ? (
              <Image
                src={whiteLogo}
                alt="Dabi Price"
                width={84}
                height={84}
                unoptimized
                className="h-8 w-auto"
              />
            ) : (
              <Image
                src={horizontalLogo}
                alt="Dabi Price"
                width={176}
                height={42}
                unoptimized
                className="h-8 w-auto"
              />
            )}
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
                  {themeMode === "dark" ? (
                    <Image
                      src={whiteLogo}
                      alt="Dabi Price"
                      width={96}
                      height={96}
                      unoptimized
                      className="h-9 w-auto"
                    />
                  ) : (
                    <Image
                      src={horizontalLogo}
                      alt="Dabi Price"
                      width={198}
                      height={47}
                      unoptimized
                      className="h-9 w-auto"
                    />
                  )}
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
                {visibleNavigationItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href === "/app/precificacao" && pathname === "/app");
                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsMobileOpen(false)}
                        className={`flex w-full items-center rounded-[22px] border px-4 py-3 text-sm transition-colors duration-150 ${
                          isActive
                            ? "border-[var(--accent)] bg-[var(--accent)] font-medium text-white"
                            : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                        }`}
                      >
                        <span className="mr-3 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-current/12">
                          <Icon className="size-4" />
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
          <div className="flex flex-col gap-3">
            <div
              className={`min-w-0 whitespace-nowrap text-[var(--foreground)] ${
                isExpanded ? "" : "flex justify-center"
              }`}
            >
              {isExpanded ? (
                themeMode === "dark" ? (
                  <Image
                    src={whiteLogo}
                    alt="Dabi Price"
                    width={96}
                    height={96}
                    unoptimized
                    className="h-9 w-auto"
                  />
                ) : (
                  <Image
                    src={horizontalLogo}
                    alt="Dabi Price"
                    width={198}
                    height={47}
                    unoptimized
                    className="h-9 w-auto"
                  />
                )
              ) : (
                <Image
                  src={sidebarCollapsedLogoSrc}
                  alt="Dabi Price"
                  width={64}
                  height={64}
                  unoptimized
                  className="h-10 w-auto"
                />
              )}
            </div>

            <div className={isExpanded ? "flex justify-end" : "flex justify-center"}>
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
        </div>

        <nav className="flex-1 px-2 py-5">
          <ul className="space-y-2">
            {visibleNavigationItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/app/precificacao" && pathname === "/app");
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex w-full items-center rounded-[22px] border text-sm transition-colors duration-150 ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent)] font-medium text-white"
                        : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                    } ${isExpanded ? "justify-start px-4 py-3" : "justify-center px-2 py-2.5"}`}
                    title={isExpanded ? undefined : item.label}
                  >
                    <span
                      className={`inline-flex shrink-0 items-center justify-center bg-current/12 ${
                        isExpanded
                          ? "mr-3 size-9 rounded-2xl"
                          : "size-8 rounded-[18px]"
                      }`}
                    >
                      <Icon className="size-4" />
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
