"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useFocusMode } from "@/lib/focus-mode";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FocusModeProps = {
  /** Current state of the gesture-navigation toggle in the parent reader. */
  gestureEnabled?: boolean;
  /** Toggle gesture navigation. When provided, a control appears in the
   *  floating chrome so the user can enable / disable gestures without
   *  leaving focus mode (the regular header is hidden in this state). */
  onToggleGestures?: () => void;
};

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
 * Returns the number of seconds elapsed since `enabled` turned true. The
 * timestamp is captured inside the effect (impure calls aren't allowed in
 * render with React 19) and the displayed value is masked to 0 when the
 * mode is off so a previous session's count doesn't leak into a new one.
 */
function useElapsed(enabled: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const started = Date.now();
    const update = () =>
      setElapsed(Math.floor((Date.now() - started) / 1000));
    // Run the first update on a microtask so we don't write state from
    // inside the effect body, which the React 19 lint rule flags.
    const initial = window.setTimeout(update, 0);
    const id = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [enabled]);

  return enabled ? elapsed : 0;
}

/**
 * Reveals the floating chrome on pointer movement and re-hides it after a
 * short idle window. While disabled, always returns `true` so the chrome is
 * unaffected outside focus mode.
 */
function useChromeReveal(enabled: boolean, idleMs = 2200) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    let timer: number | undefined;
    const show = () => {
      setVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setVisible(false), idleMs);
    };

    // Schedule the initial reveal asynchronously so we never call setState
    // synchronously from inside the effect body.
    const initial = window.setTimeout(show, 0);
    window.addEventListener("mousemove", show);
    window.addEventListener("keydown", show);
    window.addEventListener("touchstart", show);

    return () => {
      window.clearTimeout(initial);
      window.clearTimeout(timer);
      window.removeEventListener("mousemove", show);
      window.removeEventListener("keydown", show);
      window.removeEventListener("touchstart", show);
    };
  }, [enabled, idleMs]);

  return enabled ? visible : true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FocusMode
 *
 * A distraction-free overlay for the PDF reader. Reads its enabled flag from
 * the global FocusModeContext. While active:
 *   · the tab enters fullscreen and acquires a screen wake lock
 *   · a soft charcoal wash fades in over the reader (z-40, pointer-events-none)
 *   · floating chrome (top pill: status, elapsed, gesture toggle, exit) auto
 *     hides after ~2 s of idle and reappears on any pointer / keyboard activity
 *
 * The wash sits at z-40 (under the gesture camera at z-50) so the camera
 * preview stays visible. The chrome lives at z-70 so it stays clickable.
 */
export function FocusMode({ gestureEnabled, onToggleGestures }: FocusModeProps) {
  const { enabled, disable } = useFocusMode();

  useFullscreen(enabled, disable);
  useWakeLock(enabled);
  const elapsed = useElapsed(enabled);
  const chromeVisible = useChromeReveal(enabled);

  return (
    <AnimatePresence>
      {enabled && (
        <>
          {/* Soft palette wash. Pointer-events disabled so the reader stays
              fully interactive underneath. Sits below the gesture camera
              (z-50) so the camera preview is never obscured. */}
          <motion.div
            key="focus-wash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[40] bg-[radial-gradient(ellipse_at_center,_rgba(20,22,28,0.28)_0%,_rgba(5,6,9,0.7)_100%)]"
          />

          {/* Floating chrome — only this layer captures pointer events. */}
          <motion.div
            key="focus-chrome"
            initial={{ opacity: 0 }}
            animate={{ opacity: chromeVisible ? 1 : 0.08 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed left-1/2 top-4 z-[70] -translate-x-1/2"
            onMouseEnter={(event) => {
              // While the chrome is dim, hovering it should restore full
              // visibility so the user can read the buttons.
              (event.currentTarget as HTMLDivElement).style.opacity = "1";
            }}
          >
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/55 px-4 py-1.5 text-xs text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                En Focus
              </span>
              <span className="text-[11px] tabular-nums opacity-80">
                {formatElapsed(elapsed)}
              </span>
              {onToggleGestures && (
                <button
                  type="button"
                  onClick={onToggleGestures}
                  aria-pressed={gestureEnabled ?? false}
                  title="Activar / desactivar gestos"
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    gestureEnabled
                      ? "bg-emerald-400/20 text-emerald-200 hover:bg-emerald-400/30"
                      : "bg-white/10 text-white/90 hover:bg-white/20"
                  }`}
                >
                  <HandIcon active={gestureEnabled ?? false} />
                  Gestos
                </button>
              )}
              <button
                type="button"
                onClick={disable}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold transition-colors hover:bg-white/25"
              >
                Salir
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function HandIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 transition-colors ${
        active ? "text-emerald-300" : "text-white/80"
      }`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M18 11V9a2 2 0 0 0-4 0v-.5M14 8.5V6a2 2 0 0 0-4 0v3M10 9V5a2 2 0 0 0-4 0v8l-1.5-2a1.5 1.5 0 0 0-2.122 2.122L5 18a7 7 0 0 0 7 3.5 7 7 0 0 0 7-7v-3.5a2 2 0 0 0-4 0V11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}
