"use client";

import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "dabi-price-theme";

type ThemeMode = "light" | "dark";

/**
 * O <html> sai do servidor sempre com data-theme="light". Este componente
 * reaplica a preferencia guardada assim que hidrata, entao ele precisa estar
 * em toda pagina publica — nao so onde ha um botao para clicar. Reusa a mesma
 * chave do app-sidebar: uma preferencia so para o produto inteiro.
 */
export function LandingThemeToggle() {
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

  return (
    <button
      type="button"
      onClick={() =>
        setThemeMode((previous) => (previous === "dark" ? "light" : "dark"))
      }
      aria-label={themeMode === "dark" ? "Usar modo claro" : "Usar modo escuro"}
      aria-pressed={themeMode === "dark"}
      className="landing-header__theme"
    >
      <span aria-hidden="true">{themeMode === "dark" ? "☾" : "☀"}</span>
    </button>
  );
}
