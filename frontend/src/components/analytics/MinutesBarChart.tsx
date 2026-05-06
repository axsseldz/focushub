"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/lib/theme";
import type { DailyBucket } from "@/lib/analytics";

type MinutesBarChartProps = {
  buckets7: DailyBucket[];
  buckets30: DailyBucket[];
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

type Range = "7" | "30";

const SHORT_DAY = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function formatTick(d: Date, range: Range): string {
  if (range === "7") return SHORT_DAY[d.getDay()];
  return `${d.getDate()}`;
}

function formatTooltipLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

type ChartDatum = {
  iso: string;
  label: string;
  minutes: number;
};

export function MinutesBarChart({ buckets7, buckets30 }: MinutesBarChartProps) {
  const [range, setRange] = useState<Range>("7");
  const { theme } = useTheme();

  const buckets = range === "7" ? buckets7 : buckets30;
  const data: ChartDatum[] = buckets.map((b) => ({
    iso: b.iso,
    label: formatTick(b.date, range),
    minutes: Math.round(b.seconds / 60),
  }));

  const max = Math.max(1, ...data.map((d) => d.minutes));
  const isDark = theme === "dark";

  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-7"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-slate-950 dark:text-zinc-50">
            Minutos por día
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
            Tiempo de lectura activa, agregado por día
          </p>
        </div>

        <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold dark:border-zinc-700 dark:bg-zinc-800">
          {(["7", "30"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded-full px-3 py-1 transition-colors ${
                range === r
                  ? "bg-white text-slate-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {r === "7" ? "7 días" : "30 días"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            barCategoryGap={range === "7" ? "20%" : "12%"}
          >
            <defs>
              <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#a78bfa" : "#7c3aed"} stopOpacity={0.95} />
                <stop offset="100%" stopColor={isDark ? "#6366f1" : "#6366f1"} stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="barFillEmpty" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#3f3f46" : "#e2e8f0"} stopOpacity={0.7} />
                <stop offset="100%" stopColor={isDark ? "#27272a" : "#f1f5f9"} stopOpacity={0.7} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke={isDark ? "rgba(63,63,70,0.55)" : "rgba(226,232,240,0.7)"}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              interval={range === "30" ? 3 : 0}
              tick={{
                fontSize: 11,
                fill: isDark ? "#a1a1aa" : "#64748b",
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={36}
              tick={{
                fontSize: 11,
                fill: isDark ? "#a1a1aa" : "#64748b",
              }}
              tickFormatter={(value: number) => `${value}m`}
            />
            <Tooltip
              cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)" }}
              content={ChartTooltip}
            />
            <Bar dataKey="minutes" radius={[8, 8, 4, 4]}>
              {data.map((d) => (
                <Cell
                  key={d.iso}
                  fill={d.minutes === 0 ? "url(#barFillEmpty)" : "url(#barFill)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500">
        <span>Pico: {max} min</span>
        <span>
          Promedio:{" "}
          {Math.round(
            data.reduce((acc, d) => acc + d.minutes, 0) / Math.max(data.length, 1),
          )}{" "}
          min/día
        </span>
      </div>
    </motion.section>
  );
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload as ChartDatum;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-[0_8px_18px_rgba(15,23,42,0.08)] dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold text-slate-700 dark:text-zinc-200">
        {formatTooltipLabel(datum.iso)}
      </p>
      <p className="mt-0.5 text-slate-500 dark:text-zinc-400">
        <span className="font-semibold text-slate-900 dark:text-zinc-100">
          {datum.minutes}
        </span>{" "}
        min de lectura
      </p>
    </div>
  );
}
