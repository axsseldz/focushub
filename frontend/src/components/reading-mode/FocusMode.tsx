"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AmbientType = "off" | "brown" | "pink" | "white";

type FocusModeProps = {
  enabled: boolean;
  onExit: () => void;
};

const AMBIENT_LABELS: Record<AmbientType, string> = {
  off: "Silencio",
  brown: "Ruido marrón",
  pink: "Ruido rosa",
  white: "Ruido blanco",
};

const STORAGE_KEY_AMBIENT = "focushub:focus:ambient";
const STORAGE_KEY_VOLUME = "focushub:focus:volume";

// ---------------------------------------------------------------------------
// Noise synthesis
//
// Three flavours of ambient noise, each generated directly in-browser via the
// Web Audio API — no assets to ship. A 2-second buffer is looped for stable
// CPU usage and seamless playback. Algorithms are standard:
//   · white : uniform random samples in [-1, 1]
//   · pink  : Paul Kellet's filter (1/f approximation)
//   · brown : integrated white noise (heavier low end, most relaxing)
// ---------------------------------------------------------------------------

function createNoiseBuffer(
  ctx: AudioContext,
  type: Exclude<AmbientType, "off">,
): AudioBuffer {
  const seconds = 2;
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === "white") {
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
  }

  return buffer;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Requests fullscreen on <html> when `enabled` turns true and releases it
 * when it turns false. If the user presses Escape or otherwise exits
 * fullscreen, we call `onExit` so the parent can sync its state.
 */
function useFullscreen(enabled: boolean, onExit: () => void) {
  useEffect(() => {
    if (!enabled) return;

    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        // User or browser denied fullscreen — focus mode still works,
        // just without the immersive window state.
      });
    }

    const handleChange = () => {
      if (!document.fullscreenElement) onExit();
    };
    document.addEventListener("fullscreenchange", handleChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [enabled, onExit]);
}

/**
 * Holds a screen wake lock while `enabled` is true so the display does not
 * dim or sleep during a focus block. Re-acquires the lock if the tab is
 * backgrounded and later returned to (wake locks are auto-released on
 * visibilitychange → hidden).
 */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    if (!("wakeLock" in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Some browsers refuse unless the tab is visible; fine either way.
      }
    };

    const onVisibility = () => {
      if (!released && document.visibilityState === "visible") {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
}

/**
 * Plays a synthesized noise loop while `enabled && type !== "off"`. Volume is
 * adjusted live without restarting the source. The AudioContext is created
 * on first play and closed on unmount.
 */
function useAmbient(enabled: boolean, type: AmbientType, volume: number) {
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    // Always stop the previous source when either the toggle flips or the
    // noise flavour changes.
    const previous = sourceRef.current;
    if (previous) {
      try {
        previous.stop();
      } catch {
        // Ignore — source may already be stopped.
      }
      previous.disconnect();
      sourceRef.current = null;
    }

    if (!enabled || type === "off") return;
    if (typeof window === "undefined" || !window.AudioContext) return;

    if (!ctxRef.current) ctxRef.current = new AudioContext();
    if (!gainRef.current) {
      gainRef.current = ctxRef.current.createGain();
      gainRef.current.connect(ctxRef.current.destination);
    }
    gainRef.current.gain.value = volume;

    const buffer = createNoiseBuffer(ctxRef.current, type);
    const source = ctxRef.current.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainRef.current);
    source.start();
    sourceRef.current = source;

    return () => {
      try {
        source.stop();
      } catch {
        // Ignore.
      }
      source.disconnect();
    };
  }, [enabled, type, volume]);

  // Live volume updates without tearing down the source.
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  // Close the AudioContext only when the component unmounts for good.
  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
      gainRef.current = null;
    };
  }, []);
}

/**
 * Returns the number of seconds elapsed since `enabled` turned true. Resets
 * every time the focus block restarts.
 */
function useElapsed(enabled: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return elapsed;
}

/**
 * Watches page visibility. When the tab goes hidden during focus and returns
 * after ≥ 3 seconds, exposes the away duration so the caller can nudge the
 * user back. The value auto-clears after 5 s so the nudge doesn't linger.
 */
