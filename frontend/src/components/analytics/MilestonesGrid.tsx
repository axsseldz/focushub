"use client";

import { motion } from "framer-motion";
import { Award, Flame, Lock, Medal, Sparkles, Target } from "lucide-react";
import type { ReactNode } from "react";

type MilestonesGridProps = {
  streak: number;
  best: number;
  totalMinutes: number;
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

type Milestone = {
  id: string;
  title: string;
  description: string;
  threshold: number;
  metric: number;
  icon: ReactNode;
  /** Tailwind classes for the unlocked accent. */
  accent: string;
};

export function MilestonesGrid({ streak, best, totalMinutes }: MilestonesGridProps) {
  // We track three streak tiers (the explicit ask) and three minute
  // milestones for variety. `metric` is the user's current value for the
  // dimension this milestone tracks; `threshold` is the unlock target.
  const streakMetric = Math.max(streak, best);

  const items: Milestone[] = [
    {
      id: "streak-3",
      title: "3 días seguidos",
      description: "Has empezado a construir un hábito.",
      threshold: 3,
      metric: streakMetric,
      icon: <Flame className="h-5 w-5" />,
      accent: "from-orange-400 to-rose-400 text-orange-50",
    },
    {
      id: "streak-7",
      title: "Semana completa",
      description: "Una semana entera de constancia.",
      threshold: 7,
      metric: streakMetric,
      icon: <Sparkles className="h-5 w-5" />,
      accent: "from-violet-500 to-fuchsia-500 text-violet-50",
    },
    {
      id: "streak-30",
      title: "Mes de oro",
      description: "30 días consecutivos. Imparable.",
      threshold: 30,
      metric: streakMetric,
      icon: <Award className="h-5 w-5" />,
      accent: "from-amber-400 to-yellow-500 text-amber-50",
    },
    {
      id: "minutes-60",
      title: "Primera hora",
      description: "Acumulaste tu primera hora de lectura.",
      threshold: 60,
      metric: totalMinutes,
      icon: <Target className="h-5 w-5" />,
      accent: "from-sky-400 to-blue-500 text-sky-50",
    },
    {
      id: "minutes-600",
      title: "10 horas leídas",
      description: "Diez horas reales de lectura activa.",
      threshold: 600,
      metric: totalMinutes,
      icon: <Medal className="h-5 w-5" />,
      accent: "from-emerald-400 to-teal-500 text-emerald-50",
    },
    {
      id: "minutes-3000",
      title: "50 horas leídas",
      description: "El equivalente a varios libros enteros.",
      threshold: 3000,
      metric: totalMinutes,
      icon: <Award className="h-5 w-5" />,
      accent: "from-indigo-500 to-violet-600 text-indigo-50",
    },
  ];

  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-7"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-950 dark:text-zinc-50">
            Logros
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            Hitos desbloqueados por tu actividad de lectura
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
            Desbloqueados
          </p>
          <p className="text-base font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
            {items.filter((it) => it.metric >= it.threshold).length}/{items.length}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const unlocked = item.metric >= item.threshold;
          const progress = Math.min(item.metric / item.threshold, 1);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.04, ease: "easeOut" }}
              className={`group relative overflow-hidden rounded-2xl border p-5 transition-shadow ${
                unlocked
                  ? "border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-900"
                  : "border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/40"
              }`}
            >
              {/* Glassy gradient panel for unlocked items */}
              {unlocked && (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-30 blur-2xl ${item.accent}`}
                />
              )}

              <div className="relative flex items-start justify-between gap-2">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm ${
                    unlocked
                      ? item.accent
                      : "from-slate-200 to-slate-100 text-slate-400 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-500"
                  }`}
                >
                  {unlocked ? item.icon : <Lock className="h-4 w-4" />}
                </span>
                {unlocked ? (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.15 + i * 0.04 }}
                    className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  >
                    Desbloqueado
                  </motion.span>
                ) : (
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:bg-zinc-800 dark:text-zinc-500">
                    Bloqueado
                  </span>
                )}
              </div>

              <div className="relative mt-4">
                <p
                  className={`text-base font-semibold tracking-[-0.02em] ${
                    unlocked
                      ? "text-slate-950 dark:text-zinc-50"
                      : "text-slate-700 dark:text-zinc-300"
                  }`}
                >
                  {item.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-500">
                  {item.description}
                </p>
              </div>

              {/* Progress bar */}
              <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
                  className={`h-full rounded-full bg-gradient-to-r ${
                    unlocked ? item.accent : "from-slate-300 to-slate-400 dark:from-zinc-600 dark:to-zinc-500"
                  }`}
                />
              </div>
              <div className="relative mt-1.5 flex justify-between text-[11px] font-medium tabular-nums text-slate-500 dark:text-zinc-500">
                <span>{Math.min(item.metric, item.threshold)}</span>
                <span>
                  {item.threshold}
                  {item.id.startsWith("minutes") ? " min" : " días"}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
