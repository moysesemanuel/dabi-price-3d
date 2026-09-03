"use client";

import Link from "next/link";

import { DabiWordmark } from "@/components/brand/dabi-brand";
import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "dabi-price-theme";

type ThemeMode = "light" | "dark";

export const landingNavLinks = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Segmentos", href: "#segmentos" },
  { label: "Planos", href: "#planos" },
  { label: "FAQ", href: "#faq" },
];

export function LandingWordmark({ size }: { size?: "lg" }) {
  return <DabiWordmark size={size ?? "md"} />;
}

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark"
        ? "dark"
        : "light";
    }

    return "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      /* preferencia visual nunca derruba a pagina */
    }
  }, [themeMode]);

  function toggleTheme() {
    setThemeMode((previous) => (previous === "dark" ? "light" : "dark"));
  }

  return (
    <header className="landing-header">
      <div className="landing-shell">
        <div className="landing-header__bar">
          <div className="flex items-center gap-10">
            <Link href="/" aria-label="DaBi Price">
              <LandingWordmark />
            </Link>

            <nav className="hidden items-center gap-7 lg:flex">
              {landingNavLinks.map((item) => (
                <a key={item.href} href={item.href} className="landing-link">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                themeMode === "dark"
                  ? "Usar modo claro"
                  : "Usar modo escuro"
              }
              aria-pressed={themeMode === "dark"}
              className="landing-header__toggle !flex"
              style={{ width: 40, height: 40 }}
            >
              <span aria-hidden="true">
                {themeMode === "dark" ? "☾" : "☀"}
              </span>
            </button>

            <Link
              href="/login"
              className="hidden text-[13px] font-medium sm:inline-flex"
            >
              Entrar
            </Link>
            <Link href="/planos" className="landing-cta landing-cta--sm">
              Começar agora
            </Link>

            <button
              type="button"
              className="landing-header__toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              aria-controls="landing-menu-mobile"
            >
              <span aria-hidden="true">{menuOpen ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div id="landing-menu-mobile" className="landing-header__panel">
            {landingNavLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="landing-link py-3 text-[15px]"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              className="landing-link py-3 text-[15px]"
              onClick={() => setMenuOpen(false)}
            >
              Entrar
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
