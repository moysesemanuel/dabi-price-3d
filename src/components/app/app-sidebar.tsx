"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import horizontalLogo from "@/app/dabi-price-horizontal.svg";
import whiteLogo from "@/app/logo-dabi-branco.svg";
import blackLogo from "@/app/logo-dabi-preto.svg";
import type { PlatformRole } from "@/lib/server/platform";
import {
  defaultAppPreferences,
  getWorkspacePlan,
  loadAppPreferences,
  readAppPreferences,
  subscribeAppPreferences,
} from "@/lib/settings/app-preferences";

const EXPANDED_WIDTH = 262;
const COLLAPSED_WIDTH = 96;
const THEME_STORAGE_KEY = "dabi-price-theme";

type ThemeMode = "light" | "dark";
type SidebarIconProps = SVGProps<SVGSVGElement>;
type NavigationItem = {
  href: string;
  label: string;
  icon: ComponentType<SidebarIconProps>;
  superAdminOnly?: boolean;
};
type NavigationSection = {
  id: string;
  label: string;
  items: NavigationItem[];
};

function HouseDoorFillIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 2 8h.5v6A1.5 1.5 0 0 0 4 15.5h2A1.5 1.5 0 0 0 7.5 14v-2.5h1V14A1.5 1.5 0 0 0 10 15.5h2a1.5 1.5 0 0 0 1.5-1.5V8h.5a.5.5 0 0 0 .354-.854z" />
    </svg>
  );
}

function CalculatorFillIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm2 .5v2a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-2a.5.5 0 0 0-.5-.5h-7a.5.5 0 0 0-.5.5m0 4v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M4.5 9a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM4 12.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5M7.5 6a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM7 9.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m.5 2.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zM10 6.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5m.5 2.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5z" />
    </svg>
  );
}

function FileEarmarkTextIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M5.5 7a.5.5 0 0 0 0 1H10a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5H10a.5.5 0 0 1 0 1H5.5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5H8a.5.5 0 0 1 0 1H5.5a.5.5 0 0 1-.5-.5" />
      <path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5z" />
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

