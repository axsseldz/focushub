"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sidebarItems = [
  {
    label: "Biblioteca",
    href: "/lectura",
    icon: <LibraryIcon />,
  },
  {
    label: "Analítica",
    href: "/analitica",
    icon: <AnalyticsIcon />,
  },
] as const;

/**
 * Sidebar compartido por las tres pantallas de la app (Biblioteca,
 * Dashboard, Analítica). Layout compacto, sin chrome de más, con el
 * cluster de cuenta + tema anclado al pie para que el usuario tenga
 * todo a la mano sin perder vertical.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200/80 bg-slate-50/60 px-4 py-5 dark:border-zinc-800 dark:bg-zinc-950/50">
      <Link
        href="/"
        className="inline-block px-2 bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_55%,#38bdf8_100%)] bg-clip-text text-[17px] font-semibold tracking-[-0.04em] text-transparent transition-opacity hover:opacity-85 dark:bg-[linear-gradient(135deg,#3b82f6_0%,#60a5fa_55%,#93c5fd_100%)]"
      >
        FocusHub
      </Link>

      <nav
        aria-label="Navegación principal"
        className="mt-7 flex flex-col gap-0.5"
      >
        {sidebarItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname?.startsWith(`${item.href}/`) ?? false);

          const base =
            "group flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium tracking-[-0.01em] transition-colors";
          const cls = isActive
            ? `${base} bg-white text-slate-950 shadow-[0_1px_0_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.04)] dark:bg-zinc-800 dark:text-zinc-50`
            : `${base} text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-100`;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cls}
            >
              <span
                aria-hidden="true"
                className={
                  isActive
                    ? "text-slate-900 dark:text-zinc-100"
                    : "text-slate-400 dark:text-zinc-500"
                }
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function LibraryIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 5.5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 10 5.5v13A1.5 1.5 0 0 1 8.5 20h-2A1.5 1.5 0 0 1 5 18.5v-13ZM12 5.5A1.5 1.5 0 0 1 13.5 4h2A1.5 1.5 0 0 1 17 5.5v13A1.5 1.5 0 0 1 15.5 20h-2A1.5 1.5 0 0 1 12 18.5v-13ZM18.2 7.32l1.9-.5a1 1 0 0 1 1.22.71l2.9 10.86"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M6.5 18.25V10.5M12 18.25V6.25M17.5 18.25v-4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
