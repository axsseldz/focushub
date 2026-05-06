"use client";

/**
 * Active reading tracker.
 *
 * The tracker accumulates *engaged* time — seconds during which the tab is
 * visible and the user has been recently interactive (mouse / keyboard /
 * scroll / touch within the last `IDLE_THRESHOLD_MS`). Anything else (tab
 * hidden, user walked away) is ignored. This is what makes the streak and
 * daily-goal numbers meaningful instead of inflated wall-clock time.
 *
 * On unmount, on book change, and on `pagehide` / `beforeunload` the
 * accumulated session is flushed to the backend. If the backend fetch
 * fails (offline, dev server down, etc.) the payload is queued in
 * localStorage and replayed on the next successful flush.
 */

import { useEffect, useRef } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/** Sessions shorter than this are not persisted — they are accidental. */
const MIN_FLUSH_SECONDS = 5;

/** No interaction for this long → user is considered idle, timer pauses. */
const IDLE_THRESHOLD_MS = 60_000;

/** Tick cadence of the active-time accumulator. */
const TICK_MS = 1_000;

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
        headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`status ${response.status}`);
    // Opportunistically drain any earlier queued sessions once we're back.
    void flushQueueToBackend();
  } catch {
    const queue = readQueue();
    queue.push(payload);
    writeQueue(queue);
  }
}

/**
 * Best-effort flush during the unload path. Uses sendBeacon when available
 * because fetch/keepalive is unreliable on actual page unloads.
 */
function postSessionUnload(payload: PendingSession): void {
  const url = `${API_BASE_URL}/sessions`;
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

  // Fallback: queue locally so next mount flushes it.
  const queue = readQueue();
  queue.push(payload);
  writeQueue(queue);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Mount this hook on the reader page. It starts ticking active seconds the
 * moment a `bookId` is provided and flushes the session on unmount, book
 * change, or page unload.
 *
 * `bookId` accepts a string (the frontend Book.id is a string) which is
 * coerced to int for the backend; pass `null` if you want the tracker to
 * stay paused (e.g. when no book is open).
 */
export function useReadingSessionTracker(bookId: string | null): void {
  // All state lives in refs so we don't trigger re-renders for every tick.
  const startedAtRef = useRef<Date | null>(null);
  const accumulatedRef = useRef<number>(0);
  // Initialised inside the effect — `Date.now()` is impure and can't be
  // called during render.
  const lastInteractionRef = useRef<number>(0);
  const tickIdRef = useRef<number | null>(null);
  const bookIdRef = useRef<string | null>(bookId);

  // Flush pending queue once on mount. Cheap if it's empty.
  useEffect(() => {
    void flushQueueToBackend();
  }, []);

  useEffect(() => {
    bookIdRef.current = bookId;
    if (!bookId) return;

    // Reset session state on every fresh book.
    startedAtRef.current = new Date();
    accumulatedRef.current = 0;
    lastInteractionRef.current = Date.now();

    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    const isActive = (): boolean => {
      if (typeof document === "undefined") return false;
      if (document.visibilityState !== "visible") return false;
      return Date.now() - lastInteractionRef.current < IDLE_THRESHOLD_MS;
    };

    const tick = () => {
      if (isActive()) {
        accumulatedRef.current += TICK_MS / 1000;
      }
    };

    tickIdRef.current = window.setInterval(tick, TICK_MS);

    const buildPayload = (): PendingSession | null => {
      const started = startedAtRef.current;
      const duration = Math.round(accumulatedRef.current);
      if (!started || duration < MIN_FLUSH_SECONDS) return null;
      const numericBookId = Number.parseInt(bookIdRef.current ?? "", 10);
      return {
        book_id: Number.isFinite(numericBookId) ? numericBookId : null,
        started_at: started.toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
        pages_read: null,
      };
    };

    const flush = (mode: "online" | "unload") => {
      const payload = buildPayload();
      if (!payload) return;
      // Reset so a subsequent flush from a different code path doesn't
      // double-count the same seconds.
      accumulatedRef.current = 0;
      startedAtRef.current = new Date();
      if (mode === "unload") {
        postSessionUnload(payload);
      } else {
        void postSession(payload);
      }
    };

    const handleVisibility = () => {
      // When the tab becomes hidden, lock in the work we've done so far
      // — we may not get a chance later if the user closes the tab.
      if (document.visibilityState === "hidden") flush("online");
    };

    const handleUnload = () => flush("unload");

    window.addEventListener("mousemove", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("scroll", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      if (tickIdRef.current !== null) {
        window.clearInterval(tickIdRef.current);
        tickIdRef.current = null;
      }
      window.removeEventListener("mousemove", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("scroll", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      flush("online");
    };
  }, [bookId]);
}