function BuildingIcon(props: SidebarIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M6.5 15V1h3v14zm-1 0V7h-4v8zm5 0h4V4h-4zM4 2a1 1 0 0 1 1-1h6.5a1 1 0 0 1 1 1V3H15a1 1 0 0 1 1 1v11h-1V4h-2.5v11h-9V8H1V7h2.5V2zM8 3.5A.5.5 0 0 0 7.5 4v1A.5.5 0 0 0 8 5.5h1a.5.5 0 0 0 .5-.5V4a.5.5 0 0 0-.5-.5zm0 3A.5.5 0 0 0 7.5 7v1A.5.5 0 0 0 8 8.5h1a.5.5 0 0 0 .5-.5V7a.5.5 0 0 0-.5-.5z" />
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

const navigationSections: NavigationSection[] = [
  {
    id: "workspace",
    label: "Operação",
    items: [
      { href: "/app", label: "Início", icon: HouseDoorFillIcon },
      {
        href: "/app/precificacao",
        label: "Precificadora",
        icon: CalculatorFillIcon,
      },
      {
        href: "/app/orcamentos",
        label: "Orçamentos",
        icon: FileEarmarkTextIcon,
      },
      {
        href: "/app/modelos-orcamento",
        label: "Modelos de orçamento",
        icon: SlidersIcon,
      },
    ],
  },
  {
    id: "company",
    label: "Empresa",
    items: [
      {
        href: "/app/perfil-empresa",
        label: "Perfil da empresa",
        icon: BuildingIcon,
      },
      { href: "/app/equipe", label: "Equipe", icon: PeopleIcon },
      {
        href: "/app/preferencias",
        label: "Preferências",
        icon: SlidersIcon,
      },
    ],
  },
  {
    id: "support",
    label: "Ajuda",
    items: [
      { href: "/app/ajuda", label: "Ajuda", icon: QuestionCircleIcon },
      { href: "/app/suporte", label: "Suporte", icon: HeadsetIcon },
      { href: "/app/conta", label: "Conta", icon: PersonCircleIcon },
      {
        href: "/app/usuarios",
        label: "Usuários",
        icon: PeopleIcon,
        superAdminOnly: true,
      },
    ],
  },
];

export function AppSidebar({ platformRole }: { platformRole: PlatformRole }) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState(
    defaultAppPreferences.workspaceName,
  );
  const [operatorLabel, setOperatorLabel] = useState("Configuração pendente");
  const [planLabel, setPlanLabel] = useState(
    getWorkspacePlan(defaultAppPreferences.subscription.planId).label,
  );
  const [planPriceLabel, setPlanPriceLabel] = useState(
    getWorkspacePlan(defaultAppPreferences.subscription.planId).monthlyPriceLabel,
  );
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
        ? "dark"
        : "light";
    }

    return "light";
  });

  const visibleSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.superAdminOnly || platformRole === "super_admin",
      ),
    }))
    .filter((section) => section.items.length > 0);

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
      const plan = getWorkspacePlan(preferences.subscription.planId);

      setWorkspaceName(preferences.workspaceName || "Dabi Price");
      setOperatorLabel(
        preferences.operatorEmail ||
          preferences.operatorName ||
          "Configuração pendente",
      );
      setPlanLabel(plan.label);
      setPlanPriceLabel(plan.monthlyPriceLabel);
    };

    syncPreferences();
    void loadAppPreferences().then(syncPreferences).catch(() => undefined);

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

  function toggleTheme() {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  }

  const sidebarCollapsedLogoSrc = themeMode === "dark" ? whiteLogo : blackLogo;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-[var(--panel-border)] bg-[rgba(255,255,255,0.86)] px-4 py-3 shadow-[0_12px_34px_rgba(57,37,118,0.08)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-[1488px] items-center justify-between gap-3">
          <Link href="/app" className="min-w-0" aria-label="Dabi Price">
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
                <div className="min-w-0">
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

            <nav className="flex-1 overflow-y-auto px-1 py-5">
              <div className="space-y-6">
                {visibleSections.map((section) => (
                  <div key={section.id}>
                    <p className="px-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                      {section.label}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <NavigationLink
                            item={item}
                            pathname={pathname}
                            isExpanded
                            onClick={() => setIsMobileOpen(false)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </nav>

            <SidebarFooter
              isExpanded
              workspaceName={workspaceName}
              operatorLabel={operatorLabel}
              planLabel={planLabel}
              planPriceLabel={planPriceLabel}
              themeMode={themeMode}
              onToggleTheme={toggleTheme}
              onSignOut={() => void handleSignOut()}
              isSigningOut={isSigningOut}
            />
          </div>
        </div>
      ) : null}

      <aside className="hidden transition-[width] duration-300 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[var(--app-sidebar-width)] lg:flex-col lg:bg-transparent lg:px-4 lg:py-4">
        <div className="rounded-[32px] border border-[var(--panel-border)] bg-[var(--sidebar-bg)] px-4 py-5 shadow-[0_18px_48px_rgba(57,37,118,0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/app"
              className={`min-w-0 ${isExpanded ? "" : "mx-auto"}`}
              aria-label="Dabi Price"
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
            </Link>

            {isExpanded ? (
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                aria-label="Retrair menu lateral"
                title="Retrair menu"
              >
                ←
              </button>
            ) : null}
          </div>

          {!isExpanded ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
                aria-label="Expandir menu lateral"
                title="Expandir menu"
              >
                →
              </button>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-5">
          <div className="space-y-6">
            {visibleSections.map((section) => (
              <div key={section.id}>
                {isExpanded ? (
                  <p className="px-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
                    {section.label}
                  </p>
                ) : null}
                <ul className="mt-2 space-y-2">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <NavigationLink
                        item={item}
                        pathname={pathname}
                        isExpanded={isExpanded}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <SidebarFooter
          isExpanded={isExpanded}
          workspaceName={workspaceName}
          operatorLabel={operatorLabel}
          planLabel={planLabel}
          planPriceLabel={planPriceLabel}
          themeMode={themeMode}
          onToggleTheme={toggleTheme}
          onSignOut={() => void handleSignOut()}
          isSigningOut={isSigningOut}
        />
      </aside>
    </>
  );
}

function NavigationLink({
  item,
  pathname,
  isExpanded,
  onClick,
}: {
  item: NavigationItem;
  pathname: string;
  isExpanded: boolean;
  onClick?: () => void;
}) {
  const isActive = isNavigationItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex w-full items-center rounded-[22px] border text-sm transition-colors duration-150 ${
        isActive
          ? "border-[var(--accent)] bg-[var(--accent)] font-medium text-white"
          : "border-[var(--panel-border)] bg-[rgba(255,255,255,0.78)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
      } ${isExpanded ? "justify-start px-4 py-3" : "justify-center px-2 py-2.5"}`}
      title={isExpanded ? undefined : item.label}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center bg-current/12 ${
          isExpanded ? "mr-3 size-9 rounded-2xl" : "size-9 rounded-2xl"
        }`}
      >
        <Icon className="size-4" />
      </span>
      {isExpanded ? item.label : null}
    </Link>
  );
}

function SidebarFooter({
  isExpanded,
  workspaceName,
  operatorLabel,
  planLabel,
  planPriceLabel,
  themeMode,
  onToggleTheme,
  onSignOut,
  isSigningOut,
}: {
  isExpanded: boolean;
  workspaceName: string;
  operatorLabel: string;
  planLabel: string;
  planPriceLabel: string;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onSignOut: () => void;
  isSigningOut: boolean;
}) {
  return (
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
          <p className="mt-2 truncate text-[var(--foreground)]">{workspaceName}</p>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {operatorLabel}
          </p>

          <div className="mt-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Plano atual
                </p>
                <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                  {planLabel}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {planPriceLabel}/mês
                </p>
              </div>

              <Link
                href="/app/planos"
                className="rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.82)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
              >
                Ver planos
              </Link>
            </div>
          </div>

          <div className="mt-4 rounded-[24px] border border-[var(--panel-border)] bg-[var(--panel-soft)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-[var(--muted)]">
                  Tema
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
                  Claro / Escuro
                </p>
              </div>

              <button
                type="button"
                data-theme-switch
                onClick={onToggleTheme}
                aria-label="Alternar entre modo claro e escuro"
                aria-pressed={themeMode === "dark"}
                className="relative h-7 w-12 shrink-0 rounded-full border border-[color:var(--panel-border)] bg-[var(--foreground)] transition"
              >
                <span
                  className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition ${
                    themeMode === "dark" ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onSignOut}
            className="mt-4 block rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.84)] px-4 py-2 text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
          >
            {isSigningOut ? "Saindo..." : "Sair"}
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-soft)] text-center">
            <span className="text-xs font-semibold uppercase text-[var(--foreground)]">
              {planLabel.slice(0, 2)}
            </span>
          </div>
          <Link
            href="/app/planos"
            className="block rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.84)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
            title="Ver planos"
          >
            Planos
          </Link>
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.84)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
            aria-label="Alternar entre modo claro e escuro"
            title="Alternar tema"
          >
            {themeMode === "dark" ? "☾" : "☀"}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-[var(--panel-border)] bg-[rgba(255,255,255,0.84)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white"
            aria-label="Sair"
            title="Sair"
          >
            ⇢
          </button>
        </div>
      )}
    </div>
  );
}

function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/app") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
