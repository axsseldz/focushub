"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "@/lib/theme";

// Returns false during SSR and initial hydration, then true — lets us defer
// theme-dependent content past hydration without a setState-in-effect warning.
const emptySubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

/**
 * ThemeToggle
 *
 * A compact icon button that switches between light and dark mode.
 * Can be placed in any header, sidebar, or nav bar.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        mounted
          ? isDark
            ? "Cambiar a modo claro"
            : "Cambiar a modo oscuro"
          : "Cambiar tema"
      }
      title={mounted ? (isDark ? "Modo claro" : "Modo oscuro") : "Tema"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-100"
    >
      {mounted ? (
        isDark ? (
          <SunIcon />
        ) : (
          <MoonIcon />
        )
      ) : (
        <span aria-hidden="true" className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
