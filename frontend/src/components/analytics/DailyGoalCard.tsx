"use client";

import { motion } from "framer-motion";
import { Pencil, Target } from "lucide-react";
import { useState } from "react";

type DailyGoalCardProps = {
  minutes: number;
  goalMinutes: number;
  onChangeGoal: (next: number) => void;
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

export function DailyGoalCard({ minutes, goalMinutes, onChangeGoal }: DailyGoalCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(goalMinutes));

  const ratio = goalMinutes > 0 ? Math.min(minutes / goalMinutes, 1) : 0;
  const overflow = goalMinutes > 0 ? Math.max(0, minutes / goalMinutes - 1) : 0;
  const isMet = minutes >= goalMinutes && goalMinutes > 0;

  // SVG ring math — a thin ring with a soft stroke and rounded caps so it
  // reads as premium rather than utility.
  const SIZE = 168;
  const STROKE = 12;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const submit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 600) {
      onChangeGoal(parsed);
    } else {
      setDraft(String(goalMinutes));
    }
    setIsEditing(false);
  };

  return (
    <motion.section
      variants={cardVariants}
      className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-7"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Target className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-950 dark:text-zinc-50">
              Meta diaria
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              Minutos de lectura activa hoy
            </p>
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") {
                  setDraft(String(goalMinutes));
                  setIsEditing(false);
                }
              }}
              autoFocus
              className="w-16 rounded-full border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-900 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <span className="text-xs text-slate-500 dark:text-zinc-500">min</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(goalMinutes));
              setIsEditing(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full -rotate-90">
            <defs>
              <linearGradient id="dailyGoalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <linearGradient id="dailyGoalOverflow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>

            {/* Track */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              stroke="currentColor"
              className="text-slate-100 dark:text-zinc-800"
              fill="none"
            />

            {/* Progress */}
            <motion.circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              strokeWidth={STROKE}
              stroke="url(#dailyGoalGradient)"
              strokeLinecap="round"
              fill="none"
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              animate={{
                strokeDashoffset: CIRCUMFERENCE - CIRCUMFERENCE * ratio,
              }}
              transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1] }}
              style={{
                strokeDasharray: CIRCUMFERENCE,
              }}
            />

            {/* Overflow arc — a second, thinner arc on top once the user passes 100% */}
            {overflow > 0 && (
              <motion.circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                strokeWidth={STROKE / 2}
                stroke="url(#dailyGoalOverflow)"
                strokeLinecap="round"
                fill="none"
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{
                  strokeDashoffset:
                    CIRCUMFERENCE - CIRCUMFERENCE * Math.min(overflow, 1),
                }}
                transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1], delay: 1.1 }}
                style={{ strokeDasharray: CIRCUMFERENCE }}
              />
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={minutes}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-4xl font-semibold tracking-[-0.04em] tabular-nums text-slate-950 dark:text-zinc-50"
            >
              {minutes}
            </motion.span>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
              de {goalMinutes} min
            </span>
          </div>
        </div>

        <div className="space-y-3 sm:max-w-[14rem]">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
              Estado
            </p>
            <p className="mt-1.5 text-sm font-medium text-slate-700 dark:text-zinc-200">
              {isMet
                ? "Meta cumplida ✓"
                : minutes === 0
                  ? "Sin lectura aún hoy"
                  : `Faltan ${Math.max(0, goalMinutes - minutes)} min`}
            </p>
          </div>
          {overflow > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="rounded-2xl border border-amber-200/60 bg-amber-50/70 p-4 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em]">Bonus</p>
              <p className="mt-1.5 text-sm font-medium">
                +{Math.round(minutes - goalMinutes)} min sobre la meta
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