function useDistractionTracker(enabled: boolean): number | null {
  const [awayFor, setAwayFor] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAwayFor(null);
      return;
    }

    let leftAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        leftAt = Date.now();
      } else if (leftAt !== null) {
        const seconds = Math.round((Date.now() - leftAt) / 1000);
        if (seconds >= 3) setAwayFor(seconds);
        leftAt = null;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled]);

  useEffect(() => {
    if (awayFor === null) return;
    const id = window.setTimeout(() => setAwayFor(null), 5000);
    return () => window.clearTimeout(id);
  }, [awayFor]);

  return awayFor;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function readStoredAmbient(): AmbientType {
  if (typeof window === "undefined") return "off";
  const raw = window.localStorage.getItem(STORAGE_KEY_AMBIENT);
  return raw === "brown" || raw === "pink" || raw === "white" ? raw : "off";
}

function readStoredVolume(): number {
  if (typeof window === "undefined") return 0.4;
  const raw = window.localStorage.getItem(STORAGE_KEY_VOLUME);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0.4;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FocusMode
 *
 * A distraction-free overlay for the PDF reader. When `enabled` is true:
 *   · the tab enters fullscreen
 *   · a screen wake lock keeps the display from sleeping
 *   · optional ambient noise plays (synthesized, not streamed)
 *   · tab switches are detected and surfaced as a gentle nudge
 *
 * The component only renders its own floating controls — the caller is
 * responsible for dimming the rest of the reader UI.
 */
export function FocusMode({ enabled, onExit }: FocusModeProps) {
  const [ambient, setAmbient] = useState<AmbientType>(() => readStoredAmbient());
  const [volume, setVolume] = useState<number>(() => readStoredVolume());

  useFullscreen(enabled, onExit);
  useWakeLock(enabled);
  useAmbient(enabled, ambient, volume);
  const elapsed = useElapsed(enabled);
  const awayFor = useDistractionTracker(enabled);

  // Persist preferences across sessions.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_AMBIENT, ambient);
    } catch {
      // Quota / private mode — fine to skip.
    }
  }, [ambient]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_VOLUME, String(volume));
    } catch {
      // Same as above.
    }
  }, [volume]);

  if (!enabled) return null;

  return (
    <>
      {/* Top pill: status + elapsed + exit. Fixed to the viewport so it is
          always reachable regardless of scroll. */}
      <div className="fixed left-1/2 top-4 z-[70] -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-4 py-1.5 text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            En Focus
          </span>
          <span className="text-[11px] tabular-nums text-white/80">
            {formatElapsed(elapsed)}
          </span>
          <button
            type="button"
            onClick={onExit}
            className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/90 transition-colors hover:bg-white/20"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Bottom-left: ambient sound controller. Sits out of the way of the
          PDF page navigation at the bottom of the viewport. */}
      <div className="fixed bottom-6 left-6 z-[70]">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-3 py-2 text-white/80 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md">
          <SoundIcon />
          <select
            value={ambient}
            onChange={(e) => setAmbient(e.target.value as AmbientType)}
            aria-label="Sonido ambiente"
            className="rounded-md border border-white/10 bg-black/50 px-1.5 py-0.5 text-[11px] text-white/90 outline-none"
          >
            {(Object.keys(AMBIENT_LABELS) as AmbientType[]).map((key) => (
              <option key={key} value={key} className="bg-black">
                {AMBIENT_LABELS[key]}
              </option>
            ))}
          </select>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            disabled={ambient === "off"}
            aria-label="Volumen de ambiente"
            className="h-1 w-24 cursor-pointer accent-emerald-400 disabled:opacity-40"
          />
        </div>
      </div>

      {/* Distraction nudge: shown when the user comes back after ≥3s away. */}
      <AnimatePresence>
        {awayFor !== null && (
          <motion.div
            key="away-toast"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-none fixed right-6 top-20 z-[80]"
          >
            <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-xs text-amber-100 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md">
              Estuviste fuera <strong className="tabular-nums">{awayFor}s</strong>.
              Respira y regresa al libro.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Icon
// ---------------------------------------------------------------------------

function SoundIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 text-white/70"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 9v6h4l5 4V5L8 9H4ZM16 9.5a4 4 0 0 1 0 5M19 7a7 7 0 0 1 0 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
