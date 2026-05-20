"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { DualDailyBucket } from "@/lib/analytics";

type HeatmapCalendarProps = {
  /** Last ~365 days, ordered oldest → newest. */
  buckets365: DualDailyBucket[];
};

/**
 * A bucket as seen from this component's perspective: the calendar
 * doesn't care about the source split, only the combined seconds, but
 * the tooltip surfaces the breakdown so a user can tell why a hot day
 * was hot.
 */
type CalendarCell = {
  iso: string;
  date: Date;
  /** ``readingSeconds + workspaceSeconds``. */
  totalSeconds: number;
  readingSeconds: number;
  workspaceSeconds: number;
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const } },
};

/**
 * Map active seconds to a 0–4 intensity tier. Tier 0 = no activity. The
 * thresholds are deliberately gentle so a 5-min light read still earns a
 * visible color — that single pixel of feedback is what keeps a streak
 * going.
 */
function intensity(seconds: number): 0 | 1 | 2 | 3 | 4 {
  const minutes = seconds / 60;
  if (minutes <= 0) return 0;
  if (minutes < 10) return 1;
  if (minutes < 25) return 2;
  if (minutes < 60) return 3;
  return 4;
}

const TIER_CLASSES = [
  "bg-slate-100 dark:bg-zinc-800/70",
  "bg-emerald-200/80 dark:bg-emerald-900/55",
  "bg-emerald-400/90 dark:bg-emerald-700/80",
  "bg-emerald-500 dark:bg-emerald-600",
  "bg-emerald-600 dark:bg-emerald-500",
] as const;

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function HeatmapCalendar({ buckets365 }: HeatmapCalendarProps) {
  const [hovered, setHovered] = useState<CalendarCell | null>(null);

  // Project the dual buckets into a flat list with a precomputed total.
  // The heatmap colors by ``totalSeconds`` so reading and workspace
  // contribute equally to the day's intensity, but the tooltip shows
  // both numbers so a user can spot the difference.
  const cells = useMemo<CalendarCell[]>(
    () =>
      buckets365.map((b) => ({
        iso: b.iso,
        date: b.date,
        totalSeconds: b.readingSeconds + b.workspaceSeconds,
        readingSeconds: b.readingSeconds,
        workspaceSeconds: b.workspaceSeconds,
      })),
    [buckets365],
  );

  // Build a grid of weeks. Each column is a calendar week (7 cells, top
  // = Monday). We pad the leading week with nulls so the bottom row
  // aligns to the actual day-of-week of each bucket.
  const grid = useMemo(() => {
    if (cells.length === 0) return [] as (CalendarCell | null)[][];
    const first = cells[0].date;
    const leadingMondayPad = (first.getDay() + 6) % 7; // Monday = 0
    const padded: (CalendarCell | null)[] = [];
    for (let i = 0; i < leadingMondayPad; i++) padded.push(null);
    padded.push(...cells);
    while (padded.length % 7 !== 0) padded.push(null);

    const weeks: (CalendarCell | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }
    return weeks;
  }, [cells]);

  // Month label positions: place a label on the first week column whose
  // first non-null cell starts a new month.
  const monthHeaders = useMemo(() => {
    const headers: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;
    grid.forEach((week, weekIndex) => {
      const firstCell = week.find((c) => c !== null);
      if (!firstCell) return;
      const m = firstCell.date.getMonth();
      if (m !== lastMonth) {
        headers.push({ weekIndex, label: MONTH_LABELS[m] });
        lastMonth = m;
      }
    });
    return headers;
  }, [grid]);

  const totalActiveDays = cells.filter((c) => c.totalSeconds > 0).length;
  const totalMinutes = Math.round(
    cells.reduce((acc, c) => acc + c.totalSeconds, 0) / 60,
  );

  return (
    <motion.section
      variants={cardVariants}
      className="rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
          Mapa anual
        </p>
        <div className="flex items-baseline gap-5 text-right text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
              {totalActiveDays}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-600">
              días
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
              {totalMinutes}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-600">
              min
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-center overflow-x-auto pb-2">
        <div className="inline-flex flex-col items-start">
          {/* Month header row */}
          <div className="ml-8 mb-2 flex text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
            {grid.map((_, weekIndex) => {
              const header = monthHeaders.find((h) => h.weekIndex === weekIndex);
              return (
                <span
                  key={weekIndex}
                  className="block w-[18px] shrink-0"
                  style={{ marginRight: 3 }}
                >
                  {header?.label ?? ""}
                </span>
              );
            })}
          </div>

          <div className="flex">
            {/* Day-of-week labels */}
            <div className="mr-2 flex flex-col gap-[3px] pr-1 text-[10px] font-medium text-slate-400 dark:text-zinc-500">
              {["L", "M", "M", "J", "V", "S", "D"].map((label, i) => (
                <span
                  key={`${label}-${i}`}
                  className="flex h-[18px] items-center"
                  style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[3px]">
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((cell, di) => {
                    if (!cell) {
                      return <span key={di} className="h-[18px] w-[18px] rounded-[4px] opacity-0" />;
                    }
                    const tier = intensity(cell.totalSeconds);
                    const isHovered = hovered?.iso === cell.iso;
                    return (
                      <motion.span
                        key={cell.iso}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{
                          scale: isHovered ? 1.4 : 1,
                          opacity: 1,
                        }}
                        transition={{
                          duration: isHovered ? 0.18 : 0.18,
                          delay: isHovered
                            ? 0
                            : Math.min(0.001 * (wi * 7 + di), 0.5),
                          ease: "easeOut",
                        }}
                        onMouseEnter={() => setHovered(cell)}
                        onMouseLeave={() =>
                          setHovered((current) =>
                            current?.iso === cell.iso ? null : current,
                          )
                        }
                        className={`relative h-[18px] w-[18px] cursor-pointer rounded-[4px] ${TIER_CLASSES[tier]} ${
                          isHovered
                            ? "z-10 shadow-[0_4px_14px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900"
                            : ""
                        }`}
                        role="img"
                        aria-label={`${cell.iso}: ${Math.round(cell.totalSeconds / 60)} minutos`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="min-h-[1.25rem] text-xs text-slate-500 dark:text-zinc-500">
          {hovered ? (
            <span className="tabular-nums">
              <span className="font-semibold text-slate-700 dark:text-zinc-200">
                {hovered.date.toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}
              </span>{" "}
              · {Math.round(hovered.totalSeconds / 60)} min
              {hovered.totalSeconds > 0 && (
                <span className="ml-1 text-slate-400 dark:text-zinc-600">
                  ({Math.round(hovered.readingSeconds / 60)}L ·{" "}
                  {Math.round(hovered.workspaceSeconds / 60)}W)
                </span>
              )}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
          {TIER_CLASSES.map((cls, i) => (
            <span key={i} className={`h-3 w-3 rounded-[3px] ${cls}`} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
