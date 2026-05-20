"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Small "tip" button shown next to Compilar. On click it reveals a short
 * popover pointing the user at Ajustes → Ver código, where they can edit
 * the LaTeX by hand and see it reflected on the canvas. Dismisses on
 * outside-click or Escape.
 */
export function WorkspaceTip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Tip"
        title="Tip"
        aria-expanded={open}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors ${
          open
            ? "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300"
            : "border-slate-200 bg-white text-amber-500 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-amber-400 dark:hover:bg-zinc-800/60"
        }`}
      >
        <Lightbulb className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="dialog"
            className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-900"
          >
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900 dark:text-zinc-100">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Tip
            </p>
            <p className="mt-1.5 text-[12px] leading-5 text-slate-600 dark:text-zinc-400">
              En{" "}
              <span className="font-medium text-slate-900 dark:text-zinc-100">
                Ajustes
              </span>{" "}
              ⟶{" "}
              <span className="font-medium text-slate-900 dark:text-zinc-100">
                Ver código
              </span>{" "}
              puedes editar el LaTeX a mano. Al guardar, los cambios se
              reflejan en el lienzo.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
