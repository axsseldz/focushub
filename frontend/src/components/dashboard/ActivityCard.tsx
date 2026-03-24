import Link from "next/link";
import type { ReactNode, RefObject } from "react";

type ActivityCardProps = {
  actionHref?: string;
  actionLabel?: string;
  cardRef: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  label?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  title: string;
};

export function ActivityCard({
  actionHref,
  actionLabel,
  cardRef,
  compact = false,
  description,
  disabled = false,
  icon,
  label,
  onMouseEnter,
  onMouseLeave,
  title,
}: ActivityCardProps) {
  const cardClasses = disabled
    ? "border-slate-200/85 bg-slate-50/80 text-slate-500"
    : "border-slate-200/80 bg-white text-slate-950";

  return (
    <article
      ref={cardRef}
      onMouseEnter={disabled ? undefined : onMouseEnter}
      onMouseLeave={disabled ? undefined : onMouseLeave}
      className={[
        "group relative overflow-hidden rounded-[1.75rem] border shadow-[0_14px_36px_rgba(15,23,42,0.045)] transition-colors duration-300",
        compact ? "p-5" : "p-6 sm:p-7",
        disabled ? "cursor-default" : "cursor-pointer",
        cardClasses,
      ].join(" ")}
    >
      {disabled ? (
        <div
          data-disabled-haze
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] bg-white/25 opacity-25 backdrop-blur-[1px]"
        />
      ) : null}

      <div className={`relative z-10 flex h-full flex-col ${disabled ? "opacity-90" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div
            data-card-icon
            className={[
              "flex h-11 w-11 items-center justify-center rounded-2xl border text-slate-900",
              disabled
                ? "border-slate-200/80 bg-white/70 text-slate-400"
                : "border-slate-200/80 bg-slate-50",
            ].join(" ")}
          >
            {icon}
          </div>
          {label ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {label}
            </span>
          ) : null}
        </div>

        <div className={compact ? "mt-5" : "mt-6"}>
          <h2
            className={[
              "font-semibold tracking-[-0.04em]",
              compact ? "text-xl" : "text-2xl",
              disabled ? "text-slate-700" : "text-slate-950",
            ].join(" ")}
          >
            {title}
          </h2>
          <p
            className={[
              "mt-3 leading-7",
              compact ? "text-sm" : "text-base",
              disabled ? "text-slate-500" : "text-slate-600",
            ].join(" ")}
          >
            {description}
          </p>
        </div>

        <div className={compact ? "mt-6" : "mt-auto pt-9"}>
          {disabled ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-500">
              {label ?? "Próximamente"}
            </span>
          ) : (
            <Link
              href={actionHref ?? "/lectura"}
              data-card-action
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2"
            >
              {actionLabel}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function ReadingIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.75 6.75A2.75 2.75 0 0 1 7.5 4h10.25a1.5 1.5 0 0 1 1.5 1.5v12.75H8.25A3.25 3.25 0 0 0 5 21.5V7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M8 8.25h7.5M8 11.75h7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function WritingIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.75 18.25V19.5h1.25L17.4 8.1l-2.5-2.5L4.75 15.75v2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="m13.95 6.55 2.5 2.5M9 19.5h10.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function FocusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 5.25v2.5M12 16.25v2.5M18.75 12h-2.5M7.75 12h-2.5M16.77 7.23l-1.77 1.77M9 15l-1.77 1.77M16.77 16.77 15 15M9 9 7.23 7.23"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <circle
        cx="12"
        cy="12"
        r="3.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function ExerciseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6.75 7.75h10.5M6.75 12h7.5M6.75 16.25h5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M5.5 4.75h13a1.75 1.75 0 0 1 1.75 1.75v11a1.75 1.75 0 0 1-1.75 1.75h-13a1.75 1.75 0 0 1-1.75-1.75v-11A1.75 1.75 0 0 1 5.5 4.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function AnalyticsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
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
