"use client";

import { motion } from "framer-motion";
import { Flame, Trophy } from "lucide-react";

type StreakCardProps = {
  current: number;
  best: number;
  weekMinutes: number;
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

export function StreakCard({ current, best, weekMinutes }: StreakCardProps) {
  // The flame "intensity" scales with the streak so the card feels alive
  // when momentum is real. Capped so it never overpowers the card.
  const intensity = Math.min(current / 30, 1);
  const aura = 0.3 + intensity * 0.5;

  return (
    <motion.section
      variants={cardVariants}
      className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-orange-50 via-white to-rose-50/40 p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:from-orange-950/30 dark:via-zinc-900 dark:to-rose-950/20 sm:p-7"
    >
      {/* Soft aura behind the flame — opacity scales with streak strength. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-orange-300 blur-3xl"
        style={{ opacity: aura * 0.25 }}
      />

      <div className="relative flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
          <Flame className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-950 dark:text-zinc-50">
            Racha de lectura
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-500">
            Días consecutivos con actividad
          </p>
        </div>
      </div>

      <div className="relative mt-6 flex items-end justify-between gap-4">
        <div>
          <motion.div
            key={current}
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex items-baseline gap-2"
          >
            <span className="text-6xl font-semibold tracking-[-0.05em] tabular-nums text-slate-950 dark:text-zinc-50">
              {current}
            </span>
            <span className="text-base font-medium text-slate-500 dark:text-zinc-500">
              {current === 1 ? "día" : "días"}
            </span>
          </motion.div>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-orange-700 dark:text-orange-300">
            {current === 0
              ? "Comienza tu racha hoy"
              : current >= 30
                ? "Imparable"
                : current >= 7
                  ? "Hábito sólido"
                  : "En camino"}
          </p>
        </div>

        <motion.div
          initial={{ scale: 0.7, opacity: 0.7 }}
          animate={{ scale: 1 + intensity * 0.06, opacity: 0.85 + intensity * 0.15 }}
          transition={{ duration: 1.4, repeat: Infinity, repeatType: "mirror" }}
          className="text-7xl leading-none drop-shadow-[0_8px_20px_rgba(249,115,22,0.35)]"
        >
          🔥
        </motion.div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
            <Trophy className="h-3 w-3" /> Mejor
          </div>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
            {best}
            <span className="ml-1 text-sm font-medium text-slate-500 dark:text-zinc-500">
              {best === 1 ? "día" : "días"}
            </span>
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
            Semana
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
            {weekMinutes}
            <span className="ml-1 text-sm font-medium text-slate-500 dark:text-zinc-500">min</span>
          </p>
        </div>
      </div>
    </motion.section>
  );
}
