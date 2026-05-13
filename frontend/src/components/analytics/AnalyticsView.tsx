"use client";

import { Manrope } from "next/font/google";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { UserButton, useAuth } from "@clerk/nextjs";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { API_BASE_URL, useAuthedFetch } from "@/lib/api";
import type { StoredFile } from "@/types/book";
import { KpiStrip } from "@/components/analytics/KpiStrip";
import { DailyGoalBar } from "@/components/analytics/DailyGoalBar";
import { MinutesBarChart } from "@/components/analytics/MinutesBarChart";
import { HeatmapCalendar } from "@/components/analytics/HeatmapCalendar";
import { RecentSessionsList } from "@/components/analytics/RecentSessionsList";
import { TrackingExplainer } from "@/components/analytics/TrackingExplainer";
import { AchievementsBoard } from "@/components/analytics/AchievementsBoard";
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

export function AnalyticsView() {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [sessions, setSessions] = useState<ReadingSessionDTO[]>([]);
  const [bookNameById, setBookNameById] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goals>(() => readGoals(userId));

  // Re-hydrate goals once Clerk's userId resolves on first paint.
  useEffect(() => {
    if (isLoaded && userId) setGoals(readGoals(userId));
  }, [isLoaded, userId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    const load = async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 400);
        const params = new URLSearchParams({ since: since.toISOString() });
        // Load sessions + files in parallel so the recent-sessions list can
        // show real book titles instead of "Libro #N".
        const [sessionsRes, filesRes] = await Promise.all([
          authedFetch(`${API_BASE_URL}/sessions?${params}`, {
            cache: "no-store",
          }),
          authedFetch(`${API_BASE_URL}/files`, { cache: "no-store" }),
        ]);
        if (!sessionsRes.ok)
          throw new Error("No se pudo cargar la analítica.");
        const data = (await sessionsRes.json()) as ReadingSessionDTO[];
        const files: StoredFile[] = filesRes.ok ? await filesRes.json() : [];
        const nameMap: Record<number, string> = {};
        for (const f of files) {
          nameMap[f.id] = (f.display_name ?? f.file_name).trim() || f.file_name;
        }
        if (!cancelled) {
          setSessions(data);
          setBookNameById(nameMap);
        }
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
  }, [authedFetch, isLoaded, isSignedIn]);

  const updateGoals = (next: Goals) => {
    setGoals(next);
    writeGoals(next, userId);
  };

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

    return {
      last365,
      last30,
      last7,
      todayMinutes,
      totalMinutes,
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
          <header className="border-b border-slate-200/80 px-6 py-7 dark:border-zinc-800 sm:px-10 sm:py-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                  Analítica
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-zinc-50 sm:text-[2.5rem]">
                  Tu progreso de lectura
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-zinc-500">
                  Métricas basadas en tiempo de lectura activa, no en tiempo
                  con el libro abierto.
                </p>
              </div>
              <div className="mt-1 flex shrink-0 items-center gap-3">
                <ThemeToggle />
                <UserButton />
              </div>
            </div>
          </header>

          {error && (
            <div className="px-6 pt-6 sm:px-10">
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            </div>
          )}

          <motion.div
            initial="hidden"
            animate={isLoading ? "hidden" : "visible"}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08, delayChildren: 0.05 },
              },
            }}
            className="space-y-5 px-6 py-8 sm:space-y-6 sm:px-10 sm:py-10"
          >
            <KpiStrip
              todayMinutes={stats.todayMinutes}
              streak={stats.streak}
              totalMinutes={stats.totalMinutes}
              isLoading={isLoading}
            />

            <TrackingExplainer />

            <DailyGoalBar
              minutes={stats.todayMinutes}
              goalMinutes={goals.dailyMinutes}
              onChangeGoal={(dailyMinutes) =>
                updateGoals({ ...goals, dailyMinutes })
              }
            />

            <AchievementsBoard
              totalMinutes={stats.totalMinutes}
              streak={stats.streak}
              best={stats.best}
            />

            <MinutesBarChart buckets7={stats.last7} buckets30={stats.last30} />

            <HeatmapCalendar buckets365={stats.last365} />

            <RecentSessionsList
              sessions={sessions.slice(0, 6)}
              bookNameById={bookNameById}
            />
          </motion.div>
        </div>
      </div>
    </main>
  );
}
