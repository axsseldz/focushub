"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Auto-cycling visual demo for the landing page. Three scenes that
 * showcase the actual product (focused reading, precise time tracking,
 * unlockable achievements) — no marketing copy required.
 *
 * Mirrors the TrackingExplainer storyboard pattern: status caption,
 * play/pause control, dot navigation.
 */

const SCENE_DURATION_MS = 4500;

type Scene = {
  id: string;
  caption: string;
  render: (key: number) => React.ReactNode;
};

export function LandingShowcase() {
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);

  // Auto-advance through the scenes
  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % SCENES.length;
        if (next === 0) setCycle((c) => c + 1);
        return next;
      });
    }, SCENE_DURATION_MS);
    return () => window.clearInterval(id);
  }, []);

  const scene = SCENES[index];
  // The `cycle` counter forces a remount when the playhead loops back
  // to the same scene so child timers (counters, badge unlocks) restart.
  const sceneKey = index * 100 + cycle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
      className="mx-auto mt-14 w-full max-w-2xl"
    >
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/80 shadow-[0_30px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/70">
        {/* Stage */}
        <div className="relative h-72 sm:h-80">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.id + sceneKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0"
            >
              {scene.render(sceneKey)}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer with caption + controls */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white/60 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.p
                key={scene.caption}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.25 }}
                className="truncate text-sm font-medium text-slate-700 dark:text-zinc-200"
              >
                {scene.caption}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Dot navigation — purely an indicator now, no interactive controls */}
          <div className="flex items-center gap-1.5">
            {SCENES.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={`h-1 rounded-full transition-all ${
                  i === index
                    ? "w-5 bg-slate-900 dark:bg-zinc-100"
                    : "w-1 bg-slate-300 dark:bg-zinc-700"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

const SCENES: Scene[] = [
  {
    id: "reading",
    caption: "Lectura sin distracciones.",
    render: (k) => <SceneReading key={k} />,
  },
  {
    id: "timer",
    caption: "Tiempo activo, no tiempo en pantalla.",
    render: (k) => <SceneTimer key={k} />,
  },
  {
    id: "achievements",
    caption: "Hábitos que se sienten como un juego.",
    render: (k) => <SceneAchievements key={k} />,
  },
];

// --- Scene 1: distractions fly away from a clean reading surface ----------

function SceneReading() {
  const distractions = [
    { icon: "🔔", angle: -150, distance: 110 },
    { icon: "💬", angle: -45, distance: 120 },
    { icon: "📱", angle: 150, distance: 110 },
    { icon: "📧", angle: 45, distance: 120 },
  ];

  return (
    <div className="relative flex h-full items-center justify-center">
      {/* The book — composed of stacked muted "text lines" */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        className="relative h-44 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.1)] dark:border-zinc-700 dark:bg-zinc-800"
      >
        <div className="absolute inset-4 space-y-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{
                duration: 0.45,
                delay: 0.3 + i * 0.07,
                ease: "easeOut",
              }}
              style={{
                width: `${[100, 92, 96, 80, 88, 70, 60][i]}%`,
                transformOrigin: "left",
              }}
              className="h-1 rounded-full bg-slate-200 dark:bg-zinc-600"
            />
          ))}
        </div>
      </motion.div>

      {/* Distractions: appear, then drift outward + fade */}
      {distractions.map((d, i) => {
        const rad = (d.angle * Math.PI) / 180;
        const x = Math.cos(rad) * d.distance;
        const y = Math.sin(rad) * d.distance;
        return (
          <motion.span
            key={i}
            initial={{
              opacity: 0,
              x: x * 0.4,
              y: y * 0.4,
              scale: 0.5,
              rotate: -8,
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [x * 0.4, x * 0.8, x * 1.1, x * 1.6],
              y: [y * 0.4, y * 0.8, y * 1.1, y * 1.6],
              scale: [0.5, 1, 1, 0.6],
              rotate: [-8, -2, 4, 12],
            }}
            transition={{
              duration: 3.4,
              delay: 0.5 + i * 0.12,
              times: [0, 0.25, 0.55, 1],
              ease: "easeInOut",
            }}
            className="absolute select-none text-2xl drop-shadow-sm"
          >
            {d.icon}
          </motion.span>
        );
      })}

      {/* Glow that grows around the book as distractions fade */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 0, 0.55], scale: [0.7, 0.85, 1.15] }}
        transition={{ duration: 3.6, times: [0, 0.55, 1], ease: "easeOut" }}
        aria-hidden="true"
        className="pointer-events-none absolute h-44 w-32 rounded-full bg-emerald-400/30 blur-3xl"
      />
    </div>
  );
}

// --- Scene 2: timer counts up, pauses, resumes, with status badge ---------

function SceneTimer() {
  const [seconds, setSeconds] = useState(23);
  const [paused, setPaused] = useState(false);

  // Counter
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(
      () => setSeconds((s) => s + 1),
      500, // 2× speed so the demo feels alive
    );
    return () => window.clearInterval(id);
  }, [paused]);

  // Demo: pause briefly halfway through to show the gated tracker
  useEffect(() => {
    const t1 = window.setTimeout(() => setPaused(true), 1900);
    const t2 = window.setTimeout(() => setPaused(false), 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-[3.5rem] font-semibold tabular-nums leading-none tracking-[-0.05em] text-slate-950 dark:text-zinc-50 sm:text-6xl"
      >
        {mins}:{secs}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={paused ? "paused" : "counting"}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.25 }}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            paused
              ? "border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          <motion.span
            animate={
              paused
                ? { scale: 1, opacity: 0.6 }
                : { scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }
            }
            transition={
              paused
                ? {}
                : { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            }
            className={`h-1.5 w-1.5 rounded-full ${
              paused ? "bg-slate-400 dark:bg-zinc-500" : "bg-emerald-500"
            }`}
          />
          {paused ? "Pausado" : "Contando"}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- Scene 3: achievements unlock one by one with sparkle pops ------------

function SceneAchievements() {
  const badges = [
    { emoji: "🌱", gradient: "from-emerald-400 to-teal-500", unlockAt: 300 },
    { emoji: "🔥", gradient: "from-orange-400 to-rose-500", unlockAt: 900 },
    { emoji: "⚡", gradient: "from-amber-400 to-yellow-500", unlockAt: 1500 },
    {
      emoji: "👑",
      gradient: "from-violet-500 to-fuchsia-500",
      unlockAt: 2100,
    },
  ];

  return (
    <div className="flex h-full items-center justify-center gap-3 sm:gap-5">
      {badges.map((b, i) => (
        <Badge
          key={i}
          emoji={b.emoji}
          gradient={b.gradient}
          unlockAt={b.unlockAt}
        />
      ))}
    </div>
  );
}

function Badge({
  emoji,
  gradient,
  unlockAt,
}: {
  emoji: string;
  gradient: string;
  unlockAt: number;
}) {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setUnlocked(true), unlockAt);
    return () => window.clearTimeout(id);
  }, [unlockAt]);

  return (
    <div className="relative">
      <motion.div
        animate={
          unlocked
            ? {
                scale: [1, 1.18, 1],
                rotate: [0, -4, 4, 0],
              }
            : { scale: 1, rotate: 0 }
        }
        transition={{ duration: 0.5, ease: "easeOut" }}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br shadow-[0_12px_24px_rgba(15,23,42,0.12)] transition-colors duration-300 sm:h-16 sm:w-16 ${
          unlocked
            ? gradient
            : "from-slate-200 to-slate-300 dark:from-zinc-800 dark:to-zinc-700"
        }`}
      >
        {unlocked ? (
          <span className="text-2xl drop-shadow-sm sm:text-3xl">{emoji}</span>
        ) : (
          <Lock className="h-5 w-5 text-slate-400 dark:text-zinc-500" />
        )}
      </motion.div>

      {/* Sparkle that pops in on unlock */}
      <AnimatePresence>
        {unlocked && (
          <motion.span
            initial={{ scale: 0, rotate: -30, opacity: 0 }}
            animate={{
              scale: [0, 1.3, 1],
              rotate: [0, 12, 0],
              opacity: [0, 1, 1],
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1.4, 0.4, 1] }}
            className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md dark:bg-zinc-100"
          >
            <Sparkles className="h-2.5 w-2.5 text-amber-500" />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Soft halo */}
      {unlocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-br blur-xl ${gradient}`}
        />
      )}
    </div>
  );
}
