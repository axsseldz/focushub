"use client";

import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum gap (ms) between consecutive page-turn triggers. */
const DEBOUNCE_MS = 1000;

/**
 * Delay (ms) before creating a new recognition session after the previous one
 * ends. Prevents the InvalidStateError that Chrome throws when start() is
 * called synchronously inside onend.
 */
const RESTART_DELAY_MS = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SR extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SREvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SRErrorEvent extends Event {
  error: string;
}

type SRConstructor = new () => SR;
type VoiceStatus = "idle" | "listening" | "unsupported";

export interface VoiceCommandsProps {
  enabled: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSRConstructor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w["SpeechRecognition"] as SRConstructor | undefined) ??
    (w["webkitSpeechRecognition"] as SRConstructor | undefined) ??
    null
  );
}

/**
 * Maps a raw transcript to a navigation command.
 * Strips accents so both "siguiente" and "síguiente" (mis-accented) match.
 */
function classify(raw: string): "next" | "prev" | null {
  const t = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (t.includes("siguiente")) return "next";
  if (t.includes("anterior")) return "prev";
  return null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceCommands({
  enabled,
  onNextPage,
  onPrevPage,
}: VoiceCommandsProps) {
  const onNextRef = useRef(onNextPage);
  const onPrevRef = useRef(onPrevPage);

  useEffect(() => {
    onNextRef.current = onNextPage;
    onPrevRef.current = onPrevPage;
  });

  const lastTriggerRef = useRef<number>(0);
  // Track only whether the browser denied mic access — the rest is derived.
  const [srUnsupported, setSrUnsupported] = useState(
    () => typeof window !== "undefined" && !getSRConstructor()
  );

  // Derive display status without storing transient "listening"/"idle" in state.
  const status: VoiceStatus = !enabled ? "idle" : srUnsupported ? "unsupported" : "listening";

  useEffect(() => {
    if (!enabled || srUnsupported) return;

    const SpeechRecognition = getSRConstructor()!;

    // `active` is the single source of truth for whether we should keep
    // listening. Setting it to false in cleanup stops the restart loop.
    let active = true;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let current: SR | null = null;

    function startSession() {
      if (!active) return;

      const recognition = new SpeechRecognition();
      // Use continuous: false — Chrome handles it more reliably this way.
      // We restart manually in onend instead of relying on continuous mode.
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "es-ES";
      recognition.maxAlternatives = 5;

      recognition.onresult = (event: SREvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result.isFinal) continue;

          const now = Date.now();
          if (now - lastTriggerRef.current < DEBOUNCE_MS) continue;

          // Check every alternative the browser returns.
          for (let a = 0; a < result.length; a++) {
            const cmd = classify(result[a].transcript);
            if (cmd === "next") {
              lastTriggerRef.current = now;
              onNextRef.current();
              break;
            }
            if (cmd === "prev") {
              lastTriggerRef.current = now;
              onPrevRef.current();
              break;
            }
          }
        }
      };

      recognition.onerror = (event: SRErrorEvent) => {
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          active = false;
          setSrUnsupported(true);
        }
        // For transient errors (no-speech, network, audio-capture) we let
        // onend fire naturally and schedule a restart there.
      };

      recognition.onend = () => {
        if (!active) return;
        // Wait a beat before creating the next session to avoid the
        // InvalidStateError Chrome throws on synchronous restart.
        restartTimer = setTimeout(startSession, RESTART_DELAY_MS);
      };

      current = recognition;
      try {
        recognition.start();
      } catch {
        // start() failed (e.g. another instance still running) — retry.
        restartTimer = setTimeout(startSession, RESTART_DELAY_MS * 2);
      }
    }

    startSession();

    return () => {
      active = false;
      if (restartTimer !== null) clearTimeout(restartTimer);
      current?.abort();
    };
  }, [enabled, srUnsupported]);

  if (!enabled || status === "idle") return null;

  if (status === "unsupported") {
    return (
      <div className="fixed bottom-6 left-6 z-50 overflow-hidden rounded-2xl border border-red-100 bg-red-50 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:border-red-900 dark:bg-red-950/50">
        <div className="flex items-center gap-2">
          <MicOffIcon />
          <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
            Micrófono no disponible
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 overflow-hidden rounded-2xl border border-violet-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.10)] dark:border-violet-800/50 dark:bg-zinc-900">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
        </span>
        <MicIcon />
        <span className="text-[11px] font-medium text-violet-700 dark:text-violet-400">Voz activa</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function MicIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 text-violet-500"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M19 10a7 7 0 0 1-14 0M12 19v3M9 22h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 text-red-400"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M3 3l18 18M9 9v2a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 10M19 10a7 7 0 0 1-.34 2.18M12 19v3M9 22h6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
