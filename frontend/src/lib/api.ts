"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useMemo } from "react";

/**
 * Backend URL. Defaults to the local dev server.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

/**
 * Hook returning a `fetch` wrapper that automatically attaches the current
 * Clerk user ID via the `X-User-Id` header. The backend uses that header to
 * scope every query to the authenticated user.
 *
 * Usage:
 *   const api = useAuthedFetch();
 *   const res = await api(`${API_BASE_URL}/files`);
 */
export function useAuthedFetch() {
  const { userId, isLoaded } = useAuth();

  return useCallback(
    async (input: string, init?: RequestInit): Promise<Response> => {
      if (!isLoaded) {
        // Caller should gate on `isLoaded` from useAuth before invoking. As a
        // defence in depth we throw instead of silently issuing an
        // unauthenticated request that the backend would 401.
        throw new Error("Auth not ready yet.");
      }
      if (!userId) {
        throw new Error("No authenticated user.");
      }
      const headers = new Headers(init?.headers);
      headers.set("X-User-Id", userId);
      return fetch(input, { ...init, headers });
    },
    [isLoaded, userId],
  );
}

/**
 * Returns the current Clerk user ID, or `null` while auth is still loading
 * (or if the user is signed out). Components should render skeletons / null
 * until this resolves.
 */
export function useCurrentUserId(): string | null {
  const { userId, isLoaded } = useAuth();
  return useMemo(() => (isLoaded ? (userId ?? null) : null), [isLoaded, userId]);
}
