"use client";

import { Manrope } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { StatsHero } from "@/components/analytics/StatsHero";
import { DailyGoalCard } from "@/components/analytics/DailyGoalCard";
import { StreakCard } from "@/components/analytics/StreakCard";
import { WeeklyMilestonesRow } from "@/components/analytics/WeeklyMilestonesRow";
import { MinutesBarChart } from "@/components/analytics/MinutesBarChart";
import { HeatmapCalendar } from "@/components/analytics/HeatmapCalendar";
import { MilestonesGrid } from "@/components/analytics/MilestonesGrid";
import { RecentSessionsList } from "@/components/analytics/RecentSessionsList";
import {
  type ReadingSessionDTO,
  activeDateSet,
  bestStreak,
  buildDailyBuckets,
  currentStreak,
  readGoals,
  writeGoals,
  type Goals,
} from "@/lib/analytics";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export function AnalyticsView() {
  const [sessions, setSessions] = useState<ReadingSessionDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goals>(() => readGoals());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // We pull a 13-month window so the heatmap shows a full year and a
        // little leading context for the current month.
        const since = new Date();
        since.setDate(since.getDate() - 400);
        const params = new URLSearchParams({ since: since.toISOString() });
        const response = await fetch(`${API_BASE_URL}/sessions?${params}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No se pudo cargar la analítica.");
        const data = (await response.json()) as ReadingSessionDTO[];
        if (!cancelled) setSessions(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Error desconocido al cargar.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateGoals = (next: Goals) => {
    setGoals(next);
    writeGoals(next);
  };

  // ---------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------

  const stats = useMemo(() => {
    const activeDates = activeDateSet(sessions);
    const last365 = buildDailyBuckets(sessions, 365);
    const last30 = buildDailyBuckets(sessions, 30);
    const last7 = buildDailyBuckets(sessions, 7);

    const todayBucket = last7[last7.length - 1];
    const todayMinutes = Math.round((todayBucket?.seconds ?? 0) / 60);
    const totalMinutes = Math.round(
      last365.reduce((acc, b) => acc + b.seconds, 0) / 60,
    );
    const weekMinutes = Math.round(
      last7.reduce((acc, b) => acc + b.seconds, 0) / 60,
    );

    return {
      activeDates,
      last365,
      last30,
      last7,
      todayMinutes,
      totalMinutes,
      weekMinutes,
      streak: currentStreak(activeDates),
      best: bestStreak(activeDates),
    };
  }, [sessions]);

  return (
    <main
      className={`${manrope.className} min-h-screen bg-white text-slate-950 dark:bg-zinc-950 dark:text-zinc-50`}
    >
      <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <div className="border-b border-slate-200/80 dark:border-zinc-800 lg:border-b-0 lg:border-r">
          <Sidebar />
        </div>

        <div className="min-w-0">
          <header className="border-b border-slate-200/80 px-6 py-7 dark:border-zinc-800 sm:px-8 sm:py-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">
                  Analítica
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-zinc-50 sm:text-4xl">
                  Tu progreso de lectura
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-zinc-400 sm:text-lg">
                  Métricas reales basadas en tiempo de lectura activa, no en tiempo en pantalla.
                </p>
              </div>
              <div className="mt-1 shrink-0">
                <ThemeToggle />
              </div>
            </div>
          </header>

          {error && (
            <div className="px-6 pt-6 sm:px-8">
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          <motion.div
            initial="hidden"
            animate={isLoading ? "hidden" : "visible"}
            variants={{
              hidden: { opacity: 0, y: 10 },
              visible: {
                opacity: 1,
                y: 0,
                transition: { staggerChildren: 0.06, delayChildren: 0.05 },
              },
            }}
            className="space-y-6 px-6 py-7 sm:px-8 sm:py-8"
          >
            <StatsHero
              todayMinutes={stats.todayMinutes}
              weekMinutes={stats.weekMinutes}
              totalMinutes={stats.totalMinutes}
              streak={stats.streak}
              best={stats.best}
              isLoading={isLoading}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <DailyGoalCard
                minutes={stats.todayMinutes}
                goalMinutes={goals.dailyMinutes}
                onChangeGoal={(dailyMinutes) =>
                  updateGoals({ ...goals, dailyMinutes })
                }
              />
              <StreakCard
                current={stats.streak}
                best={stats.best}
                weekMinutes={stats.weekMinutes}
              />
            </div>

            <WeeklyMilestonesRow
              buckets={stats.last7}
              dailyGoalMinutes={goals.dailyMinutes}
              weeklyGoalDays={goals.weeklyDays}
              onChangeWeeklyGoal={(weeklyDays) =>
                updateGoals({ ...goals, weeklyDays })
              }
            />

            <MinutesBarChart buckets7={stats.last7} buckets30={stats.last30} />

            <HeatmapCalendar buckets365={stats.last365} />

            <MilestonesGrid
              streak={stats.streak}
              best={stats.best}
              totalMinutes={stats.totalMinutes}
            />

            <RecentSessionsList sessions={sessions.slice(0, 6)} />
          </motion.div>
        </div>
      </div>
    </main>
  );
}
