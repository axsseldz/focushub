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
import type { DualDailyBucket } from "@/lib/analytics";

type MinutesBarChartProps = {
  buckets7: DualDailyBucket[];
  buckets30: DualDailyBucket[];
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
  /** Reading minutes — bottom segment of each stacked bar. */
  reading: number;
  /** Workspace minutes — top segment, stacked above reading. */
  workspace: number;
  /** Sum of the two — used for tooltip totals and the "peak" footer. */
  total: number;
};

export function MinutesBarChart({ buckets7, buckets30 }: MinutesBarChartProps) {
  const [range, setRange] = useState<Range>("7");
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);
  const { theme } = useTheme();

  const buckets = range === "7" ? buckets7 : buckets30;
  const data: ChartDatum[] = buckets.map((b) => {
    const reading = Math.round(b.readingSeconds / 60);
    const workspace = Math.round(b.workspaceSeconds / 60);
    return {
      iso: b.iso,
      label: formatTick(b.date, range),
      reading,
      workspace,
      total: reading + workspace,
    };
  });

  const max = Math.max(1, ...data.map((d) => d.total));
  const isDark = theme === "dark";

  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
            Minutos por día
          </p>
          <div className="hidden items-center gap-3 text-[11px] font-medium text-slate-600 dark:text-zinc-400 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-700 dark:bg-zinc-300"
              />
              Lectura
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500 dark:bg-indigo-400"
              />
              Workspace
            </span>
          </div>
        </div>

        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-800">
          {(["7", "30"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded px-2.5 py-1 transition-colors ${
                range === r
                  ? "bg-white text-slate-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {r === "7" ? "7 días" : "30 días"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 8, bottom: 0, left: 4 }}
            barCategoryGap={range === "7" ? "22%" : "14%"}
            onMouseMove={(state) => {
              // Recharts' MouseHandlerDataParam doesn't expose activePayload
              // in its public type yet, so we read it through a cast.
              const payload = (state as { activePayload?: { payload?: ChartDatum }[] })
                ?.activePayload?.[0]?.payload;
              setHoveredIso(payload?.iso ?? null);
            }}
            onMouseLeave={() => setHoveredIso(null)}
          >
            <defs>
              <linearGradient id="barReading" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#e4e4e7" : "#334155"} stopOpacity={0.95} />
                <stop offset="100%" stopColor={isDark ? "#a1a1aa" : "#64748b"} stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="barWorkspace" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#818cf8" : "#6366f1"} stopOpacity={0.95} />
                <stop offset="100%" stopColor={isDark ? "#6366f1" : "#4f46e5"} stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="barReadingHover" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#fafafa" : "#1e293b"} stopOpacity={1} />
                <stop offset="100%" stopColor={isDark ? "#d4d4d8" : "#475569"} stopOpacity={1} />
              </linearGradient>
              <linearGradient id="barWorkspaceHover" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#a5b4fc" : "#818cf8"} stopOpacity={1} />
                <stop offset="100%" stopColor={isDark ? "#818cf8" : "#6366f1"} stopOpacity={1} />
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
              tickMargin={6}
              tick={{
                fontSize: 11,
                fill: isDark ? "#a1a1aa" : "#64748b",
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={44}
              tickMargin={4}
              tick={{
                fontSize: 11,
                fill: isDark ? "#a1a1aa" : "#64748b",
              }}
              tickFormatter={(value: number) => `${value} m`}
            />
            <Tooltip
              cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.04)" }}
              content={ChartTooltip}
              animationDuration={150}
            />
            <Bar
              dataKey="reading"
              stackId="time"
              radius={[0, 0, 4, 4]}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((d) => {
                const isHovered = hoveredIso === d.iso;
                const fill = isHovered
                  ? "url(#barReadingHover)"
                  : "url(#barReading)";
                return <Cell key={d.iso} fill={fill} />;
              })}
            </Bar>
            <Bar
              dataKey="workspace"
              stackId="time"
              radius={[8, 8, 0, 0]}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((d) => {
                const isHovered = hoveredIso === d.iso;
                const fill = isHovered
                  ? "url(#barWorkspaceHover)"
                  : "url(#barWorkspace)";
                return <Cell key={d.iso} fill={fill} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-500">
        <span>Pico: {max} min</span>
        <span>
          Promedio:{" "}
          {Math.round(
            data.reduce((acc, d) => acc + d.total, 0) / Math.max(data.length, 1),
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
      <p className="mt-1 text-slate-500 dark:text-zinc-400">
        <span className="font-semibold text-slate-900 dark:text-zinc-100">
          {datum.total}
        </span>{" "}
        min en total
      </p>
      <div className="mt-1 space-y-0.5">
        <p className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-sm bg-slate-700 dark:bg-zinc-300"
          />
          Lectura{" "}
          <span className="font-semibold text-slate-900 dark:text-zinc-100">
            {datum.reading}
          </span>{" "}
          min
        </p>
        <p className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 rounded-sm bg-indigo-500 dark:bg-indigo-400"
          />
          Workspace{" "}
          <span className="font-semibold text-slate-900 dark:text-zinc-100">
            {datum.workspace}
          </span>{" "}
          min
        </p>
      </div>
    </div>
  );
}
