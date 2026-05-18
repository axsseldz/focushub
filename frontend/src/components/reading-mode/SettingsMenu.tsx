"use client";

import { useState } from "react";
import { HeaderPopover } from "@/components/reading-mode/HeaderPopover";
import { useTheme } from "@/lib/theme";

export type ReaderTone = "light" | "sepia" | "dark";

type SettingsMenuProps = {
  // Zoom
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  // Tono
  tone: ReaderTone;
  onToneChange: (tone: ReaderTone) => void;
  /** Variante de estilo para focus mode (glass oscuro). */
  compact?: boolean;
};

/**
 * Menú único de ajustes del lector. Agrupa la configuración
 * secundaria (zoom, tono, tema) para que la barra superior solo
 * exponga las acciones principales del lector.
 */
export function SettingsMenu(props: SettingsMenuProps) {
  const { compact = false } = props;
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const triggerClass = (() => {
    if (open) {
      return compact
        ? "border-white/30 bg-white/20 text-white"
        : "border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900";
    }
    if (compact) {
      return "border-white/20 bg-white/10 text-white/90 backdrop-blur hover:bg-white/20";
    }
    return "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100";
  })();

  return (
    <HeaderPopover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      width={300}
      compact={compact}
      trigger={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Ajustes de lectura"
          title="Ajustes"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${triggerClass}`}
        >
          <SettingsIcon />
        </button>
      }
    >
      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
        {/* ----- LECTURA ----- */}
        <Section title="Lectura">
          <Row label="Zoom">
            <div className="inline-flex items-center overflow-hidden rounded-full border border-slate-200 dark:border-zinc-700">
              <IconButton
                onClick={props.onZoomOut}
                disabled={!props.canZoomOut}
                label="Reducir zoom"
              >
                <MinusIcon />
              </IconButton>
              <button
                type="button"
                onClick={props.onZoomReset}
                className="inline-flex h-7 min-w-[3.25rem] items-center justify-center border-x border-slate-200 text-[0.72rem] font-medium tabular-nums text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                title="Restablecer zoom"
              >
                {Math.round(props.zoom * 100)}%
              </button>
              <IconButton
                onClick={props.onZoomIn}
                disabled={!props.canZoomIn}
                label="Aumentar zoom"
              >
                <PlusIcon />
              </IconButton>
            </div>
          </Row>
          <Row label="Tono">
            <ToneSegment value={props.tone} onChange={props.onToneChange} />
          </Row>
        </Section>

        {/* ----- APARIENCIA ----- */}
        <Section title="Apariencia">
          <Row label="Tema">
            <ThemeSegment
              value={theme}
              onChange={(value) => {
                if (value !== theme) toggleTheme();
              }}
            />
          </Row>
        </Section>
      </div>
    </HeaderPopover>
  );
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-1 py-2">
      <p className="px-3 pb-1 pt-1 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2">
      <span className="text-sm text-slate-700 dark:text-zinc-200">{label}</span>
      {children}
    </div>
  );
}

function IconButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function ToneSegment({
  value,
  onChange,
}: {
  value: ReaderTone;
  onChange: (next: ReaderTone) => void;
}) {
  const options: { id: ReaderTone; label: string }[] = [
    { id: "light", label: "Día" },
    { id: "sepia", label: "Sepia" },
    { id: "dark", label: "Noche" },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-slate-200 dark:border-zinc-700">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ThemeSegment({
  value,
  onChange,
}: {
  value: "light" | "dark";
  onChange: (next: "light" | "dark") => void;
}) {
  const options: { id: "light" | "dark"; label: string; icon: React.ReactNode }[] = [
    { id: "light", label: "Claro", icon: <SunIcon /> },
    { id: "dark", label: "Oscuro", icon: <MoonIcon /> },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-full border border-slate-200 dark:border-zinc-700">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SettingsIcon() {
  // Tres sliders horizontales con sus perillas. Comunica
  // "configuración" de forma más directa y limpia que el engranaje
  // mecánico genérico, y combina mejor con el resto del lenguaje
  // visual minimalista del lector.
  return (
    <svg
      aria-hidden="true"
      className="h-[1.05rem] w-[1.05rem]"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.75 7.25h6.5M14.75 7.25h4.5M4.75 12h2.5M10.75 12h8.5M4.75 16.75h10.5M18.75 16.75h.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <circle cx="13" cy="7.25" r="1.75" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="12" r="1.75" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17" cy="16.75" r="1.75" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
      <path d="M12 5.5v13M5.5 12h13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
      <path d="M5.5 12h13" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
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

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
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
