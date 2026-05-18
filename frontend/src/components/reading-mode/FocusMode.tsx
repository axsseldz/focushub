"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { useFocusMode } from "@/lib/focus-mode";

/**
 * Solicita fullscreen sobre <html> cuando `enabled` pasa a true y lo
 * libera al apagarse. Si el usuario abandona fullscreen por su
 * cuenta (Escape, etc.) llamamos a `onExit` para sincronizar.
 */
function useFullscreen(enabled: boolean, onExit: () => void) {
  useEffect(() => {
    if (!enabled) return;

    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        // El usuario o el navegador rechazaron fullscreen — focus
        // sigue funcionando, sin el wash a pantalla completa.
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
 * Mantiene un wake lock de pantalla mientras `enabled` es true para
 * que el monitor no se atenúe durante una sesión de foco profundo.
 * Re-adquiere el lock al volver de un background.
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
        // Algunos navegadores rechazan si la pestaña no está visible.
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
 * FocusMode
 *
 * Wash translúcido + fullscreen + wake lock para sesiones de
 * concentración. La salida y los toggles (audiolibro, ajustes) son
 * accesibles desde el header — el chrome flotante de versiones
 * anteriores fue retirado para reducir ruido visual.
 */
export function FocusMode() {
  const { enabled, disable } = useFocusMode();

  useFullscreen(enabled, disable);
  useWakeLock(enabled);

  return (
    <AnimatePresence>
      {enabled && (
        <motion.div
          key="focus-wash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 0.61, 0.36, 1] }}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[40] bg-[radial-gradient(ellipse_at_center,_rgba(20,22,28,0.28)_0%,_rgba(5,6,9,0.7)_100%)]"
        />
      )}
    </AnimatePresence>
  );
}
