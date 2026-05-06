"use client";

/**
 * Analytics math.
 *
 * All bucketing happens client-side in the user's local timezone — the
 * backend only stores raw UTC sessions. Doing it here means the user sees
 * "today" relative to their wall clock, no matter where the server lives.
 */

export type ReadingSessionDTO = {
  id: number;
  book_id: number | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  pages_read: number | null;
  created_at: string;
};

export type DailyBucket = {
  /** ISO date in local TZ, e.g. "2026-05-04". Used as a stable key. */
  iso: string;
  /** A `Date` at midnight local time for the bucket. */
  date: Date;
  /** Total active seconds for the bucket. */
  seconds: number;
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function localISODate(date: Date): string {
  // YYYY-MM-DD in local TZ — `toISOString` would shift to UTC and bucket
  // sessions on the wrong day for users east of Greenwich.
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// ---------------------------------------------------------------------------
// Bucketing
// ---------------------------------------------------------------------------

/**
 * Build a contiguous array of daily buckets ending at `endDay` (inclusive)
 * and spanning `days` total entries. Sessions that straddle midnight are
 * attributed to the day in which they ended — we treat the end timestamp
 * as the moment the work "landed".
 */
export function buildDailyBuckets(
  sessions: readonly ReadingSessionDTO[],
  days: number,
  endDay: Date = new Date(),
): DailyBucket[] {
  const end = startOfLocalDay(endDay);
  const buckets: DailyBucket[] = [];
  const index = new Map<string, DailyBucket>();

  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(end, -i);
    const bucket: DailyBucket = {
      iso: localISODate(day),
      date: day,
      seconds: 0,
    };
    buckets.push(bucket);
    index.set(bucket.iso, bucket);
  }

  for (const session of sessions) {
    const ended = new Date(session.ended_at);
    const iso = localISODate(ended);
    const bucket = index.get(iso);
    if (bucket) bucket.seconds += session.duration_seconds;
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Streak math
// ---------------------------------------------------------------------------

/**
 * Returns the set of distinct local-TZ dates the user was active on.
 * "Active" means there is at least one session with `duration_seconds > 0`
 * that ended on that day.
 */
export function activeDateSet(sessions: readonly ReadingSessionDTO[]): Set<string> {
  const dates = new Set<string>();
  for (const session of sessions) {
    if (session.duration_seconds <= 0) continue;
    const ended = new Date(session.ended_at);
    dates.add(localISODate(ended));
  }
  return dates;
}

/**
 * Current streak length, ending today or yesterday.
 *
 * We allow the streak to "stand" if the user has not yet read today,
 * counting back from yesterday — otherwise the displayed streak would
 * silently drop to 0 in the morning before the first session, which is
 * jarring. It only breaks once a full day has gone by without activity.
 */
export function currentStreak(active: Set<string>, today: Date = new Date()): number {
  const start = startOfLocalDay(today);
  const todayISO = localISODate(start);

  let cursor = active.has(todayISO) ? start : addDays(start, -1);
  let length = 0;
  while (active.has(localISODate(cursor))) {
    length += 1;
    cursor = addDays(cursor, -1);
  }
  return length;
}

/** Longest consecutive run of active days observed across the dataset. */
export function bestStreak(active: Set<string>): number {
  if (active.size === 0) return 0;

  // Sort dates ascending and walk linearly, resetting on gaps > 1 day.
  const dates = [...active]
    .map((iso) => new Date(iso))
    .sort((a, b) => a.getTime() - b.getTime());

  let best = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = dates[i - 1];
    const curr = dates[i];
    const diff =
      (startOfLocalDay(curr).getTime() - startOfLocalDay(prev).getTime()) /
      (24 * 60 * 60 * 1000);
    if (Math.round(diff) === 1) {
      run += 1;
      if (run > best) best = run;
    } else if (Math.round(diff) > 1) {
      run = 1;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type Goals = {
  /** Daily goal in minutes. */
  dailyMinutes: number;
  /** Weekly goal in days completed. */
  weeklyDays: number;
};

const STORAGE_KEY_GOALS = "focushub:analytics:goals";

export const DEFAULT_GOALS: Goals = {
  dailyMinutes: 20,
  weeklyDays: 5,
};

export function readGoals(): Goals {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_GOALS);
    if (!raw) return DEFAULT_GOALS;
    const parsed = JSON.parse(raw) as Partial<Goals>;
    return {
      dailyMinutes:
        typeof parsed.dailyMinutes === "number" &&
        parsed.dailyMinutes > 0 &&
        parsed.dailyMinutes <= 600
          ? parsed.dailyMinutes
          : DEFAULT_GOALS.dailyMinutes,
      weeklyDays:
        typeof parsed.weeklyDays === "number" &&
        parsed.weeklyDays >= 1 &&
        parsed.weeklyDays <= 7
          ? parsed.weeklyDays
          : DEFAULT_GOALS.weeklyDays,
    };
  } catch {
    return DEFAULT_GOALS;
  }
}

export function writeGoals(goals: Goals): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_GOALS, JSON.stringify(goals));
  } catch {
    // ignore quota
  }
}
