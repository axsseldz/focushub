"use client";

import { useState } from "react";
import { HeaderPopover } from "@/components/reading-mode/HeaderPopover";
import { useTheme } from "@/lib/theme";

type Props = {
  onShowCode: () => void;
  onSyncToLibrary: () => void;
  onDownloadPdf: () => void;
  syncing: boolean;
  compiling: boolean;
  pdfReady: boolean;
};

/**
 * Menú único de ajustes del workspace. Agrupa las acciones secundarias
 * (ver código, guardar en biblioteca, descargar PDF, tema) detrás de
 * un solo botón para mantener el header limpio — mismo patrón que el
 * lector.
 */
export function WorkspaceSettingsMenu({
  onShowCode,
  onSyncToLibrary,
  onDownloadPdf,
  syncing,
  compiling,
  pdfReady,
}: Props) {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const triggerClass = open
    ? "border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100";

  return (
    <HeaderPopover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      width={280}
      trigger={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Ajustes del proyecto"
          title="Ajustes"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${triggerClass}`}
        >
          <SettingsIcon />
        </button>
      }
    >
      <div className="divide-y divide-slate-100 dark:divide-zinc-800">
        <Section title="Documento">
          <ActionRow
            label="Ver código"
            description="Abrir el editor de LaTeX"
            icon={<CodeIcon />}
            onClick={() => {
              onShowCode();
              setOpen(false);
            }}
          />
          <ActionRow
            label="Descargar PDF"
            description={pdfReady ? "Guardar el reporte en tu equipo" : "Disponible al terminar de compilar"}
            icon={<DownloadIcon />}
            disabled={!pdfReady || compiling}
            onClick={() => {
              onDownloadPdf();
              setOpen(false);
            }}
          />
          <ActionRow
            label={syncing ? "Guardando…" : "Guardar en biblioteca"}
            description="Compila y agrega el PDF a tu biblioteca"
            icon={<LibraryIcon />}
            disabled={syncing || compiling}
            onClick={() => {
              onSyncToLibrary();
              setOpen(false);
            }}
          />
        </Section>

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

function ActionRow({
  label,
  description,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-zinc-800/70"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium text-slate-800 dark:text-zinc-100">
          {label}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-zinc-500">
          {description}
        </span>
      </span>
    </button>
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
  return (
    <svg aria-hidden="true" className="h-[1.05rem] w-[1.05rem]" fill="none" viewBox="0 0 24 24">
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

function CodeIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 4.5h4v15H5zM10.5 4.5h4v15h-4zM16.6 5l3.5 1-3 14-3.5-1z"
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
