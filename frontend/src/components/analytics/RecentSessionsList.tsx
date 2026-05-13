"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { type ReadingSessionDTO, parseBackendDate } from "@/lib/analytics";

type RecentSessionsListProps = {
  sessions: ReadingSessionDTO[];
  /**
   * book_id → display name, built from the /files response in the parent
   * view. Sessions whose book has been deleted fall back to "Libro
   * eliminado" so the row still reads cleanly.
   */
  bookNameById: Record<number, string>;
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

export function RecentSessionsList({
  sessions,
  bookNameById,
}: RecentSessionsListProps) {
  return (
    <motion.section
      variants={cardVariants}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
            Sesiones recientes
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-600">
            Tus últimas sesiones registradas
          </p>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-500">
          Aún no hay sesiones. Abre un libro en{" "}
          <span className="font-semibold text-slate-700 dark:text-zinc-300">
            Modo Lectura
          </span>{" "}
          para empezar a registrar tu actividad.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
          {sessions.map((session, i) => (
            <motion.li
              key={session.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 * i }}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <BookOpen className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p
                    title={bookLabel(session.book_id, bookNameById)}
                    className="truncate text-sm font-medium text-slate-900 dark:text-zinc-100"
                  >
                    {bookLabel(session.book_id, bookNameById)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-zinc-600">
                    {formatDateTime(session.started_at)}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700 dark:text-zinc-300">
                {formatDuration(session.duration_seconds)}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
