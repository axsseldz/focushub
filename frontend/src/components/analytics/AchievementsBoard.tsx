"use client";

import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";

/**
 * Six Duolingo-style trophy badges arranged in a 3×2 grid. Two of the
 * milestones (Reader / Writer) are mode-specific so the board mirrors
 * the dual-mode reality of the app — earning total minutes via writing
 * lights up "Writer" without nudging "Reader" forward, and vice versa.
 *
 * Animations: each badge floats in on load, unlocked badges breathe
 * continuously, and a sparkle pings the corner the first time the user
 * sees the unlocked state. The ring around each badge fills to show the
 * fraction of the threshold that's still pending.
 */

type Achievement = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  gradient: string;
  current: number;
  threshold: number;
  unit: string;
};

type AchievementsBoardProps = {
  totalMinutes: number;
  readingTotalMin: number;
  workspaceTotalMin: number;
  streak: number;
  best: number;
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

const BADGE_SIZE = 78;
const BADGE_STROKE = 4.5;
const BADGE_R = (BADGE_SIZE - BADGE_STROKE) / 2;
const BADGE_CIRC = 2 * Math.PI * BADGE_R;

export function AchievementsBoard({
  totalMinutes,
  readingTotalMin,
  workspaceTotalMin,
  streak,
  best,
}: AchievementsBoardProps) {
  // For streak milestones use the *best* streak so you don't lose
  // unlocks the day after a break.
  const streakMetric = Math.max(streak, best);

  const items: Achievement[] = [
    {
      id: "first-step",
      emoji: "🌱",
      title: "Primer paso",
      description: "Tu primera sesión",
      gradient: "from-emerald-400 to-teal-500",
      current: totalMinutes,
      threshold: 1,
      unit: "min",
    },
    {
      id: "reader",
      emoji: "📚",
      title: "Lector",
      description: "45 min leyendo",
      gradient: "from-sky-400 to-blue-500",
      current: readingTotalMin,
      threshold: 45,
      unit: "min",
    },
    {
      id: "writer",
      emoji: "✍️",
      title: "Escritor",
      description: "45 min escribiendo",
      gradient: "from-indigo-400 to-violet-500",
      current: workspaceTotalMin,
      threshold: 45,
      unit: "min",
    },
    {
      id: "streak-3",
      emoji: "🔥",
      title: "Tres días",
      description: "3 días seguidos",
      gradient: "from-amber-400 to-orange-500",
      current: streakMetric,
      threshold: 3,
      unit: "días",
    },
    {
      id: "marathon",
      emoji: "⚡",
      title: "Maratón",
      description: "5 horas en total",
      gradient: "from-orange-400 to-rose-500",
      current: totalMinutes,
      threshold: 300,
      unit: "min",
    },
    {
      id: "streak-14",
      emoji: "👑",
      title: "Imparable",
      description: "14 días en racha",
      gradient: "from-violet-500 to-fuchsia-500",
      current: streakMetric,
      threshold: 14,
      unit: "días",
    },
  ];
  const unlockedCount = items.filter((it) => it.current >= it.threshold).length;

  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
          Logros
        </p>
        <p className="text-xs font-semibold tabular-nums text-slate-700 dark:text-zinc-200">
          {unlockedCount}
          <span className="text-slate-400 dark:text-zinc-600">
            /{items.length}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-6 sm:gap-5">
        {items.map((it, i) => (
          <AchievementBadge key={it.id} item={it} index={i} />
        ))}
      </div>
    </motion.section>
  );
}

