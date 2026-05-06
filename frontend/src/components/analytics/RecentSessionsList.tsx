"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import type { ReadingSessionDTO } from "@/lib/analytics";

type RecentSessionsListProps = {
  sessions: ReadingSessionDTO[];
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
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

export function RecentSessionsList({ sessions }: RecentSessionsListProps) {
  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-7"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-950 dark:text-zinc-50">
            Sesiones recientes
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
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
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                    {formatDateTime(session.started_at)}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-500">
                    {session.book_id ? `Libro #${session.book_id}` : "Libro desconocido"}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {formatDuration(session.duration_seconds)}
              </span>
            </motion.li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
