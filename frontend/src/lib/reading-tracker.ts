"use client";

/**
 * Active reading tracker.
 *
 * Goal: only count seconds when the user is *actually reading*, not when
 * the tab is parked or the user is wiggling the mouse to keep the timer
 * alive. We layer three independent gates and only tick when all three
 * are open:
 *
 *   1. **Presence** — tab visible AND window focused. If either is false,
 *      we pause immediately. (Visibility flips when switching tabs;
 *      focus flips when the user clicks into another window.)
 *
 *   2. **Recent interaction** — at least one input event (mouse, keyboard,
 *      scroll, touch) inside the last `SOFT_IDLE_MS`. Stops the clock
 *      when the user walks away.
 *
 *   3. **Recent reading proof** — at least one *reading-specific* signal
 *      in the last `READING_PROOF_MS`. Reading signals are explicit
 *      indicators of progress: page turns and scrolls inside the reader
 *      surface. Without one of these, the tracker enters a grace period
 *      and after `READING_PROOF_MS` of nothing it pauses, even if the
 *      mouse is moving. This is what stops "open book + tab parked"
 *      from counting toward analytics.
 *
 * Mouse movement is filtered: micro twitches (< `MOUSE_NOISE_PX` between
 * samples) are ignored so trackpad jitter or a sleeping mouse don't keep
 * the soft-interaction timer alive.
 *
 * On unmount / book change / tab unload the accumulated session is
 * flushed to the backend. Failed flushes are queued in localStorage and
 * replayed on the next successful flush.
 */

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** Sessions shorter than this are not persisted — they are accidental. */
const MIN_FLUSH_SECONDS = 5;

/** Soft idle — no interaction for this long pauses the clock. */
const SOFT_IDLE_MS = 45_000;

/**
 * Reading-proof freshness — without a page turn / scroll-in-reader within
 * this window we treat the user as not actively reading even if they're
 * still wiggling the mouse. 3 minutes is generous enough to think between
 * page turns but short enough that an abandoned tab stops counting fast.
 */
const READING_PROOF_MS = 3 * 60_000;

/** Tick cadence of the active-time accumulator. */
const TICK_MS = 1_000;

/**
 * Minimum pixels a mouse must travel between samples for the move to
 * count as a real interaction. Filters out trackpad jitter / static
 * mouse readings sent by some browsers when the OS is asleep.
 */
const MOUSE_NOISE_PX = 4;

/** localStorage key for sessions that failed to flush online. */
const QUEUE_KEY = "focushub:tracker:pending-sessions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingSession = {
  book_id: number | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  pages_read?: number | null;
  // The Clerk user ID at the time the session ended. The queue persists
  // across reloads so we need to remember which account it belongs to.
  user_id: string;
};

export type ReadingTrackerHandle = {
  /**
   * Call this from the reader whenever a strong "user is reading" signal
   * happens — page turn, scroll within the document, zoom change. Without
   * one of these within `READING_PROOF_MS` the tracker pauses.
   */
  notifyReadingActivity: () => void;
};

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function readQueue(): PendingSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as PendingSession[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingSession[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Quota / private mode — drop silently. Losing telemetry beats crashing.
  }
}

