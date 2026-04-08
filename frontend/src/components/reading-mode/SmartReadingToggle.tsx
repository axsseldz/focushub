"use client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SmartReadingToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SmartReadingToggle
 *
 * A pill-shaped toggle button that enables / disables the gesture-based
 * "smart reading" feature. Includes an animated switch indicator so the
 * current state is always visually clear.
 */
export function SmartReadingToggle({ enabled, onToggle }: SmartReadingToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
        enabled
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
      }`}
    >
      <HandSparkleIcon active={enabled} />

      <span>Habilitar lectura inteligente</span>

      {/* Animated toggle pill */}
      <span
        aria-hidden="true"
        className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ${
          enabled ? "bg-emerald-400" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            enabled ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

function HandSparkleIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 shrink-0 transition-colors duration-200 ${
        active ? "text-emerald-500" : "text-slate-400"
      }`}
      fill="none"
      viewBox="0 0 24 24"
    >
      {/* Hand outline */}
      <path
        d="M18 11V9a2 2 0 0 0-4 0v-.5M14 8.5V6a2 2 0 0 0-4 0v3M10 9V5a2 2 0 0 0-4 0v8l-1.5-2a1.5 1.5 0 0 0-2.122 2.122L5 18a7 7 0 0 0 7 3.5 7 7 0 0 0 7-7v-3.5a2 2 0 0 0-4 0V11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      {/* Sparkle dots — only visible when active */}
      {active && (
        <>
          <circle cx="20" cy="4" r="1" fill="currentColor" />
          <circle cx="22" cy="7" r="0.75" fill="currentColor" />
          <circle cx="19" cy="7.5" r="0.75" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
