"use client";

import { motion } from "framer-motion";

type KpiStripProps = {
  todayMinutes: number;
  streak: number;
  totalMinutes: number;
  isLoading: boolean;
};

const variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const },
  },
};

function formatMinutes(min: number): string {
  if (min < 60) return `${min}`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${hours}h ${rest}` : `${hours}h`;
}

function formatMinutesUnit(min: number): string {
  return min < 60 ? "min" : "min";
}

export function KpiStrip({
  todayMinutes,
  streak,
  totalMinutes,
  isLoading,
}: KpiStripProps) {
  const items = [
    {
      label: "Hoy",
      value: String(todayMinutes),
      unit: "min",
    },
    {
      label: "Racha",
      value: String(streak),
      unit: streak === 1 ? "día" : "días",
    },
    {
      label: "Total",
      value: formatMinutes(totalMinutes),
      unit: formatMinutesUnit(totalMinutes),
    },
  ];

  return (
    <motion.section
      variants={variants}
      className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-200/80 dark:border-zinc-800 dark:bg-zinc-800"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white p-5 dark:bg-zinc-900 sm:p-6"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
            {item.label}
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-3xl font-semibold tracking-[-0.04em] tabular-nums text-slate-950 dark:text-zinc-50 sm:text-4xl ${
                isLoading ? "opacity-30" : ""
              }`}
            >
              {item.value}
            </span>
            <span className="text-sm text-slate-500 dark:text-zinc-500">
              {item.unit}
            </span>
          </div>
        </div>
      ))}
    </motion.section>
  );
}
