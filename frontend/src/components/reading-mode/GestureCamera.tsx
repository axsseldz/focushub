"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/**
 * How long (ms) the user must hold a gesture before it triggers.
 * Prevents accidental triggers from momentary finger positions.
 */
const HOLD_MS = 600;

/**
 * Minimum gap (ms) between consecutive page-turn triggers.
 * Backup safety net — in practice the wait-for-zero logic handles this.
 */
const DEBOUNCE_MS = 800;

/**
 * Margin subtracted from the PIP landmark before comparing to the tip.
 * A finger is "extended" when: tip.y < pip.y − CURL_MARGIN
 *
 * Higher values (e.g. 0.05) → only clearly upright fingers count.
 * Lower values  (e.g. 0.00) → slightly bent fingers also count.
 */
const CURL_MARGIN = 0.02;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Status = "idle" | "loading" | "active" | "error";

export interface GestureCameraProps {
  enabled: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Counts the number of clearly extended fingers among the four non-thumb
 * fingers (index, middle, ring, pinky).
 *
 * Coordinate system (MediaPipe VIDEO mode):
 *   y = 0  →  top of camera frame
 *   y = 1  →  bottom of camera frame
 *
 * A finger is extended when its tip is ABOVE its PIP joint, i.e.:
 *   tip.y < pip.y − CURL_MARGIN
 *
 * The thumb is excluded because its extension axis is horizontal and
 * its detection is unreliable without knowing hand orientation.
 *
 * Landmark indices:
 *   Index:  tip=8,  pip=6
 *   Middle: tip=12, pip=10
 *   Ring:   tip=16, pip=14
 *   Pinky:  tip=20, pip=18
 */
function countExtendedFingers(
  landmarks: ReadonlyArray<{ x: number; y: number; z: number }>,
): number {
  const pairs: [number, number][] = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  return pairs.filter(
    ([tip, pip]) => landmarks[tip].y < landmarks[pip].y - CURL_MARGIN,
  ).length;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * GestureCamera
 *
 * Renders a small webcam overlay that drives PDF page navigation via hand
 * gestures detected through MediaPipe HandLandmarker.
 *
 * Gesture logic
 * -------------
 * The component counts how many fingers are clearly extended each frame.
 * Thumb is excluded for reliability; only index, middle, ring and pinky.
 *
 *   1 finger held for HOLD_MS  →  onNextPage()   (next page)
 *   2 fingers held for HOLD_MS →  onPrevPage()   (previous page)
 *
 * After a trigger the component waits for the hand to fully close (0 fingers)
 * before allowing the next gesture. This makes each page turn an intentional,
 * discrete action.
 *
 * Visual feedback
 * ---------------
 * A thin progress bar at the bottom of the overlay fills up during the hold
 * period. DOM updates are direct (not React state) so the rAF loop does not
 * cause re-renders.
 *
 * Cleanup
 * -------
 * When `enabled` becomes false (or the component unmounts), the webcam stream
 * is stopped, the rAF loop is cancelled, and the HandLandmarker is closed.
 */
export function GestureCamera({ enabled, onNextPage, onPrevPage }: GestureCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // MediaPipe + camera lifecycle refs
  const landmarkerRef =
    useRef<import("@mediapipe/tasks-vision").HandLandmarker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  // Gesture state refs — mutated in the rAF loop, never trigger re-renders
  const stableCountRef = useRef<number>(0);    // current stable finger count
  const stableStartRef = useRef<number>(0);    // when the current count began
  const waitResetRef = useRef<boolean>(false); // true after a trigger; waits for fist
  const lastTriggerRef = useRef<number>(0);    // timestamp of last fired trigger

  // Direct-DOM refs for the gesture indicator (bypasses React render cycle)
  const indicatorWrapRef = useRef<HTMLDivElement>(null);
  const indicatorTextRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Stable callback refs — always current without re-running the main effect
  const onNextRef = useRef(onNextPage);
  const onPrevRef = useRef(onPrevPage);
  onNextRef.current = onNextPage;
  onPrevRef.current = onPrevPage;

  const [status, setStatus] = useState<Status>("idle");
  const [videoHidden, setVideoHidden] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  // Reset the guide every time gestures are re-enabled
  useEffect(() => {
    if (enabled) setShowGuide(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const stop = () => {
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      // Reset gesture state for a clean next session
      stableCountRef.current = 0;
      stableStartRef.current = 0;
      waitResetRef.current = false;
    };

    const start = async () => {
      setStatus("loading");

      try {
        const { HandLandmarker, FilesetResolver } = await import(
          "@mediapipe/tasks-vision"
        );
        if (cancelled) return;

        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        if (cancelled) return;

        let landmarker: import("@mediapipe/tasks-vision").HandLandmarker;
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
            runningMode: "VIDEO",
            numHands: 1,
          });
        } catch {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
            runningMode: "VIDEO",
            numHands: 1,
          });
        }
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        await new Promise<void>((resolve, reject) => {
          video.oncanplay = () => resolve();
          video.onerror = () => reject(new Error("Error al iniciar el video."));
        });
        await video.play();
        if (cancelled) return;

        setStatus("active");

        // ------------------------------------------------------------------
        // rAF detection loop
        // ------------------------------------------------------------------
        const detect = () => {
          const lm = landmarkerRef.current;
          const vid = videoRef.current;

          if (!lm || !vid || vid.readyState < 2) {
            rafRef.current = requestAnimationFrame(detect);
            return;
          }

          const now = performance.now();
          const { landmarks } = lm.detectForVideo(vid, now);
          const hand = landmarks[0];
          const count = hand ? countExtendedFingers(hand) : 0;

          // ---- Stable count tracking ------------------------------------
          // If the finger count changed, reset the stability timer.
          if (count !== stableCountRef.current) {
            stableCountRef.current = count;
            stableStartRef.current = now;
          }

          // ---- Wait-for-zero reset -------------------------------------
          // After a trigger, require the hand to fully close before the
          // next gesture can be recognised.
          if (waitResetRef.current && count === 0) {
            waitResetRef.current = false;
          }

          // ---- Trigger logic -------------------------------------------
          if (
            !waitResetRef.current &&
            (count === 1 || count === 2) &&
            now - stableStartRef.current >= HOLD_MS &&
            now - lastTriggerRef.current >= DEBOUNCE_MS
          ) {
            lastTriggerRef.current = now;
            waitResetRef.current = true;

            if (count === 1) {
              onNextRef.current();
            } else {
              onPrevRef.current();
            }
          }

          // ---- Direct DOM: gesture indicator ---------------------------
          const wrap = indicatorWrapRef.current;
          const text = indicatorTextRef.current;
          const bar = progressBarRef.current;

          if (wrap && text && bar) {
            const showIndicator =
              !waitResetRef.current && (count === 1 || count === 2);

            if (showIndicator) {
              const elapsed = now - stableStartRef.current;
              const progress = Math.min((elapsed / HOLD_MS) * 100, 100);

              wrap.style.display = "block";
              text.textContent =
                count === 1 ? "1 dedo · siguiente →" : "← anterior · 2 dedos";
              bar.style.width = `${progress}%`;
            } else {
              wrap.style.display = "none";
              bar.style.width = "0%";
            }
          }

          rafRef.current = requestAnimationFrame(detect);
        };

        rafRef.current = requestAnimationFrame(detect);
      } catch (err) {
        if (!cancelled) {
          console.error("[GestureCamera]", err);
          setStatus("error");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
      setStatus("idle");
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* -------- Gesture guide card ------------------------------------
          Shown whenever gestures are (re)activated, right above the
          camera overlay. The card directly answers the question "¿qué
          puedo hacer con la mano?" so the user does not discover the
          gestures by trial and error. */}
      {status === "active" && showGuide && (
        <div
          role="dialog"
          aria-label="Guía de gestos"
          className="w-72 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
              Cómo usar los gestos
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="Cerrar guía"
              className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            >
              <CloseIcon />
            </button>
          </div>
          <ul className="space-y-2 text-sm text-slate-700 dark:text-zinc-200">
            <li className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-base dark:bg-emerald-900/30">
                ☝️
              </span>
              <span>
                <strong className="font-semibold">1 dedo</strong> · siguiente página
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-base dark:bg-emerald-900/30">
                ✌️
              </span>
              <span>
                <strong className="font-semibold">2 dedos</strong> · página anterior
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-base dark:bg-zinc-800">
                ⏱
              </span>
              <span className="text-slate-500 dark:text-zinc-400">
                Mantén el gesto quieto <strong>~0.6 s</strong>
              </span>
            </li>
          </ul>
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="mt-3 w-full rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Entendido
          </button>
        </div>
      )}

      {/* -------- Camera overlay --------------------------------------
          The overlay width is driven by the header (flex row), and the
          video below uses `w-full` so it always matches. This avoids
          the blank space that appeared when the header was wider than
          a fixed-size video. */}
      <div
        role="region"
        aria-label="Vista de cámara para lectura inteligente"
        className="w-72 max-w-[min(22rem,90vw)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-900"
      >
        {/* Header bar — always visible when active. The hide/show button
            lives here (outside the video) with a clear text label so it
            is easy to find. */}
        {status === "active" && (
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-800/80">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
              <span className="truncate text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                Gestos activos
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!showGuide && (
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  aria-label="Mostrar guía de gestos"
                  title="Ver guía de gestos"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                >
                  <QuestionIcon />
                </button>
              )}
              <button
                type="button"
                onClick={() => setVideoHidden((v) => !v)}
                aria-label={videoHidden ? "Mostrar cámara" : "Ocultar cámara"}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
              >
                {videoHidden ? <EyeIcon /> : <EyeOffIcon />}
                <span>{videoHidden ? "Mostrar" : "Ocultar"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-zinc-800">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600 dark:border-zinc-700 dark:border-t-zinc-300" />
            <span className="text-[11px] text-slate-400 dark:text-zinc-500">Cargando modelo…</span>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="flex h-40 w-full flex-col items-center justify-center gap-1.5 bg-red-50 px-3 text-center dark:bg-red-950/50">
            <CameraOffIcon />
            <span className="text-[11px] font-medium leading-tight text-red-600 dark:text-red-400">
              Sin acceso a cámara
            </span>
            <span className="text-[10px] leading-tight text-red-400 dark:text-red-500">
              Verifica los permisos del navegador
            </span>
          </div>
        )}

        {/* Live feed — always in DOM when active so the rAF loop keeps working;
            visually hidden via CSS when the user collapses the view. The
            width fills the overlay card so there is no empty space next to
            the video. */}
        <video
          ref={videoRef}
          className={`h-40 w-full object-cover [transform:scaleX(-1)] ${
            status === "active" && !videoHidden ? "block" : "hidden"
          }`}
          muted
          playsInline
        />

        {/* Gesture indicator — hidden/shown and updated by the rAF loop directly */}
        {status === "active" && (
          <div
            ref={indicatorWrapRef}
            className="hidden border-t border-slate-100 bg-white/95 dark:border-zinc-700 dark:bg-zinc-900/95"
          >
            <div className="px-2 py-1.5 text-center">
              <span
                ref={indicatorTextRef}
                className="text-[10px] font-medium tabular-nums text-slate-600 dark:text-zinc-300"
              />
            </div>
            {/* Progress bar */}
            <div className="h-[3px] w-full bg-slate-100 dark:bg-zinc-700">
              <div
                ref={progressBarRef}
                className="h-full bg-emerald-400"
                style={{ width: "0%", transition: "none" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function QuestionIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9.5 9.25a2.5 2.5 0 0 1 5 .25c0 1.75-2.5 2-2.5 3.5M12 17h.01"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CameraOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 text-red-400"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M3 3l18 18M10.5 6H17a2 2 0 0 1 2 2v8M6.76 6.76A2 2 0 0 0 5 8.5v7A2 2 0 0 0 7 17.5h7.24M15 12a3 3 0 0 1-3 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
      <path
        d="M3 3l18 18M10.58 10.58A3 3 0 0 0 13.42 13.42M7.36 7.36A9.77 9.77 0 0 0 3 12c1.73 4.39 6 7.5 9 7.5a9.3 9.3 0 0 0 4.64-1.36M10.5 6.06A9.77 9.77 0 0 1 12 6c3 0 7.27 3.11 9 7.5a9.9 9.9 0 0 1-1.5 2.64"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M3 12c1.73-4.39 6-7.5 9-7.5s7.27 3.11 9 7.5c-1.73 4.39-6 7.5-9 7.5S4.73 16.39 3 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
