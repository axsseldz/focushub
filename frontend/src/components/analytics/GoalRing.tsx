"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { Target } from "lucide-react";
import { useEffect, useState } from "react";

type GoalRingProps = {
  readingMinutes: number;
  workspaceMinutes: number;
  goalMinutes: number;
  onChangeGoal: (next: number) => void;
};

const SIZE = 168;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (l) => Math.round(l).toString());
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 1.0,
      ease: [0.22, 0.61, 0.36, 1],
    });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{rounded}</motion.span>;
}

/**
 * Dual-segment goal ring. The track shows the daily goal at 100%; the
 * filled arcs stack — reading on the bottom (slate), workspace on top
 * (indigo) — so you can see *what* drove today's progress at a glance.
 * Hits the green "meta" treatment as soon as the sum crosses the goal.
 */
export function GoalRing({
  readingMinutes,
  workspaceMinutes,
  goalMinutes,
  onChangeGoal,
}: GoalRingProps) {
  const total = readingMinutes + workspaceMinutes;
  const ratio = goalMinutes > 0 ? Math.min(total / goalMinutes, 1) : 0;
  const readingRatio =
    goalMinutes > 0 ? Math.min(readingMinutes / goalMinutes, 1) : 0;
  const workspaceRatio =
    goalMinutes > 0
      ? Math.min(workspaceMinutes / goalMinutes, 1 - readingRatio)
      : 0;
  const isMet = total >= goalMinutes && goalMinutes > 0;

  const readingLength = CIRC * readingRatio;
  const workspaceLength = CIRC * workspaceRatio;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(goalMinutes));

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
      className="relative flex h-full flex-col items-center rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      <div className="flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
        <span className="inline-flex items-center gap-1.5">
          <Target className="h-3 w-3" />
          Meta diaria
        </span>
        {isEditing ? (
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
            className="w-16 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums tracking-normal text-slate-900 outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(goalMinutes));
              setIsEditing(true);
            }}
            className="rounded-full px-1.5 py-0.5 normal-case tracking-normal text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Editar meta diaria"
          >
            <span className="tabular-nums">{goalMinutes}</span>{" "}
            <span className="opacity-70">min</span>
          </button>
        )}
      </div>

      <div
        className="relative mt-3 flex items-center justify-center"
        style={{ height: SIZE, width: SIZE }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative -rotate-90"
        >
          <defs>
            <linearGradient id="ring-reading" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id="ring-workspace" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
            <linearGradient id="ring-met" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>

          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="currentColor"
            strokeWidth={STROKE}
            fill="none"
            className="text-slate-100 dark:text-zinc-800"
          />

          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={isMet ? "url(#ring-met)" : "url(#ring-reading)"}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${CIRC}` }}
            animate={{ strokeDasharray: `${readingLength} ${CIRC}` }}
            transition={{
              duration: 1.1,
              ease: [0.22, 0.61, 0.36, 1],
              delay: 0.2,
            }}
          />

          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={isMet ? "url(#ring-met)" : "url(#ring-workspace)"}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            initial={{
              strokeDasharray: `0 ${CIRC}`,
              strokeDashoffset: -readingLength,
            }}
            animate={{
              strokeDasharray: `${workspaceLength} ${CIRC}`,
              strokeDashoffset: -readingLength,
            }}
            transition={{
              duration: 1.1,
              ease: [0.22, 0.61, 0.36, 1],
              delay: 0.45,
            }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
            Progreso
          </p>
          <p className="mt-1 flex items-baseline gap-0.5 text-4xl font-semibold tracking-[-0.06em] tabular-nums text-slate-950 dark:text-zinc-50">
            <AnimatedNumber value={Math.round(ratio * 100)} />
            <span className="text-xl text-slate-400 dark:text-zinc-600">
              %
            </span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
            <span className="font-semibold tabular-nums text-slate-700 dark:text-zinc-300">
              <AnimatedNumber value={total} />
            </span>
            {" / "}
            <span className="tabular-nums">{goalMinutes}</span>
            {" min"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-2.5 text-[11px] font-medium text-slate-600 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500 dark:bg-zinc-300"
          />
          Lectura
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
          />
          Workspace
        </span>
        {isMet && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, delay: 0.6 }}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            ✓ Meta
          </motion.span>
        )}
      </div>
    </motion.section>
  );
}
