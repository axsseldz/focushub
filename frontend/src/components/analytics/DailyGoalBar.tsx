"use client";

import { motion } from "framer-motion";
import { useState } from "react";

type DailyGoalBarProps = {
  minutes: number;
  goalMinutes: number;
  onChangeGoal: (next: number) => void;
};

const variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

export function DailyGoalBar({
  minutes,
  goalMinutes,
  onChangeGoal,
}: DailyGoalBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(goalMinutes));

  const ratio = goalMinutes > 0 ? Math.min(minutes / goalMinutes, 1) : 0;
  const isMet = minutes >= goalMinutes && goalMinutes > 0;
  const remaining = Math.max(0, goalMinutes - minutes);

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
      variants={variants}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
            Meta diaria
          </span>
          <span className="tabular-nums text-sm text-slate-700 dark:text-zinc-300">
            <span className="font-semibold">{minutes}</span>
            <span className="text-slate-400 dark:text-zinc-600"> / </span>
            {goalMinutes} min
          </span>
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
              className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold tabular-nums text-slate-900 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <span className="text-xs text-slate-500 dark:text-zinc-500">
              min
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(goalMinutes));
              setIsEditing(true);
            }}
            className="text-xs font-medium text-slate-500 underline-offset-4 transition-colors hover:text-slate-950 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Editar
          </button>
        )}
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
          className={`h-full rounded-full ${
            isMet
              ? "bg-emerald-500 dark:bg-emerald-400"
              : "bg-slate-900 dark:bg-zinc-100"
          }`}
        />
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-zinc-500">
        {isMet
          ? "Meta cumplida hoy."
          : minutes === 0
            ? "Aún no has leído hoy."
            : `Faltan ${remaining} min para tu meta de hoy.`}
      </p>
    </motion.section>
  );
}
