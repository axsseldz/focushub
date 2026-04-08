"use client";

import { AnimatePresence, motion } from "framer-motion";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * ConfirmDialog
 *
 * A modal dialog that asks the user to confirm a destructive action.
 * Animated via Framer Motion. Closes on backdrop click or Cancel.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        // Backdrop
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={onCancel}
        >
          {/* Dialog panel */}
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-zinc-700 dark:bg-zinc-900"
          >
            {/* Icon */}
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
              <TrashIcon />
            </div>

            <h2 className="text-base font-semibold tracking-[-0.03em] text-slate-950 dark:text-zinc-50">
              {title}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-zinc-400">
              {description}
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-red-500 dark:text-red-400"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.75 7.75h14.5M10 7.75V6.25a1.75 1.75 0 0 1 1.75-1.75h.5A1.75 1.75 0 0 1 14 6.25v1.5M8.75 7.75l.75 10.5h5l.75-10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
