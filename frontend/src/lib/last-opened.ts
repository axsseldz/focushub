"use client";

/**
 * Tracks when each book was last opened by the current user so the
 * library can show the most recently used books first. Persisted in
 * localStorage, namespaced per Clerk user ID so two accounts on the
 * same browser don't share recency state.
 */

import type { Book } from "@/types/book";

const STORAGE_KEY = "focushub:lastOpened";

type LastOpenedMap = Record<string, number>;

function keyFor(userId: string | null | undefined): string {
  return userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY;
}

function read(userId: string | null | undefined): LastOpenedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as LastOpenedMap)
      : {};
  } catch {
    return {};
  }
}

function write(userId: string | null | undefined, map: LastOpenedMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

/** Stamp the current time against this book. Returns the updated map. */
export function markBookOpened(
  userId: string | null | undefined,
  bookId: string,
): LastOpenedMap {
  const map = read(userId);
  map[bookId] = Date.now();
  write(userId, map);
  return map;
}

/**
 * Sort books with the most-recently-opened first. Books that have never
 * been opened fall to the end, ordered by upload date (newest upload
 * first) so newly-added books are still discoverable.
 */
export function sortBooksByLastOpened(
  books: Book[],
  userId: string | null | undefined,
): Book[] {
  const map = read(userId);
  return [...books].sort((a, b) => {
    const aOpened = map[a.id] ?? 0;
    const bOpened = map[b.id] ?? 0;
    if (aOpened !== bOpened) return bOpened - aOpened;
    return (
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  });
}
