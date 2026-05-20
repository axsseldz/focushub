"use client";

import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/lib/theme";
import { registerLatexLanguage } from "@/lib/monaco-latex";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-[12px] text-slate-400">
        Cargando editor…
      </div>
    ),
  },
);

export type SnippetAnchor = {
  /** Viewport coords of the click — the popover anchors here. */
  client_x: number;
  client_y: number;
};

export type SnippetTarget = {
  start_line: number;
  end_line: number;
  content: string;
};

type Props = {
  open: boolean;
  anchor: SnippetAnchor | null;
  target: SnippetTarget | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (next: string) => Promise<void> | void;
};

/**
 * Floating inline editor that opens next to a click on the PDF canvas.
 *
 * The popover positions itself relative to the click anchor and
 * flips/scrolls so it stays in the viewport. The body is a Monaco
 * editor pre-filled with the LaTeX block under the click. On save, the
 * parent persists the snippet and triggers a recompile.
 */
export function InlineSnippetEditor({
  open,
  anchor,
  target,
  saving,
  onCancel,
  onSave,
}: Props) {
  const { theme } = useTheme();
  // ``target`` is set once when the popover opens and stays stable
  // for that edit session — the parent passes a fresh ``key`` on each
  // new locate, so this initializer runs anew for every snippet.
  const [draft, setDraft] = useState(target?.content ?? "");

  // Position the popover next to the click anchor, flipping if it
  // would overflow the viewport. We compute this from the click +
  // estimated popover size so positioning is deterministic and
  // doesn't depend on measuring the rendered popover (which would
  // require setState-in-effect and cascade renders).
  const pos = useMemo(() => {
    if (!open || !anchor || typeof window === "undefined") return null;
    // Matches the rendered size below: w-[520px] + ~320px tall (header
    // + 224px editor + footer). Overshooting by a few px is fine.
    const POPOVER_W = 520;
    const POPOVER_H = 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 16;
    let left = anchor.client_x + 12;
    let top = anchor.client_y + 12;
    if (left + POPOVER_W + pad > vw) {
      left = Math.max(pad, anchor.client_x - POPOVER_W - 12);
    }
    if (top + POPOVER_H + pad > vh) {
      top = Math.max(pad, anchor.client_y - POPOVER_H - 12);
    }
    return { left, top };
  }, [open, anchor]);

  // Close on Escape so power users don't need to mouse over to the
  // Cancel button.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open || !target) return null;

  const lineLabel =
    target.start_line === target.end_line
      ? `Línea ${target.start_line}`
      : `Líneas ${target.start_line}–${target.end_line}`;
  const dirty = draft !== target.content;

  const handleEditorMount: OnMount = (_editor, monaco) => {
    registerLatexLanguage(monaco);
    // Defer focus so the editor's textarea is mounted.
    requestAnimationFrame(() => _editor.focus());
  };

  return (
    <>
      {/* Soft backdrop that closes on click — keeps focus on the
          snippet without dimming the whole UI. */}
      <div
        aria-hidden="true"
        onClick={onCancel}
        className="fixed inset-0 z-40 bg-slate-900/10 dark:bg-black/30"
      />
      <div
        role="dialog"
        aria-label="Editar bloque LaTeX"
        style={
          pos
            ? { left: pos.left, top: pos.top, position: "fixed" }
            : { position: "fixed", visibility: "hidden" }
        }
        className="z-50 flex w-[520px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_20px_60px_-15px_rgba(15,23,42,0.32)] dark:border-zinc-700 dark:bg-zinc-950"
      >
        <header className="flex items-center justify-between gap-2 border-b border-slate-200/70 bg-slate-50/60 px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <PencilIcon />
            </span>
            <div className="leading-tight">
              <p className="text-[12.5px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-zinc-50">
                Editar bloque
              </p>
              <p className="text-[10.5px] text-slate-500 dark:text-zinc-500">
                {lineLabel} · LaTeX manual
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <XIcon />
          </button>
        </header>

        <div className="h-56">
          <MonacoEditor
            language="latex"
            value={draft}
            onChange={(value) => setDraft(value ?? "")}
            onMount={handleEditorMount}
            theme={theme === "dark" ? "vs-dark" : "vs"}
            options={{
              fontSize: 12.5,
              minimap: { enabled: false },
              wordWrap: "on",
              lineNumbers: "off",
              renderLineHighlight: "none",
              scrollBeyondLastLine: false,
              padding: { top: 10, bottom: 10 },
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              bracketPairColorization: { enabled: true },
              automaticLayout: true,
            }}
          />
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-200/70 bg-slate-50/60 px-3.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
          <span className="text-[10.5px] text-slate-400 dark:text-zinc-500">
            Esc cancela · Recompila al guardar
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCancel}
              disabled={saving}
              className="rounded-md px-2.5 py-1 text-[12px] text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              onClick={() => void onSave(draft)}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
            >
              {saving ? (
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border border-white/40 border-t-white dark:border-zinc-900/40 dark:border-t-zinc-900"
                />
              ) : null}
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
      <path
        d="M16.5 4.5l3 3M4.5 19.5l4-1 11-11-3-3-11 11-1 4Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 6l12 12M6 18L18 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