function AchievementBadge({
  item,
  index,
}: {
  item: Achievement;
  index: number;
}) {
  const unlocked = item.current >= item.threshold;
  const progress = Math.min(item.current / item.threshold, 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.6,
        delay: 0.05 + index * 0.06,
        ease: [0.22, 0.61, 0.36, 1],
      }}
      whileHover={{ y: -4 }}
      className="flex flex-col items-center"
      title={
        unlocked
          ? `${item.title} desbloqueado`
          : `${Math.max(0, item.threshold - item.current)} ${item.unit} para desbloquear`
      }
    >
      <div className="relative">
        {/* Soft halo only when unlocked — subtle, not neon */}
        {unlocked && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0.18, 0.32, 0.18], scale: [1, 1.05, 1] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute inset-0 rounded-full bg-gradient-to-br opacity-25 blur-md ${item.gradient}`}
          />
        )}

        {/* Progress ring for locked badges */}
        <svg
          width={BADGE_SIZE}
          height={BADGE_SIZE}
          viewBox={`0 0 ${BADGE_SIZE} ${BADGE_SIZE}`}
          className="relative -rotate-90"
        >
          <circle
            cx={BADGE_SIZE / 2}
            cy={BADGE_SIZE / 2}
            r={BADGE_R}
            stroke="currentColor"
            strokeWidth={BADGE_STROKE}
            fill="none"
            className={
              unlocked
                ? "text-transparent"
                : "text-slate-100 dark:text-zinc-800"
            }
          />
          {!unlocked && (
            <motion.circle
              cx={BADGE_SIZE / 2}
              cy={BADGE_SIZE / 2}
              r={BADGE_R}
              stroke="currentColor"
              strokeWidth={BADGE_STROKE}
              fill="none"
              strokeLinecap="round"
              className="text-slate-400 dark:text-zinc-500"
              initial={{ strokeDasharray: `0 ${BADGE_CIRC}` }}
              animate={{
                strokeDasharray: `${BADGE_CIRC * progress} ${BADGE_CIRC}`,
              }}
              transition={{
                duration: 1.2,
                ease: [0.22, 0.61, 0.36, 1],
                delay: 0.35 + index * 0.06,
              }}
            />
          )}
        </svg>

        {/* Inner badge */}
        <motion.div
          animate={
            unlocked
              ? { y: [0, -3, 0], rotate: [0, 2, -2, 0] }
              : { y: 0, rotate: 0 }
          }
          transition={
            unlocked
              ? { duration: 4.2, repeat: Infinity, ease: "easeInOut" }
              : {}
          }
          className={`absolute inset-2 flex items-center justify-center rounded-full bg-gradient-to-br shadow-[0_8px_18px_rgba(15,23,42,0.12)] ${
            unlocked
              ? item.gradient
              : "from-slate-200 to-slate-300 dark:from-zinc-800 dark:to-zinc-700"
          }`}
        >
          {unlocked ? (
            <span className="text-2xl drop-shadow-sm">{item.emoji}</span>
          ) : (
            <Lock className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
          )}
        </motion.div>

        {unlocked && (
          <motion.span
            aria-hidden="true"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: [0, 1.25, 1], rotate: [0, 15, 0] }}
            transition={{
              duration: 0.75,
              delay: 0.55 + index * 0.06,
              ease: [0.22, 1.4, 0.4, 1],
            }}
            className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md dark:bg-zinc-100"
          >
            <Sparkles className="h-3 w-3 text-amber-500" />
          </motion.span>
        )}
      </div>

      <p
        className={`mt-3 text-center text-[12px] font-semibold leading-tight tracking-[-0.01em] ${
          unlocked
            ? "text-slate-950 dark:text-zinc-50"
            : "text-slate-500 dark:text-zinc-500"
        }`}
      >
        {item.title}
      </p>
      <p className="mt-0.5 text-center text-[10px] leading-tight text-slate-400 dark:text-zinc-600">
        {item.description}
      </p>
      <p className="mt-1 text-center text-[10px] tabular-nums text-slate-400 dark:text-zinc-600">
        {unlocked ? (
          <span className="text-emerald-600 dark:text-emerald-400">
            ✓ Desbloqueado
          </span>
        ) : (
          <>
            {Math.min(item.current, item.threshold)}
            <span className="opacity-60">/{item.threshold}</span>
          </>
        )}
      </p>
    </motion.div>
  );
}
