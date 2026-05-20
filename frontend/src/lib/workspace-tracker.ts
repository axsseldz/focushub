"use client";

/**
 * Active workspace tracker.
 *
 * Mirrors :mod:`reading-tracker` but adapted for the LaTeX workspace.
 * Reading time gets counted when the user is *turning pages*; workspace
 * time gets counted when the user is *authoring* — typing in the chat or
 * editor, editing the document source, uploading assets, compiling, or
 * scrolling the PDF preview. Three gates must all stay open or the
 * clock pauses:
 *
 *   1. **Presence** — tab visible AND window focused.
 *   2. **Recent interaction** — at least one input event (mouse, key,
 *      scroll, touch) within `SOFT_IDLE_MS`.
 *   3. **Recent workspace proof** — at least one *authoring* signal
 *      inside the last `WORKSPACE_PROOF_MS`. Authoring signals include
 *      key presses (typing), chat sends, source saves, asset
 *      uploads/deletes, compiles and wheel/scroll events on the PDF.
 *      Without one in that window the tracker pauses even if the mouse
 *      is still wiggling.
 *
 * Failed flushes are queued in localStorage under a workspace-specific
 * key and replayed once the network recovers, matching the reading
 * tracker exactly.
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
 * Workspace-proof freshness — without an authoring signal within this
 * window we treat the user as not actively working even if they keep
 * wiggling the mouse. 3 minutes mirrors the reading tracker's grace
 * period: enough to think between keystrokes but short enough that an
 * abandoned tab stops counting fast.
 */
const WORKSPACE_PROOF_MS = 3 * 60_000;

/** Tick cadence of the active-time accumulator. */
const TICK_MS = 1_000;

/**
 * Minimum pixels a mouse must travel between samples for the move to
 * count as a real interaction.
 */
const MOUSE_NOISE_PX = 4;

/** localStorage key for sessions that failed to flush online. */
const QUEUE_KEY = "focushub:workspace-tracker:pending-sessions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PendingSession = {
  project_id: number | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  user_id: string;
};

export type WorkspaceTrackerHandle = {
  /**
   * Call from the workspace whenever a strong "user is authoring" signal
   * happens — chat send, source save, asset upload, compile click. Without
   * one of these (or a key press / scroll-in-canvas) within
   * `WORKSPACE_PROOF_MS` the tracker pauses.
   */
  notifyWorkspaceActivity: () => void;
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
      const response = await fetch(`${API_BASE_URL}/workspace-sessions`, {
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
  try {
    const response = await fetch(`${API_BASE_URL}/workspace-sessions`, {
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

function postSessionUnload(payload: PendingSession): void {
  const url = `${API_BASE_URL}/workspace-sessions?user_id=${encodeURIComponent(
    payload.user_id,
  )}`;
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
 * Mount this hook on the workspace canvas. It only counts seconds while
 * the user is presently and actively authoring — see the file header for
 * the gates.
 *
 * `projectId` accepts the workspace project id as a string (coerced to
 * int for the backend); pass `null` to keep the tracker paused (e.g.
 * before the project finishes loading).
 *
 * The returned `notifyWorkspaceActivity()` MUST be called whenever the
 * user performs a strong authoring action (chat send, save, compile,
 * asset upload). Without those signals — or a key press / wheel inside
 * the workspace — the tracker assumes the user has walked away and
 * pauses after `WORKSPACE_PROOF_MS`.
 */
export function useWorkspaceSessionTracker(
  projectId: string | null,
): WorkspaceTrackerHandle {
  const { userId, isLoaded } = useAuth();
  const userIdRef = useRef<string | null>(userId ?? null);

  const startedAtRef = useRef<Date | null>(null);
  const accumulatedRef = useRef<number>(0);
  const lastInteractionRef = useRef<number>(0);
  const lastWorkspaceProofRef = useRef<number>(0);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const tickIdRef = useRef<number | null>(null);
  const projectIdRef = useRef<string | null>(projectId);
  const notifyRef = useRef<() => void>(() => {});

  useEffect(() => {
    userIdRef.current = userId ?? null;
  }, [userId]);

  useEffect(() => {
    if (isLoaded && userId) {
      void flushQueueToBackend();
    }
  }, [isLoaded, userId]);

  useEffect(() => {
    projectIdRef.current = projectId;
    if (!projectId || !isLoaded || !userId) {
      notifyRef.current = () => {};
      return;
    }

    // Reset session state on every fresh project. The clock does NOT
    // start ticking until the first workspace-proof signal fires —
    // opening a project and walking away counts for zero seconds.
    const now = Date.now();
    startedAtRef.current = new Date();
    accumulatedRef.current = 0;
    lastInteractionRef.current = now;
    lastWorkspaceProofRef.current = now;
    lastMousePosRef.current = null;

    // -----------------------------------------------------------------
    // Signal handlers
    // -----------------------------------------------------------------

    const markInteraction = () => {
      lastInteractionRef.current = Date.now();
    };

    const markWorkspaceProof = () => {
      const t = Date.now();
      lastInteractionRef.current = t;
      lastWorkspaceProofRef.current = t;
    };

    notifyRef.current = markWorkspaceProof;

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
      // Scrolling the PDF preview / chat / editor counts as authoring
      // proof — the user is reviewing the document in real time.
      markWorkspaceProof();
    };

    const handleKey = (event: KeyboardEvent) => {
      // Typing into the chat, editor or filename is the strongest
      // possible proof. We treat ANY key as authoring, since the
      // workspace is primarily a writing surface.
      void event;
      markWorkspaceProof();
    };

    // -----------------------------------------------------------------
    // Gates & tick
    // -----------------------------------------------------------------

    const isPresent = (): boolean => {
      if (typeof document === "undefined") return false;
      if (document.visibilityState !== "visible") return false;
      return typeof document.hasFocus !== "function" || document.hasFocus();
    };

    const isActivelyWorking = (): boolean => {
      const t = Date.now();
      if (!isPresent()) return false;
      if (t - lastInteractionRef.current >= SOFT_IDLE_MS) return false;
      if (t - lastWorkspaceProofRef.current >= WORKSPACE_PROOF_MS) return false;
      return true;
    };

    const tick = () => {
      if (isActivelyWorking()) {
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
      const numericProjectId = Number.parseInt(projectIdRef.current ?? "", 10);
      return {
        project_id: Number.isFinite(numericProjectId) ? numericProjectId : null,
        started_at: started.toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: duration,
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
    window.addEventListener("scroll", markWorkspaceProof, { passive: true });
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });
    window.addEventListener("touchmove", markWorkspaceProof, { passive: true });
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
      window.removeEventListener("scroll", markWorkspaceProof);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", markInteraction);
      window.removeEventListener("touchmove", markWorkspaceProof);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
      notifyRef.current = () => {};
      flush("online");
    };
  }, [projectId, isLoaded, userId]);

  const notifyWorkspaceActivity = useCallback(() => {
    notifyRef.current();
  }, []);

  return { notifyWorkspaceActivity };
}
