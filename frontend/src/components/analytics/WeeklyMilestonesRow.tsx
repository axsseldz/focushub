"use client";

import { motion } from "framer-motion";
import { Check, Pencil } from "lucide-react";
import { useState } from "react";
import type { DailyBucket } from "@/lib/analytics";

type WeeklyMilestonesRowProps = {
  buckets: DailyBucket[];
  dailyGoalMinutes: number;
  weeklyGoalDays: number;
  onChangeWeeklyGoal: (next: number) => void;
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function dayLabelFromDate(d: Date): string {
  // getDay: 0 = Sunday … 6 = Saturday. We display Monday-first.
  const idx = (d.getDay() + 6) % 7;
  return DAY_LABELS[idx];
}

export function WeeklyMilestonesRow({
  buckets,
  dailyGoalMinutes,
  weeklyGoalDays,
  onChangeWeeklyGoal,
}: WeeklyMilestonesRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(weeklyGoalDays));

  const submit = () => {
    const n = Number.parseInt(draft, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 7) {
      onChangeWeeklyGoal(n);
    } else {
      setDraft(String(weeklyGoalDays));
    }
    setEditing(false);
  };

  const goalSeconds = dailyGoalMinutes * 60;
  const completedDays = buckets.filter((b) => b.seconds >= goalSeconds).length;
  const progress = Math.min(completedDays / weeklyGoalDays, 1);

  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-950 dark:text-zinc-50">
            Hitos semanales
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            Días que cumpliste tu meta de {dailyGoalMinutes} min — objetivo de {weeklyGoalDays} días por semana
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-500">
              Progreso
            </p>
            <p className="text-base font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
              {completedDays}/{weeklyGoalDays}
            </p>
          </div>
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={7}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={submit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") {
                    setDraft(String(weeklyGoalDays));
                    setEditing(false);
                  }
                }}
                autoFocus
                className="w-14 rounded-full border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-900 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <span className="text-xs text-slate-500 dark:text-zinc-500">días</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraft(String(weeklyGoalDays));
                setEditing(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <Pencil className="h-3 w-3" />
              Editar
            </button>
          )}
        </div>
      </div>

      {/* Linear progress bar */}
      <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 1, ease: [0.22, 0.61, 0.36, 1] }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
        />
      </div>

      {/* Day pills */}
      <div className="mt-5 flex items-stretch justify-between gap-2">
        {buckets.map((bucket, i) => {
          const completed = bucket.seconds >= goalSeconds;
          const minutes = Math.round(bucket.seconds / 60);
          const isToday = i === buckets.length - 1;
          return (
            <motion.div
              key={bucket.iso}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04, ease: "easeOut" }}
              className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors ${
                completed
                  ? "border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : isToday
                    ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300"
                    : "border-slate-100 bg-white text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-80">
                {dayLabelFromDate(bucket.date)}
              </span>
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  completed
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-500 dark:ring-zinc-700"
                }`}
              >
                {completed ? <Check className="h-3.5 w-3.5" /> : bucket.date.getDate()}
              </span>
              <span className="text-[10px] font-medium tabular-nums">{minutes}m</span>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
