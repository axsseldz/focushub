"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { BookOpen, Flame, PenLine, TrendingUp } from "lucide-react";
import { useEffect } from "react";

type MetricHeroProps = {
  todayMinutes: number;
  readingTodayMin: number;
  workspaceTodayMin: number;
  streak: number;
  totalMinutes: number;
  isLoading: boolean;
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

function AnimatedCount({
  value,
  duration = 0.9,
}: {
  value: number;
  duration?: number;
}) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (l) => Math.round(l).toString());
  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.22, 0.61, 0.36, 1],
    });
    return () => controls.stop();
  }, [mv, value, duration]);
  return <motion.span>{rounded}</motion.span>;
}

function formatTotal(minutes: number): { value: string; unit: string } {
  if (minutes < 60) return { value: String(minutes), unit: "min" };
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return {
    value: rest ? `${h}h ${rest}` : `${h}h`,
    unit: rest ? "min" : "",
  };
}

/**
 * Hero card: massive "Hoy" number on the left, streak flame on the
 * right, mode-split pills and a total chip below. Designed to be the
 * loudest visual on the page so the metric speaks before any prose.
 */
export function MetricHero({
  todayMinutes,
  readingTodayMin,
  workspaceTodayMin,
  streak,
  totalMinutes,
  isLoading,
}: MetricHeroProps) {
  const totalFmt = formatTotal(totalMinutes);
  return (
    <motion.section
      variants={cardVariants}
      className="relative h-full overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      {/* Ambient drifting gradient — subtle, decorative only. */}
      <motion.div
        aria-hidden="true"
        animate={{ rotate: [0, 14, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-slate-200/50 via-indigo-200/30 to-slate-100/20 blur-3xl dark:from-zinc-700/30 dark:via-indigo-900/20 dark:to-zinc-800/10"
      />

      <div className="relative flex h-full flex-col justify-between gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
              Hoy
            </p>
            <div className="mt-1 flex items-baseline gap-2 text-slate-950 dark:text-zinc-50">
              <span
                className={`text-[56px] font-semibold leading-none tracking-[-0.06em] tabular-nums sm:text-[68px] ${
                  isLoading ? "opacity-30" : ""
                }`}
              >
                <AnimatedCount value={todayMinutes} />
              </span>
              <span className="text-lg font-medium text-slate-400 dark:text-zinc-600 sm:text-xl">
                min
              </span>
            </div>
          </div>

          <StreakBadge streak={streak} isLoading={isLoading} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SplitPill
            label="Lectura"
            value={readingTodayMin}
            icon={<BookOpen className="h-3.5 w-3.5" />}
            accent="reading"
            isLoading={isLoading}
          />
          <SplitPill
            label="Workspace"
            value={workspaceTodayMin}
            icon={<PenLine className="h-3.5 w-3.5" />}
            accent="workspace"
            isLoading={isLoading}
          />
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
            <TrendingUp className="h-3 w-3" />
            <span className="tabular-nums">
              <span className="font-semibold text-slate-700 dark:text-zinc-200">
                {totalFmt.value}
              </span>
              {totalFmt.unit ? ` ${totalFmt.unit}` : ""}
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] opacity-70">
              total
            </span>
          </span>
        </div>
      </div>
    </motion.section>
  );
}

function SplitPill({
  label,
  value,
  icon,
  accent,
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: "reading" | "workspace";
  isLoading: boolean;
}) {
  const cls =
    accent === "reading"
      ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200"
      : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300";
  return (
    <motion.span
      whileHover={{ y: -1 }}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls} ${
        isLoading ? "opacity-50" : ""
      }`}
    >
      {icon}
      <span className="tabular-nums">
        <AnimatedCount value={value} /> min
      </span>
      <span className="text-[10px] uppercase tracking-[0.14em] opacity-70">
        {label}
      </span>
    </motion.span>
  );
}

function StreakBadge({
  streak,
  isLoading,
}: {
  streak: number;
  isLoading: boolean;
}) {
  const lit = streak > 0;
  return (
    <div className="flex flex-col items-end">
      <div className="relative">
        {lit && (
          <motion.span
            aria-hidden="true"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.9, 1.3, 0.9], opacity: [0.25, 0, 0.25] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 blur-md"
          />
        )}
        <motion.div
          animate={lit ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={
            lit ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : {}
          }
          className={`relative flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm ${
            lit
              ? "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
              : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-600"
          }`}
        >
          <Flame className="h-5 w-5" />
        </motion.div>
      </div>
      <p
        className={`mt-1.5 text-2xl font-semibold tabular-nums ${
          isLoading ? "opacity-30" : "text-slate-950 dark:text-zinc-50"
        }`}
      >
        <AnimatedCount value={streak} />
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-600">
        Racha
      </p>
    </div>
  );
}
