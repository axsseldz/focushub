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
// Interruption muting
//
// While focus mode is active we shut down every browser-level surface that
// can plausibly interrupt the user's reading:
//
//   1. `new Notification(...)`               (page-level Web Notifications)
//   2. `ServiceWorkerRegistration.showNotification(...)` (SW-driven push)
//   3. Already-visible notifications from this origin (closed via SW)
//   4. `<audio>` / `<video>` playing on this page (paused + muted)
//   5. `alert` / `confirm` / `prompt` (no-op'd; can't be auto-dismissed)
//   6. `document.title` (pinned so tab-badge "(3) New" tricks can't fire)
//
// Every override stores a restorer so we put everything back exactly when
// focus mode exits. Restorers run in reverse order to be safe.
// ---------------------------------------------------------------------------

type WindowWithNotification = Window & {
  Notification?: typeof Notification & {
    requestPermission?: (
      cb?: NotificationPermissionCallback,
    ) => Promise<NotificationPermission>;
  };
};

function muteAllInterruptions(): () => void {
  if (typeof window === "undefined") return () => {};

  const restorers: Array<() => void> = [];
  let cancelled = false;

  // (1) Stub the Notification constructor + permission surface ------------
  const w = window as WindowWithNotification;
  const originalNotification = w.Notification;
  if (originalNotification) {
    const Stub = function () {
      return {
        close: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as unknown as Notification;
    } as unknown as typeof Notification;

    Object.defineProperty(Stub, "permission", {
      configurable: true,
      get: () => "denied" as NotificationPermission,
    });
    (Stub as typeof Notification).requestPermission = async () =>
      "denied" as NotificationPermission;

    try {
      w.Notification = Stub;
      restorers.push(() => {
        try {
          w.Notification = originalNotification;
        } catch {
          /* property frozen — nothing to do */
        }
      });
    } catch {
      // Some browsers refuse to redefine; we just skip and rely on the
      // other layers.
    }
  }

  // (2) + (3) Service worker — close already-visible notifications and
  //          stub `showNotification` on every registration. Both are
  //          async so we gate on `cancelled` in case focus is disabled
  //          before the promises resolve.
  if (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  ) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        if (cancelled) return;
        regs.forEach((reg) => {
          // Close pending notifications immediately.
          reg
            .getNotifications?.()
            .then((list) => {
              list.forEach((n) => {
                try {
                  n.close();
                } catch {
                  /* ignore */
                }
              });
            })
            .catch(() => {});

          // Stub `showNotification` for the lifetime of focus.
          const original = reg.showNotification.bind(reg);
          try {
            reg.showNotification = async () => {};
            restorers.push(() => {
              try {
                reg.showNotification = original;
              } catch {
                /* ignore */
              }
            });
          } catch {
            /* ignore */
          }
        });
      })
      .catch(() => {});
  }

  // (4) Pause + mute every media element. We capture the prior state so
  //     focus exit restores it (don't leave the user's podcast paused
  //     forever).
  const mediaEls = Array.from(
    document.querySelectorAll<HTMLMediaElement>("audio, video"),
  );
  if (mediaEls.length > 0) {
    const prior = mediaEls.map((el) => ({
      el,
      wasMuted: el.muted,
      wasPaused: el.paused,
    }));
    prior.forEach(({ el }) => {
      try {
        el.muted = true;
        el.pause();
      } catch {
        /* ignore */
      }
    });
    restorers.push(() => {
      prior.forEach(({ el, wasMuted, wasPaused }) => {
        try {
          el.muted = wasMuted;
          if (!wasPaused) {
            void el.play().catch(() => {});
          }
        } catch {
          /* ignore */
        }
      });
    });
  }

  // (5) Block JS modal dialogs. They yield-block the page and shouldn't
  //     fire during a focus block. Return the spec-defined "dismissed"
  //     answer so calling code keeps walking gracefully.
  const origAlert = window.alert;
  const origConfirm = window.confirm;
  const origPrompt = window.prompt;
  window.alert = () => {};
  window.confirm = () => false;
  window.prompt = () => null;
  restorers.push(() => {
    window.alert = origAlert;
    window.confirm = origConfirm;
    window.prompt = origPrompt;
  });

  // (6) Pin document.title against tab-badge style updates from any
  //     other script on the page. The override sits on the *instance*,
  //     so deleting it restores access to Document.prototype's accessor.
  const originalTitle = document.title;
  try {
    Object.defineProperty(document, "title", {
      configurable: true,
      get: () => originalTitle,
      set: () => {
        /* swallow */
      },
    });
    restorers.push(() => {
      try {
        // Remove the instance-level shadowing descriptor so the
        // prototype's accessor is used again. Cast via `unknown` because
        // strict TS rejects `delete` on a required property.
        delete (document as unknown as { title?: string }).title;
        document.title = originalTitle;
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* Some hosts forbid redefining document.title; not the end of the world. */
  }

  return () => {
    cancelled = true;
    // Run restorers in reverse order so the most-recently-applied
    // override is the first to come back off.
    for (let i = restorers.length - 1; i >= 0; i--) {
      try {
        restorers[i]();
      } catch {
        /* ignore */
      }
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

  // Mute every interruption surface while focus is active. The setup is
  // gated *strictly* on `enabled` — nothing is patched outside a focus
  // session, so the rest of the app behaves normally.
  useEffect(() => {
    if (!enabled) return;
    const restore = muteAllInterruptions();
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
