"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { DailyBucket } from "@/lib/analytics";

type HeatmapCalendarProps = {
  /** Last ~365 days, ordered oldest → newest. */
  buckets365: DailyBucket[];
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
  const [hovered, setHovered] = useState<DailyBucket | null>(null);

  // Build a grid of weeks. Each column is a calendar week (7 cells, top
  // = Monday). We pad the leading week with nulls so the bottom row
  // aligns to the actual day-of-week of each bucket.
  const grid = useMemo(() => {
    if (buckets365.length === 0) return [] as (DailyBucket | null)[][];
    const first = buckets365[0].date;
    const leadingMondayPad = (first.getDay() + 6) % 7; // Monday = 0
    const cells: (DailyBucket | null)[] = [];
    for (let i = 0; i < leadingMondayPad; i++) cells.push(null);
    cells.push(...buckets365);
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (DailyBucket | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }, [buckets365]);

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

  const totalActiveDays = buckets365.filter((b) => b.seconds > 0).length;
  const totalMinutes = Math.round(
    buckets365.reduce((acc, b) => acc + b.seconds, 0) / 60,
  );

  return (
    <motion.section
      variants={cardVariants}
      className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-500">
            Mapa anual
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-zinc-600">
            Cada celda es un día — más oscuro = más minutos.
          </p>
        </div>
        <div className="flex items-baseline gap-5 text-right text-xs">
          <div>
            <p className="text-slate-400 dark:text-zinc-600">Días activos</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
              {totalActiveDays}
            </p>
          </div>
          <div>
            <p className="text-slate-400 dark:text-zinc-600">Minutos</p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-950 dark:text-zinc-50">
              {totalMinutes}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center overflow-x-auto pb-2">
        <div className="inline-flex flex-col items-start">
          {/* Month header row */}
          <div className="ml-7 mb-2 flex text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
            {grid.map((_, weekIndex) => {
              const header = monthHeaders.find((h) => h.weekIndex === weekIndex);
              return (
                <span
                  key={weekIndex}
                  className="block w-3 shrink-0"
                  style={{ marginRight: 2 }}
                >
                  {header?.label ?? ""}
                </span>
              );
            })}
          </div>

          <div className="flex">
            {/* Day-of-week labels */}
            <div className="mr-2 flex flex-col gap-[2px] pr-1 text-[10px] font-medium text-slate-400 dark:text-zinc-500">
              {["L", "M", "M", "J", "V", "S", "D"].map((label, i) => (
                <span
                  key={`${label}-${i}`}
                  className="flex h-3 items-center"
                  style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[2px]">
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[2px]">
                  {week.map((cell, di) => {
                    if (!cell) {
                      return <span key={di} className="h-3 w-3 rounded-[3px] opacity-0" />;
                    }
                    const tier = intensity(cell.seconds);
                    const isHovered = hovered?.iso === cell.iso;
                    return (
                      <motion.span
                        key={cell.iso}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{
                          scale: isHovered ? 1.45 : 1,
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
                        className={`relative h-3 w-3 cursor-pointer rounded-[3px] ${TIER_CLASSES[tier]} ${
                          isHovered
                            ? "z-10 shadow-[0_4px_12px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900"
                            : ""
                        }`}
                        role="img"
                        aria-label={`${cell.iso}: ${Math.round(cell.seconds / 60)} minutos`}
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
            <span>
              <span className="font-semibold text-slate-700 dark:text-zinc-200">
                {hovered.date.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>{" "}
              · {Math.round(hovered.seconds / 60)} min
            </span>
          ) : (
            <span>Pasa el cursor sobre un día para ver el detalle</span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
          <span>Menos</span>
          {TIER_CLASSES.map((cls, i) => (
            <span key={i} className={`h-3 w-3 rounded-[3px] ${cls}`} />
          ))}
          <span>Más</span>
        </div>
      </div>
    </motion.section>
  );
}
