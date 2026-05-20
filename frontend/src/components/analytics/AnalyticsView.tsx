"use client";

import { Manrope } from "next/font/google";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { UserButton, useAuth } from "@clerk/nextjs";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { API_BASE_URL, useAuthedFetch } from "@/lib/api";
import type { StoredFile } from "@/types/book";
import type { WorkspaceProject } from "@/types/workspace";
import { MetricHero } from "@/components/analytics/MetricHero";
import { GoalRing } from "@/components/analytics/GoalRing";
import { MinutesBarChart } from "@/components/analytics/MinutesBarChart";
import { HeatmapCalendar } from "@/components/analytics/HeatmapCalendar";
import { RecentSessionsList } from "@/components/analytics/RecentSessionsList";
import { TrackingExplainer } from "@/components/analytics/TrackingExplainer";
import { AchievementsBoard } from "@/components/analytics/AchievementsBoard";
import {
  type ReadingSessionDTO,
  type UnifiedSession,
  type WorkspaceSessionDTO,
  activeDateSet,
  bestStreak,
  buildDailyBuckets,
  buildDualDailyBuckets,
  currentStreak,
  parseBackendDate,
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
  const [readingSessions, setReadingSessions] = useState<ReadingSessionDTO[]>(
    [],
  );
  const [workspaceSessions, setWorkspaceSessions] = useState<
    WorkspaceSessionDTO[]
  >([]);
  const [bookNameById, setBookNameById] = useState<Record<number, string>>({});
  const [projectNameById, setProjectNameById] = useState<
    Record<number, string>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goals>(() => readGoals(userId));

  // Refs for the GSAP ambient backdrop — soft floating orbs + glow that
  // mirror the landing page so the analytics view feels like the same
  // product surface.
  const rootRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const orbOneRef = useRef<HTMLDivElement>(null);
  const orbTwoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoaded && userId) setGoals(readGoals(userId));
  }, [isLoaded, userId]);

  // Ambient backdrop motion — same gsap.context + sine.inOut yoyo recipe
  // as the landing hero. Reverted on unmount.
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          scale: 1.1,
          x: 26,
          y: 20,
          duration: 9,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }
      [orbOneRef.current, orbTwoRef.current].forEach((orb, i) => {
        if (!orb) return;
        gsap.to(orb, {
          x: i === 0 ? 20 : -20,
          y: i === 0 ? 18 : -16,
          scale: 1.06,
          duration: 8 + i,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    const load = async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 400);
        const params = new URLSearchParams({ since: since.toISOString() });
        const [
          readingRes,
          workspaceRes,
          filesRes,
          projectsRes,
        ] = await Promise.all([
          authedFetch(`${API_BASE_URL}/sessions?${params}`, {
            cache: "no-store",
          }),
          authedFetch(`${API_BASE_URL}/workspace-sessions?${params}`, {
            cache: "no-store",
          }),
          authedFetch(`${API_BASE_URL}/files`, { cache: "no-store" }),
          authedFetch(`${API_BASE_URL}/workspace/projects`, {
            cache: "no-store",
          }),
        ]);
        if (!readingRes.ok)
          throw new Error("No se pudo cargar la analítica.");
        if (!workspaceRes.ok)
          throw new Error("No se pudieron cargar las sesiones del workspace.");
        const readingData =
          (await readingRes.json()) as ReadingSessionDTO[];
        const workspaceData =
          (await workspaceRes.json()) as WorkspaceSessionDTO[];
        const files: StoredFile[] = filesRes.ok ? await filesRes.json() : [];
        const projects: WorkspaceProject[] = projectsRes.ok
          ? await projectsRes.json()
          : [];
        const fileMap: Record<number, string> = {};
        for (const f of files) {
          fileMap[f.id] =
            (f.display_name ?? f.file_name).trim() || f.file_name;
        }
        const projectMap: Record<number, string> = {};
        for (const p of projects) {
          projectMap[p.id] = (p.title ?? "").trim() || `Proyecto #${p.id}`;
        }
        if (!cancelled) {
          setReadingSessions(readingData);
          setWorkspaceSessions(workspaceData);
          setBookNameById(fileMap);
          setProjectNameById(projectMap);
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
    const merged = [...readingSessions, ...workspaceSessions];
    const activeDates = activeDateSet(merged);
    const last365 = buildDualDailyBuckets(
      readingSessions,
      workspaceSessions,
      365,
    );
    const last30 = buildDualDailyBuckets(
      readingSessions,
      workspaceSessions,
      30,
    );
    const last7 = buildDualDailyBuckets(
      readingSessions,
      workspaceSessions,
      7,
    );

    const todayBucket = last7[last7.length - 1];
    const readingTodayMin = Math.round(
      (todayBucket?.readingSeconds ?? 0) / 60,
    );
    const workspaceTodayMin = Math.round(
      (todayBucket?.workspaceSeconds ?? 0) / 60,
    );
    const todayMinutes = readingTodayMin + workspaceTodayMin;

    const readingBuckets365 = buildDailyBuckets(readingSessions, 365);
    const workspaceBuckets365 = buildDailyBuckets(workspaceSessions, 365);
    const readingTotalMin = Math.round(
      readingBuckets365.reduce((acc, b) => acc + b.seconds, 0) / 60,
    );
    const workspaceTotalMin = Math.round(
      workspaceBuckets365.reduce((acc, b) => acc + b.seconds, 0) / 60,
    );
    const totalMinutes = readingTotalMin + workspaceTotalMin;

    return {
      last365,
      last30,
      last7,
      todayMinutes,
      readingTodayMin,
      workspaceTodayMin,
      totalMinutes,
      readingTotalMin,
      workspaceTotalMin,
      streak: currentStreak(activeDates),
      best: bestStreak(activeDates),
    };
  }, [readingSessions, workspaceSessions]);

  const recentActivity = useMemo<UnifiedSession[]>(() => {
    const items: UnifiedSession[] = [
      ...readingSessions.map<UnifiedSession>((s) => ({
        source: "reading",
        session: s,
      })),
      ...workspaceSessions.map<UnifiedSession>((s) => ({
        source: "workspace",
        session: s,
      })),
    ];
    items.sort(
      (a, b) =>
        parseBackendDate(b.session.started_at).getTime() -
        parseBackendDate(a.session.started_at).getTime(),
    );
    return items.slice(0, 8);
  }, [readingSessions, workspaceSessions]);

  return (
    <main
      className={`${manrope.className} min-h-screen bg-white text-slate-950 dark:bg-zinc-950 dark:text-zinc-50`}
    >
      <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <div className="border-b border-slate-200/80 dark:border-zinc-800 lg:border-b-0 lg:border-r">
          <Sidebar />
        </div>

        <div ref={rootRef} className="relative min-w-0">
          {/* Ambient backdrop — soft floating orbs + glow, matching the
              landing page. Decorative; sits behind all content. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div
              ref={glowRef}
              className="absolute left-1/2 top-24 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(191,219,254,0.28),rgba(255,255,255,0)_68%)] blur-3xl dark:bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),rgba(0,0,0,0)_68%)]"
            />
            <div
              ref={orbOneRef}
              className="absolute left-[6%] top-40 h-44 w-44 rounded-full bg-[radial-gradient(circle_at_center,rgba(199,210,254,0.32),rgba(255,255,255,0)_70%)] blur-2xl dark:bg-[radial-gradient(circle_at_center,rgba(129,140,248,0.16),rgba(0,0,0,0)_70%)]"
            />
            <div
              ref={orbTwoRef}
              className="absolute right-[8%] top-[28rem] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(226,232,240,0.3),rgba(255,255,255,0)_74%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(147,197,253,0.12),rgba(0,0,0,0)_74%)]"
            />
          </div>

          {/* Sticky minimal header — just an eyebrow + utility cluster. */}
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 sm:px-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-600">
              Analítica
            </p>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <UserButton
                appearance={{
                  elements: { userButtonAvatarBox: "h-7 w-7" },
                }}
              />
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
                transition: { staggerChildren: 0.08, delayChildren: 0.04 },
              },
            }}
            className="relative space-y-5 px-6 py-8 sm:space-y-6 sm:px-10 sm:py-10"
          >
            {/* Hero row: massive Hoy + flame on the left, dual ring on
                the right. Stacks vertically below the lg breakpoint. */}
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] sm:gap-6">
              <MetricHero
                todayMinutes={stats.todayMinutes}
                readingTodayMin={stats.readingTodayMin}
                workspaceTodayMin={stats.workspaceTodayMin}
                streak={stats.streak}
                totalMinutes={stats.totalMinutes}
                isLoading={isLoading}
              />
              <GoalRing
                readingMinutes={stats.readingTodayMin}
                workspaceMinutes={stats.workspaceTodayMin}
                goalMinutes={goals.dailyMinutes}
                onChangeGoal={(dailyMinutes) =>
                  updateGoals({ ...goals, dailyMinutes })
                }
              />
            </div>

            <TrackingExplainer />

            <AchievementsBoard
              totalMinutes={stats.totalMinutes}
              readingTotalMin={stats.readingTotalMin}
              workspaceTotalMin={stats.workspaceTotalMin}
              streak={stats.streak}
              best={stats.best}
            />

            <MinutesBarChart buckets7={stats.last7} buckets30={stats.last30} />

            <HeatmapCalendar buckets365={stats.last365} />

            <RecentSessionsList
              sessions={recentActivity}
              bookNameById={bookNameById}
              projectNameById={projectNameById}
            />
          </motion.div>
        </div>
      </div>
    </main>
  );
}
