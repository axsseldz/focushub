"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import { useState } from "react";

/**
 * Duolingo-style awards. Four big, friendly milestones — one starter, two
 * streak goals, one volume goal — so the page rewards consistency without
 * dumping a dozen badges on the user.
 */

type Achievement = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  /** Tailwind gradient used when unlocked. */
  gradient: string;
  /** Current value for this milestone. */
  current: number;
  /** Threshold required to unlock. */
  threshold: number;
  /** Unit displayed in the progress label. */
  unit: string;
};

type AchievementsBoardProps = {
  totalMinutes: number;
  streak: number;
  best: number;
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

export function AchievementsBoard({
  totalMinutes,
  streak,
  best,
}: AchievementsBoardProps) {
  // For streak milestones we use the *best* streak so you don't lose
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
      id: "streak-7",
      emoji: "🔥",
      title: "Una semana",
      description: "7 días seguidos",
      gradient: "from-orange-400 to-rose-500",
      current: streakMetric,
      threshold: 7,
      unit: "días",
    },
    {
      id: "hours-10",
      emoji: "⚡",
      title: "Maratonista",
      description: "10 horas leídas",
      gradient: "from-amber-400 to-yellow-500",
      current: totalMinutes,
      threshold: 600,
      unit: "min",
    },
    {
      id: "streak-30",
      emoji: "👑",
      title: "Imparable",
      description: "30 días en racha",
      gradient: "from-violet-500 to-fuchsia-500",
      current: streakMetric,
      threshold: 30,
      unit: "días",
    },
  ];

  const unlockedCount = items.filter((it) => it.current >= it.threshold).length;

  return (
    <motion.section
      variants={cardVariants}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
            Logros
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-600">
            Desbloquea hitos a medida que lees
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-600">
            Desbloqueados
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
            {unlockedCount}/{items.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {items.map((item, i) => (
          <AchievementCard key={item.id} item={item} index={i} />
        ))}
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function AchievementCard({
  item,
  index,
}: {
  item: Achievement;
  index: number;
}) {
  const unlocked = item.current >= item.threshold;
  const progress = Math.min(item.current / item.threshold, 1);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={() => setIsOpen((v) => !v)}
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: 0.05 + index * 0.08,
        ease: [0.22, 0.61, 0.36, 1],
      }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      className={`group relative flex w-full flex-col items-center overflow-hidden rounded-2xl border p-4 text-center transition-colors ${
        unlocked
          ? "border-slate-200/80 bg-white dark:border-zinc-700 dark:bg-zinc-900"
          : "border-slate-100 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"
      }`}
    >
      {/* The circular badge — Duolingo's signature visual element.
          A small, tightly-blurred halo sits behind the badge for a subtle
          rim glow. Earlier we used a 128×128 / blur-2xl halo at -top-10
          which washed the whole card green; this version sits inside the
          badge footprint so only the outer ring leaks out. */}
      <div className="relative">
        {unlocked && (
          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.08 }}
            className={`pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-br opacity-25 blur-md ${item.gradient}`}
          />
        )}
        <motion.div
          animate={
            unlocked
              ? {
                  rotate: [0, -2, 2, -1, 0],
                  scale: [1, 1.025, 1],
                }
              : {}
          }
          transition={
            unlocked
              ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
              : {}
          }
          className={`relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br shadow-[0_8px_18px_rgba(15,23,42,0.1)] ${
            unlocked
              ? item.gradient
              : "from-slate-200 to-slate-300 dark:from-zinc-800 dark:to-zinc-700"
          }`}
        >
          {unlocked ? (
            <span
              className="text-3xl drop-shadow-sm"
              style={{ filter: "saturate(1.1)" }}
            >
              {item.emoji}
            </span>
          ) : (
            <Lock className="h-6 w-6 text-slate-400 dark:text-zinc-500" />
          )}
        </motion.div>

        {/* Sparkle that pops in when unlocked */}
        {unlocked && (
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{
              scale: [0, 1.2, 1],
              rotate: [0, 15, 0],
            }}
            transition={{
              duration: 0.7,
              delay: 0.45 + index * 0.08,
              ease: [0.22, 1.4, 0.4, 1],
            }}
            className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md dark:bg-zinc-100"
          >
            <Sparkles className="h-3 w-3 text-amber-500" />
          </motion.div>
        )}
      </div>

      <p
        className={`mt-3 text-sm font-semibold tracking-[-0.01em] ${
          unlocked
            ? "text-slate-950 dark:text-zinc-50"
            : "text-slate-700 dark:text-zinc-300"
        }`}
      >
        {item.title}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-zinc-500">
        {item.description}
      </p>

      {/* Progress bar — only visible for locked items so the unlocked card
          stays clean and celebratory */}
      <AnimatePresence initial={false}>
        {!unlocked && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 w-full"
          >
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-zinc-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{
                  duration: 1,
                  delay: 0.3 + index * 0.08,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                className={`h-full rounded-full bg-gradient-to-r ${item.gradient}`}
              />
            </div>
            <p className="mt-1.5 text-[10px] tabular-nums text-slate-400 dark:text-zinc-600">
              {Math.min(item.current, item.threshold)} / {item.threshold}{" "}
              {item.unit}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap-to-reveal detail panel — keeps the card minimal by default
          but offers a friendly explanation when the user is curious */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`mt-3 w-full overflow-hidden rounded-lg px-3 py-2 text-[11px] leading-4 ${
              unlocked
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
            }`}
          >
            {unlocked
              ? "¡Desbloqueado! Sigue así."
              : `Te faltan ${Math.max(0, item.threshold - item.current)} ${item.unit}.`}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
