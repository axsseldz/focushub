"use client";

import { motion } from "framer-motion";
import { BookOpen, PenLine } from "lucide-react";
import { type UnifiedSession, parseBackendDate } from "@/lib/analytics";

type RecentSessionsListProps = {
  sessions: UnifiedSession[];
  /**
   * book_id → display name, built from the /files response in the parent
   * view. Reading sessions whose book has been deleted fall back to
   * "Libro eliminado" so the row still reads cleanly.
   */
  bookNameById: Record<number, string>;
  /**
   * project_id → display title. Workspace sessions whose project has
   * been deleted fall back to "Proyecto eliminado".
   */
  projectNameById: Record<number, string>;
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

function formatDateTime(iso: string): string {
  const d = parseBackendDate(iso);
  return d.toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function bookLabel(
  bookId: number | null,
  bookNameById: Record<number, string>,
): string {
  if (bookId == null) return "Libro desconocido";
  return bookNameById[bookId] ?? "Libro eliminado";
}

function projectLabel(
  projectId: number | null,
  projectNameById: Record<number, string>,
): string {
  if (projectId == null) return "Proyecto desconocido";
  return projectNameById[projectId] ?? "Proyecto eliminado";
}

export function RecentSessionsList({
  sessions,
  bookNameById,
  projectNameById,
}: RecentSessionsListProps) {
  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8"
    >
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
          Actividad reciente
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500">
          Sin sesiones aún.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
          {sessions.map((entry, i) => {
            const isReading = entry.source === "reading";
            const title = isReading
              ? bookLabel(entry.session.book_id, bookNameById)
              : projectLabel(entry.session.project_id, projectNameById);
            const sourceLabel = isReading ? "Lectura" : "Workspace";
            const Icon = isReading ? BookOpen : PenLine;
            const iconWrapClass = isReading
              ? "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
              : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300";
            const sourceBadgeClass = isReading
              ? "border-slate-200 text-slate-500 dark:border-zinc-700 dark:text-zinc-400"
              : "border-indigo-200 text-indigo-600 dark:border-indigo-900/60 dark:text-indigo-300";
            return (
              <motion.li
                key={`${entry.source}-${entry.session.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrapClass}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p
                        title={title}
                        className="truncate text-sm font-medium text-slate-900 dark:text-zinc-100"
                      >
                        {title}
                      </p>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full border px-1.5 py-px text-[10px] font-medium uppercase tracking-[0.12em] ${sourceBadgeClass}`}
                      >
                        {sourceLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-zinc-600">
                      {formatDateTime(entry.session.started_at)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700 dark:text-zinc-300">
                  {formatDuration(entry.session.duration_seconds)}
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </motion.section>
  );
}
