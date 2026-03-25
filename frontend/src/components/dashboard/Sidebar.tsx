import Link from "next/link";

const sidebarItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    state: "active",
    icon: <DashboardIcon />,
  },
  {
    label: "Analítica",
    state: "disabled",
    icon: <AnalyticsIcon />,
  },
] as const;

export function Sidebar() {
  return (
    <aside className="flex h-full flex-col bg-slate-50/85 px-4 py-5 sm:px-5 lg:px-6 lg:py-7">
      <div>
        <Link
          href="/"
          className="inline-block bg-[linear-gradient(135deg,#0f172a_0%,#2563eb_55%,#38bdf8_100%)] bg-clip-text text-lg font-semibold tracking-[-0.04em] text-transparent transition-opacity hover:opacity-85 sm:text-xl"
        >
          FocusHub
        </Link>
      </div>

      <nav
        aria-label="Navegación principal"
        className="mt-8 space-y-1.5"
      >
        {sidebarItems.map((item) => {
          const sharedClasses =
            "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-colors";

          if (item.state === "disabled") {
            return (
              <span
                key={item.label}
                className={`${sharedClasses} cursor-default text-slate-400 opacity-55`}
              >
                <span className="text-current">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            );
          }

          const itemClasses =
            item.state === "active"
              ? `${sharedClasses} border border-slate-200 bg-white text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.05)]`
              : `${sharedClasses} text-slate-600 hover:bg-white hover:text-slate-950`;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={itemClasses}
            >
              <span className="text-current">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4.5 w-4.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.75 6.75A2 2 0 0 1 6.75 4.75h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-3.5a2 2 0 0 1-2-2v-3.5ZM11.75 13.75a2 2 0 0 1 2-2h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-3.5a2 2 0 0 1-2-2v-3.5ZM4.75 13.75a2 2 0 0 1 2-2h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-3.5a2 2 0 0 1-2-2v-3.5ZM11.75 6.75a2 2 0 0 1 2-2h3.5a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-3.5a2 2 0 0 1-2-2v-3.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4.5 w-4.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6.5 18.25V10.5M12 18.25V6.25M17.5 18.25v-4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
