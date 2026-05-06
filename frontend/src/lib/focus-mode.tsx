"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FocusModeContextValue {
  enabled: boolean;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  /**
   * True while focus mode is active. Components that emit toasts, alerts or
   * other transient UI should treat this as "stay quiet".
   */
  notificationsMuted: boolean;
}

// ---------------------------------------------------------------------------
// Storage helpers + tiny external store
//
// Persistence lives outside React so we can read it via useSyncExternalStore
// (and avoid the "setState in effect" hydration dance the linter flags).
// ---------------------------------------------------------------------------

const STORAGE_KEY_ENABLED = "focushub:focus:enabled";

type FocusStoreState = { enabled: boolean };

const SERVER_SNAPSHOT: FocusStoreState = { enabled: false };

const focusStore = (() => {
  const listeners = new Set<() => void>();
  let snapshot: FocusStoreState = SERVER_SNAPSHOT;

  const load = (): FocusStoreState => {
    if (typeof window === "undefined") return SERVER_SNAPSHOT;
    try {
      return {
        enabled: window.localStorage.getItem(STORAGE_KEY_ENABLED) === "1",
      };
    } catch {
      return SERVER_SNAPSHOT;
    }
  };

  // Hydrate the snapshot once on the client so the very first
  // useSyncExternalStore read returns persisted values.
  if (typeof window !== "undefined") {
    snapshot = load();
  }

  const set = (next: Partial<FocusStoreState>) => {
    const merged = { ...snapshot, ...next };
    if (merged.enabled === snapshot.enabled) return;
    snapshot = merged;
    try {
      window.localStorage.setItem(
        STORAGE_KEY_ENABLED,
        merged.enabled ? "1" : "0",
      );
    } catch {
      // Quota / private mode — ignore, in-memory state still updates.
    }
    listeners.forEach((l) => l());
  };

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: (): FocusStoreState => snapshot,
    getServerSnapshot: (): FocusStoreState => SERVER_SNAPSHOT,
    set,
  };
})();

// ---------------------------------------------------------------------------
// Notification API neutering
//
// While focus mode is active we silently swallow `new Notification(...)` and
// reject permission requests. The original constructor is restored on cleanup
// so other parts of the app keep working when focus is off.
// ---------------------------------------------------------------------------

type WindowWithNotification = Window & {
  Notification?: typeof Notification & {
    requestPermission?: (
      cb?: NotificationPermissionCallback,
    ) => Promise<NotificationPermission>;
  };
};

function muteBrowserNotifications(): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as WindowWithNotification;
  const original = w.Notification;
  if (!original) return () => {};

  const Stub = function () {
    return {
      close: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as Notification;
  } as unknown as typeof Notification;

  // Preserve the static surface so callers checking `Notification.permission`
  // see a consistent "denied" while focus mode owns the screen.
  Object.defineProperty(Stub, "permission", {
    configurable: true,
    get: () => "denied" as NotificationPermission,
  });
  (Stub as typeof Notification).requestPermission = async () =>
    "denied" as NotificationPermission;

  try {
    w.Notification = Stub;
  } catch {
    // Some browsers freeze the property; nothing to do.
  }

  return () => {
    try {
      w.Notification = original;
    } catch {
      // Best-effort restore.
    }
  };
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FocusModeContext = createContext<FocusModeContextValue>({
  enabled: false,
  enable: () => {},
  disable: () => {},
  toggle: () => {},
  notificationsMuted: false,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function FocusModeProvider({ children }: { children: ReactNode }) {
  const { enabled } = useSyncExternalStore(
    focusStore.subscribe,
    focusStore.getSnapshot,
    focusStore.getServerSnapshot,
  );

  // Mute browser notifications while focus is active.
  useEffect(() => {
    if (!enabled) return;
    const restore = muteBrowserNotifications();
    return restore;
  }, [enabled]);

  const enable = useCallback(() => focusStore.set({ enabled: true }), []);
  const disable = useCallback(() => focusStore.set({ enabled: false }), []);
  const toggle = useCallback(
    () => focusStore.set({ enabled: !focusStore.getSnapshot().enabled }),
    [],
  );

  const value = useMemo<FocusModeContextValue>(
    () => ({
      enabled,
      enable,
      disable,
      toggle,
      notificationsMuted: enabled,
    }),
    [enabled, enable, disable, toggle],
  );

  return (
    <FocusModeContext.Provider value={value}>
      {children}
    </FocusModeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFocusMode() {
  return useContext(FocusModeContext);
}
