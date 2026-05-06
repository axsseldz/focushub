"use client";

import { motion } from "framer-motion";
import { Clock, Flame, Sparkles, Trophy } from "lucide-react";

type StatsHeroProps = {
  todayMinutes: number;
  weekMinutes: number;
  totalMinutes: number;
  streak: number;
  best: number;
  isLoading: boolean;
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

export function StatsHero({
  todayMinutes,
  weekMinutes,
  totalMinutes,
  streak,
  best,
  isLoading,
}: StatsHeroProps) {
  const items = [
    {
      label: "Hoy",
      suffix: "min",
      value: todayMinutes,
      icon: <Clock className="h-4 w-4" />,
      tone: "from-sky-500/15 to-blue-500/5 text-sky-600 dark:text-sky-300",
    },
    {
      label: "Esta semana",
      suffix: "min",
      value: weekMinutes,
      icon: <Sparkles className="h-4 w-4" />,
      tone: "from-violet-500/15 to-fuchsia-500/5 text-violet-600 dark:text-violet-300",
    },
    {
      label: "Racha actual",
      suffix: streak === 1 ? "día" : "días",
      value: streak,
      icon: <Flame className="h-4 w-4" />,
      tone: "from-orange-500/20 to-rose-500/5 text-orange-600 dark:text-orange-300",
    },
    {
      label: "Mejor racha",
      suffix: best === 1 ? "día" : "días",
      value: best,
      icon: <Trophy className="h-4 w-4" />,
      tone: "from-amber-500/20 to-yellow-500/5 text-amber-600 dark:text-amber-300",
    },
    {
      label: "Total",
      suffix: "min",
      value: totalMinutes,
      icon: <Clock className="h-4 w-4" />,
      tone: "from-emerald-500/15 to-teal-500/5 text-emerald-600 dark:text-emerald-300",
    },
  ];

  return (
    <motion.section variants={cardVariants} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90 ${item.tone}`}
            style={{ maskImage: "linear-gradient(180deg, rgba(0,0,0,0.6), transparent 70%)" }}
          />
          <div className="relative flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
              {item.label}
            </span>
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 shadow-sm dark:bg-zinc-800/70 ${item.tone.split(" ").filter((c) => c.startsWith("text-")).join(" ")}`}>
              {item.icon}
            </span>
          </div>
          <div className="relative mt-3 flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-semibold tracking-[-0.04em] tabular-nums text-slate-950 dark:text-zinc-50 ${
                isLoading ? "opacity-30" : ""
              }`}
            >
              {item.value}
            </span>
            <span className="text-sm text-slate-500 dark:text-zinc-500">{item.suffix}</span>
          </div>
        </div>
      ))}
    </motion.section>
  );
}
