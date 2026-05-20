"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronDown,
  Eye,
  Hammer,
  MousePointer2,
  PenLine,
} from "lucide-react";
import { useState } from "react";

/**
 * Two-mode tracking explainer, collapsed by default (dropdown). Opening
 * it reveals two side-by-side cards (Lectura · Workspace), each listing
 * the three gates that must be open for the clock to tick. The presence
 * and soft-interaction gates are identical; only the third "proof of
 * work" gate differs between the modes.
 */

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

type Signal = {
  icon: React.ReactNode;
  label: string;
};

const SHARED_SIGNALS: Signal[] = [
  {
    icon: <Eye className="h-3.5 w-3.5" />,
    label: "Pestaña visible y con foco",
  },
  {
    icon: <MousePointer2 className="h-3.5 w-3.5" />,
    label: "Mouse o teclas en los últimos 45 s",
  },
];

const READING_SIGNALS: Signal[] = [
  ...SHARED_SIGNALS,
  {
    icon: <BookOpen className="h-3.5 w-3.5" />,
    label: "Pasas página o haces scroll dentro de 3 min",
  },
];

const WORKSPACE_SIGNALS: Signal[] = [
  ...SHARED_SIGNALS,
  {
    icon: <Hammer className="h-3.5 w-3.5" />,
    label: "Escribes, guardas o compilas dentro de 3 min",
  },
];

export function TrackingExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <motion.section
      variants={cardVariants}
      className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-3 bg-slate-50/40 px-6 py-5 text-left transition-colors hover:bg-slate-100/70 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/60 sm:px-8"
      >
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
          Cómo se mide tu tiempo
          {/* Subtle "expandible" hint that fades while collapsed. */}
          {!open && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.45, 0.9, 0.45] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-full bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
            >
              ver
            </motion.span>
          )}
        </p>
        <motion.span
          animate={
            open
              ? { rotate: 180, y: 0 }
              : { rotate: 0, y: [0, 2.5, 0] }
          }
          transition={
            open
              ? { duration: 0.3, ease: "easeOut" }
              : {
                  rotate: { duration: 0.3, ease: "easeOut" },
                  y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
                }
          }
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 transition-colors group-hover:text-slate-900 group-hover:ring-slate-300 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700 dark:group-hover:text-zinc-100"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
            className="overflow-hidden border-t border-slate-100 dark:border-zinc-800"
          >
            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
              <ModeCard
                accent="reading"
                title="Lectura"
                icon={<BookOpen className="h-4 w-4" />}
                signals={READING_SIGNALS}
              />
              <ModeCard
                accent="workspace"
                title="Workspace"
                icon={<PenLine className="h-4 w-4" />}
                signals={WORKSPACE_SIGNALS}
              />
            </div>
            <p className="border-t border-slate-100 px-6 py-4 text-center text-[11px] text-slate-400 dark:border-zinc-800 dark:text-zinc-600 sm:px-8">
              Las tres condiciones tienen que cumplirse a la vez. Sesiones &lt;
              5 s se descartan.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function ModeCard({
  accent,
  title,
  icon,
  signals,
}: {
  accent: "reading" | "workspace";
  title: string;
  icon: React.ReactNode;
  signals: Signal[];
}) {
  const headerCls =
    accent === "reading"
      ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
      : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300";
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/40 p-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${headerCls}`}
      >
        {icon}
        {title}
      </div>
      <ul className="mt-5 space-y-3">
        {signals.map((s, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.42, delay: i * 0.08 }}
            className="flex items-center gap-2.5 text-[13px] text-slate-700 dark:text-zinc-300"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
              {s.icon}
            </span>
            {s.label}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