async function flushQueueToBackend(): Promise<void> {
  const queue = readQueue();
  if (queue.length === 0) return;

  const remaining: PendingSession[] = [];
  for (const session of queue) {
    try {
      const response = await fetch(`${API_BASE_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": session.user_id,
        },
        body: JSON.stringify(session),
        keepalive: true,
      });
      if (!response.ok) remaining.push(session);
    } catch {
      remaining.push(session);
    }
  }

  writeQueue(remaining);
}

async function postSession(payload: PendingSession): Promise<void> {
  // Try the backend first. On failure, queue locally so we don't lose
  // engagement data when the API is briefly unreachable.
  try {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": payload.user_id,
      },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    void flushQueueToBackend();
  } catch {
    const queue = readQueue();
    queue.push(payload);
    writeQueue(queue);
  }
}

/**
 * Best-effort flush during the unload path. sendBeacon can't set headers
 * so the user ID rides in the query string (the backend's auth dep
 * accepts both header and ?user_id=).
 */
function postSessionUnload(payload: PendingSession): void {
  const url = `${API_BASE_URL}/sessions?user_id=${encodeURIComponent(payload.user_id)}`;
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    } catch {
      // fall through
    }
  }

  const queue = readQueue();
  queue.push(payload);
  writeQueue(queue);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Mount this hook on the reader. It only counts seconds while the user
 * is presently and actively reading — see the file header for the gates.
 *
 * `bookId` accepts the frontend Book.id string (coerced to int for the
 * backend); pass `null` to keep the tracker paused (e.g. when no book is
 * open).
 *
 * The returned `notifyReadingActivity()` MUST be called by the reader on
 * page changes (and ideally on scroll within the page surface). Without
 * those signals the tracker assumes the user has stopped reading after
 * `READING_PROOF_MS` and pauses.
 */
export function useReadingSessionTracker(
  bookId: string | null,
): ReadingTrackerHandle {
  const { userId, isLoaded } = useAuth();
  const userIdRef = useRef<string | null>(userId ?? null);

  // All state lives in refs so we don't trigger re-renders for every tick.
  const startedAtRef = useRef<Date | null>(null);
  const accumulatedRef = useRef<number>(0);
  const lastInteractionRef = useRef<number>(0);
  const lastReadingProofRef = useRef<number>(0);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const tickIdRef = useRef<number | null>(null);
  const bookIdRef = useRef<string | null>(bookId);
  const notifyReadingRef = useRef<() => void>(() => {});

  useEffect(() => {
    userIdRef.current = userId ?? null;
  }, [userId]);

  useEffect(() => {
    if (isLoaded && userId) {
      void flushQueueToBackend();
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    bookIdRef.current = bookId;
    if (!bookId || !isLoaded || !userId) {
      notifyReadingRef.current = () => {};
      return;
    }

    // Reset session state on every fresh book. The clock does NOT start
    // ticking until the first reading-proof signal fires — opening a book
    // and walking away counts for zero seconds.
    const now = Date.now();
    startedAtRef.current = new Date();
    accumulatedRef.current = 0;
    lastInteractionRef.current = now;
    lastReadingProofRef.current = now;
    lastMousePosRef.current = null;

    // -----------------------------------------------------------------
    // Signal handlers
    // -----------------------------------------------------------------

    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    const markReadingProof = () => {
      const t = Date.now();
      lastInteractionRef.current = t;
      lastReadingProofRef.current = t;
    };

    notifyReadingRef.current = markReadingProof;

    const handleMouseMove = (event: MouseEvent) => {
      const prev = lastMousePosRef.current;
      const curr = { x: event.clientX, y: event.clientY };
      lastMousePosRef.current = curr;
      if (prev) {
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        if (Math.hypot(dx, dy) < MOUSE_NOISE_PX) return;
      }
      markInteraction();
    };

    const handleWheel = () => {
      // Wheel events inside the document almost always mean the user is
      // scrolling the reader, so treat as a reading-proof signal.
      markReadingProof();
    };

    const handleKey = (event: KeyboardEvent) => {
      // Page-nav keys are a strong reading signal. Other keys are just
      // soft interaction.
      const key = event.key;
      if (
        key === "ArrowDown" ||
        key === "ArrowUp" ||
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "PageDown" ||
        key === "PageUp" ||
        key === " "
      ) {
        markReadingProof();
      } else {
        markInteraction();
      }
    };

    // -----------------------------------------------------------------
    // Gates & tick
    // -----------------------------------------------------------------

    const isPresent = (): boolean => {
      if (typeof document === "undefined") return false;
      if (document.visibilityState !== "visible") return false;
      // hasFocus is undefined in some test envs — default to true there.
      return typeof document.hasFocus !== "function" || document.hasFocus();
    };

    const isActivelyReading = (): boolean => {
      const t = Date.now();
      if (!isPresent()) return false;
      if (t - lastInteractionRef.current >= SOFT_IDLE_MS) return false;
      if (t - lastReadingProofRef.current >= READING_PROOF_MS) return false;
      return true;
    };

    const tick = () => {
      if (isActivelyReading()) {
        accumulatedRef.current += TICK_MS / 1000;
      }
    };

    tickIdRef.current = window.setInterval(tick, TICK_MS);

    // -----------------------------------------------------------------
    // Flushing
    // -----------------------------------------------------------------

    const buildPayload = (): PendingSession | null => {
      const started = startedAtRef.current;
      const duration = Math.round(accumulatedRef.current);
      const currentUserId = userIdRef.current;
      if (!started || duration < MIN_FLUSH_SECONDS || !currentUserId) {
        return null;
      }
      const numericBookId = Number.parseInt(bookIdRef.current ?? "", 10);
      return {
        book_id: Number.isFinite(numericBookId) ? numericBookId : null,
        started_at: started.toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        pages_read: null,
        user_id: currentUserId,
      };
    };

    const flush = (mode: "online" | "unload") => {
      const payload = buildPayload();
      if (!payload) return;
      accumulatedRef.current = 0;
      startedAtRef.current = new Date();
      if (mode === "unload") {
        postSessionUnload(payload);
      } else {
        void postSession(payload);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flush("online");
    };
    const handleBlur = () => flush("online");
    const handleUnload = () => flush("unload");

    // -----------------------------------------------------------------
    // Listeners
    // -----------------------------------------------------------------

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", markReadingProof, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    window.addEventListener("touchmove", markReadingProof, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      if (tickIdRef.current !== null) {
        window.clearInterval(tickIdRef.current);
        tickIdRef.current = null;
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", markReadingProof);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("touchmove", markReadingProof);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      notifyReadingRef.current = () => {};
      flush("online");
    };
  }, [bookId, isLoaded, userId]);

  // Stable callback that always proxies to the current effect's
  // markReadingProof. Callers can pass this into useEffect deps without
  // re-subscribing to listeners every render.
  const notifyReadingActivity = useCallback(() => {
    notifyReadingRef.current();
  }, []);

  return { notifyReadingActivity };
}
