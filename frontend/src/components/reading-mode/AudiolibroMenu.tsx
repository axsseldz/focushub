"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import { HeaderPopover } from "@/components/reading-mode/HeaderPopover";
import type {
  NarratorStatus,
  NarratorVoice,
} from "@/lib/audio-narrator";

// ---------------------------------------------------------------------------
// Pulse — barras reactivas que acompañan al estado activo
// ---------------------------------------------------------------------------

const PULSE_BARS = 4;

function VoicePulse({ active }: { active: boolean }) {
  return (
    <div className="flex h-3 items-center gap-[2px]" aria-hidden="true">
      {Array.from({ length: PULSE_BARS }).map((_, idx) => (
        <motion.span
          key={idx}
          className="w-[2px] rounded-full bg-current"
          initial={{ height: 4 }}
          animate={active ? { height: [4, 10, 6, 12, 4] } : { height: 4 }}
          transition={{
            duration: 0.85 + (idx % 3) * 0.12,
            repeat: active ? Infinity : 0,
            ease: "easeInOut",
            delay: idx * 0.07,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice card — selección minimal en grid de dos columnas
// ---------------------------------------------------------------------------

type VoiceMeta = { id: NarratorVoice; name: string; gender: string };

const VOICES: VoiceMeta[] = [
  { id: "rous", name: "Rous", gender: "Femenina" },
  { id: "diego", name: "Diego", gender: "Masculina" },
];

function VoiceCard({
  voice,
  selected,
  disabled,
  onSelect,
}: {
  voice: VoiceMeta;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border px-3 py-3 transition-all ${
        selected
          ? "border-slate-900 bg-slate-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-slate-200 bg-transparent text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/60"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className="text-sm font-semibold tracking-[-0.02em]">
        {voice.name}
      </span>
      <span
        className={`text-[0.62rem] font-medium uppercase tracking-[0.18em] ${
          selected
            ? "text-white/65 dark:text-zinc-900/55"
            : "text-slate-500 dark:text-zinc-500"
        }`}
      >
        {voice.gender}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Menu principal
// ---------------------------------------------------------------------------

type AudiolibroMenuProps = {
  status: NarratorStatus;
  voice: NarratorVoice;
  onVoiceChange: (next: NarratorVoice) => void;
  onPlay: () => void;
  onStop: () => void;
  error: string | null;
  /** Indica si hay texto extraído disponible para narrar. */
  hasContent: boolean;
  /** Variante de estilo para focus mode (glass oscuro). */
  compact?: boolean;
  /** Modo "narración continua" — el usuario apretó play y queremos
   *  que el botón siga viéndose activo durante el cambio de página
   *  aunque el hook esté momentáneamente idle entre páginas. */
  autoPlay?: boolean;
};

export function AudiolibroMenu({
  status,
  voice,
  onVoiceChange,
  onPlay,
  onStop,
  error,
  hasContent,
  compact = false,
  autoPlay = false,
}: AudiolibroMenuProps) {
  const [open, setOpen] = useState(false);
  // isActive cubre tres situaciones: reproduciendo, cargando, o
  // entre páginas (autoPlay sigue prendido pero el hook está
  // momentáneamente idle mientras extraemos la siguiente).
  const isActive = status === "playing" || status === "loading" || autoPlay;
  const triggerLabel = (() => {
    if (status === "loading") return "Cargando";
    if (status === "playing") return "Reproduciendo";
    if (autoPlay) return "Reproduciendo";
    return "Audiolibro";
  })();
  const showPulse = status === "playing" || (autoPlay && status !== "loading");

  const close = useCallback(() => setOpen(false), []);

  const handleVoiceChange = useCallback(
    (next: NarratorVoice) => {
      if (isActive) return;
      onVoiceChange(next);
    },
    [isActive, onVoiceChange],
  );

  const handlePrimary = useCallback(() => {
    if (isActive) onStop();
    else onPlay();
  }, [isActive, onPlay, onStop]);

  return (
    <HeaderPopover
      open={open}
      onClose={close}
      align="right"
      width={300}
      compact={compact}
      trigger={
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-[-0.01em] transition-all ${
            isActive
              ? compact
                ? "border-emerald-300/70 bg-emerald-500/15 text-emerald-200 shadow-[0_4px_14px_rgba(16,185,129,0.22)]"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_4px_14px_rgba(16,185,129,0.18)] dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300"
              : compact
                ? "border-white/20 bg-white/10 text-white/95 backdrop-blur hover:bg-white/20"
                : "border-slate-900 bg-slate-900 text-white shadow-[0_6px_16px_rgba(15,23,42,0.18)] hover:-translate-y-[1px] hover:shadow-[0_10px_22px_rgba(15,23,42,0.22)] dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          }`}
        >
          {isActive ? (
            <>
              <VoicePulse active={showPulse} />
              {triggerLabel}
            </>
          ) : (
            <>
              <HeadphonesIcon />
              Audiolibro
            </>
          )}
          <ChevronIcon open={open} />
        </button>
      }
    >
      <div className="px-4 py-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
          Audiolibro
        </p>
        <p className="mt-0.5 text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-zinc-100">
          Escuchar esta página
        </p>

        <div
          role="radiogroup"
          aria-label="Voz"
          className="mt-4 grid grid-cols-2 gap-2"
        >
          {VOICES.map((meta) => (
            <VoiceCard
              key={meta.id}
              voice={meta}
              selected={voice === meta.id}
              disabled={isActive}
              onSelect={() => handleVoiceChange(meta.id)}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[0.72rem] leading-5 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={handlePrimary}
          disabled={!hasContent && !isActive}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
            isActive
              ? "bg-red-500 text-white hover:bg-red-600"
              : "bg-slate-900 text-white hover:-translate-y-[1px] hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          } ${!hasContent && !isActive ? "cursor-not-allowed opacity-50" : ""}`}
        >
          {isActive ? (
            <>
              <StopIcon />
              Detener narración
            </>
          ) : (
            <>
              <PlayIcon />
              Iniciar narración
            </>
          )}
        </button>

        {!hasContent && !isActive && (
          <p className="mt-2 text-center text-[0.7rem] text-slate-500 dark:text-zinc-500">
            No se detectó texto narrable en esta página.
          </p>
        )}
      </div>
    </HeaderPopover>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function HeadphonesIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 13.5V12a7 7 0 1 1 14 0v1.5M5 13.5v3.25A2.25 2.25 0 0 0 7.25 19h.5A1.25 1.25 0 0 0 9 17.75v-2.5A1.25 1.25 0 0 0 7.75 14h-2.75ZM19 13.5v3.25A2.25 2.25 0 0 1 16.75 19h-.5A1.25 1.25 0 0 1 15 17.75v-2.5A1.25 1.25 0 0 1 16.25 14H19Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5.5v13a.75.75 0 0 0 1.18.62l9.75-6.5a.75.75 0 0 0 0-1.24l-9.75-6.5A.75.75 0 0 0 8 5.5Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="1.6" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m6 9.5 6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
