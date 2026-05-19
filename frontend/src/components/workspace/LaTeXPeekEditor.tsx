"use client";

import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import { registerLatexLanguage } from "@/lib/monaco-latex";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Cargando editor…
      </div>
    ),
  },
);

type Props = {
  open: boolean;
  source: string;
  onClose: () => void;
  onSave: (next: string) => Promise<void> | void;
};

/**
 * Peek-style overlay that exposes the raw .tex source. The user edits
 * here only when they want to bypass The Architect; on save the canvas
 * picks up the change via the parent's onSave callback. Syntax
 * highlighting comes from a Monarch grammar registered the first time
 * the editor mounts.
 */
export function LaTeXPeekEditor({ open, source, onClose, onSave }: Props) {
  const { theme } = useTheme();
  const [draft, setDraft] = useState(source);
  const [saving, setSaving] = useState(false);
  // Track which source the draft is in sync with so we only reset the
  // draft when the *underlying* source changes (e.g. AI rewrite arrived
  // mid-edit), not on every parent re-render.
  const lastSyncedSource = useRef(source);

  useEffect(() => {
    if (!open) return;
    if (lastSyncedSource.current !== source) {
      setDraft(source);
      lastSyncedSource.current = source;
    }
  }, [open, source]);

  useEffect(() => {
    if (open) {
      // Reset when opening so the user sees the latest source.
      setDraft(source);
      lastSyncedSource.current = source;
    }
  }, [open, source]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleEditorMount: OnMount = (_editor, monaco) => {
    registerLatexLanguage(monaco);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/40 backdrop-blur-sm dark:bg-black/60">
      <div className="flex h-full w-full max-w-3xl flex-col border-l border-slate-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <header className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3 dark:border-zinc-800/80">
          <div>
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
              Código fuente · main.tex
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-zinc-500">
              Edita el .tex a mano. Al guardar, el canvas se recompila.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-2.5 py-1 text-[12px] text-slate-500 transition-colors hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || draft === source}
              className="rounded-md bg-slate-900 px-3 py-1 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </header>

        <div className="flex-1">
          <MonacoEditor
            language="latex"
            value={draft}
            onChange={(value) => setDraft(value ?? "")}
            onMount={handleEditorMount}
            theme={theme === "dark" ? "vs-dark" : "vs"}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              wordWrap: "on",
              lineNumbers: "on",
              renderLineHighlight: "none",
              scrollBeyondLastLine: false,
              padding: { top: 16, bottom: 16 },
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>
      </div>
    </div>
  );
}
