"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CollapseToggleButton } from "@/components/workspace/WorkspaceAssets";
import type {
  WorkspaceMessage,
  WorkspaceMode,
  WorkspacePhase,
} from "@/types/workspace";

type Props = {
  messages: WorkspaceMessage[];
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  onSend: (text: string) => Promise<void>;
  onCancel: () => void;
  sending: boolean;
  // Live text streamed from the model while ``sending`` is true. For
  // Plan mode this is the actual reply being typed out; for Execute
  // mode this is the confirmation line emitted before the LaTeX body.
  streamingText: string | null;
  phase: WorkspacePhase | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

// ---------------------------------------------------------------------------
// Mode theming — every mode-aware UI element pulls from here so a single
// tweak propagates everywhere (avatar gradient, badge accent, input ring,
// starter prompts, etc.). Keeping the strings explicit (no class
// concatenation) so Tailwind's JIT picks them up.
// ---------------------------------------------------------------------------

type ModeTheme = {
  label: string;
  tagline: string;
  avatarFrom: string;
  avatarTo: string;
  accentSoft: string;
  accentBorder: string;
  accentText: string;
  ringFocus: string;
  badgeBg: string;
  badgeText: string;
  starters: { title: string; prompt: string; hint: string }[];
};

const MODE_THEME: Record<WorkspaceMode, ModeTheme> = {
  plan: {
    label: "Plan",
    tagline: "Lluvia de ideas, estructura y arquitectura del documento.",
    avatarFrom: "from-indigo-500",
    avatarTo: "to-violet-600",
    accentSoft: "bg-indigo-50 dark:bg-indigo-500/10",
    accentBorder: "border-indigo-200/70 dark:border-indigo-500/20",
    accentText: "text-indigo-700 dark:text-indigo-300",
    ringFocus: "focus-within:border-indigo-300 dark:focus-within:border-indigo-500/50",
    badgeBg: "bg-indigo-100/80 dark:bg-indigo-500/15",
    badgeText: "text-indigo-700 dark:text-indigo-300",
    starters: [
      {
        title: "Curso completo de Python",
        prompt:
          "Diseña la arquitectura de un curso completo de Python para principiantes con apuntes en LaTeX. Propón un temario detallado, secciones por capítulo y qué elementos visuales conviene incluir.",
        hint: "Temario + pedagogía",
      },
      {
        title: "Paper académico",
        prompt:
          "Estructura un paper académico sobre análisis de datos: portada, abstract, introducción, métodos, resultados, discusión. ¿Qué paquetes LaTeX recomiendas y por qué?",
        hint: "Estructura formal",
      },
      {
        title: "Apuntes profesionales",
        prompt:
          "Quiero apuntes de clase con un layout editorial moderno: cajas de definición, ejemplos resueltos, ejercicios y código con resaltado. Propón el diseño visual.",
        hint: "Layout editorial",
      },
      {
        title: "Reporte técnico",
        prompt:
          "Necesito un reporte técnico para un proyecto de ingeniería con portada institucional, índice, secciones de metodología y resultados con tablas y gráficas.",
        hint: "Reporte de ingeniería",
      },
    ],
  },
  execute: {
    label: "Execute",
    tagline: "Genero el .tex. Te preguntaré lo crítico antes de escribir.",
    avatarFrom: "from-emerald-500",
    avatarTo: "to-teal-600",
    accentSoft: "bg-emerald-50 dark:bg-emerald-500/10",
    accentBorder: "border-emerald-200/70 dark:border-emerald-500/20",
    accentText: "text-emerald-700 dark:text-emerald-300",
    ringFocus:
      "focus-within:border-emerald-300 dark:focus-within:border-emerald-500/50",
    badgeBg: "bg-emerald-100/80 dark:bg-emerald-500/15",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    starters: [
      {
        title: "Crear portada + preámbulo",
        prompt:
          "Crea una portada institucional elegante y el preámbulo con paquetes profesionales (geometry, microtype, hyperref, xcolor, fancyhdr, titlesec, booktabs).",
        hint: "Setup base",
      },
      {
        title: "Caja de definición",
        prompt:
          "Agrega una sección con una caja de definición tipo tcolorbox de aspecto premium (colores temáticos y título estilizado) y un ejemplo dentro.",
        hint: "tcolorbox",
      },
      {
        title: "Tabla con booktabs",
        prompt:
          "Inserta una tabla profesional con booktabs (sin líneas verticales) que compare 3 enfoques y tenga caption + label.",
        hint: "Tabla pro",
      },
      {
        title: "Bloque de código Python",
        prompt:
          "Agrega un bloque de código Python resaltado con listings y un esquema tipo Monokai. Define el estilo en el preámbulo.",
        hint: "listings + color",
      },
    ],
  },
};

export function WorkspaceChat({
  messages,
  mode,
  onModeChange,
  onSend,
  onCancel,
  sending,
  streamingText,
  phase,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const theme = MODE_THEME[mode];

  // Keep the viewport pinned to the bottom as new tokens arrive.
  useEffect(() => {
    if (collapsed) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, streamingText, collapsed]);

  // Auto-grow the textarea up to a sensible cap (cap matches the
  // max-h-44 below so the visual height never lies).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  }, [draft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await onSend(text);
  };

  const insertStarter = (prompt: string) => {
    setDraft(prompt);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <AnimatePresence mode="wait">
      {collapsed ? (
        <CollapsedLauncher
          key="launcher"
          sending={sending}
          messageCount={messages.length}
          mode={mode}
          onClick={onToggleCollapsed}
        />
      ) : (
        <motion.aside
          key="panel"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          className="flex h-full w-[420px] shrink-0 flex-col border-l border-slate-200/70 bg-white dark:border-zinc-800/80 dark:bg-zinc-950"
        >
          <ChatHeader
            mode={mode}
            theme={theme}
            onModeChange={onModeChange}
            sending={sending}
            onCollapse={onToggleCollapsed}
          />

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5"
          >
            {messages.length === 0 && !sending ? (
              <EmptyState
                mode={mode}
                theme={theme}
                onPick={insertStarter}
              />
            ) : (
              messages.map((m) => <ChatTurn key={m.id} message={m} />)
            )}
            {sending ? (
              <ChatStreamingTurn
                mode={mode}
                streamingText={streamingText}
                phase={phase}
              />
            ) : null}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200/60 px-3 py-3 dark:border-zinc-800/70"
          >
            <div
              className={`rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition-colors dark:border-zinc-800 dark:bg-zinc-900/60 ${theme.ringFocus}`}
            >
              <div className="flex items-center gap-1.5 px-3 pt-2.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${theme.badgeBg} ${theme.badgeText}`}
                >
                  <ModeDot mode={mode} />
                  {theme.label}
                </span>
                <span className="text-[10.5px] text-slate-400 dark:text-zinc-600">
                  {mode === "plan"
                    ? "Conversación estratégica"
                    : "Genera el documento"}
                </span>
              </div>
              <textarea
                ref={textareaRef}
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit(e as unknown as React.FormEvent);
                  }
                }}
                placeholder={
                  mode === "plan"
                    ? "Planea, propone, brainstormea…"
                    : "Pide un cambio o describe qué generar."
                }
                disabled={sending}
                className="block max-h-44 w-full resize-none bg-transparent px-3 pt-1.5 text-[13px] leading-[1.55] text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              <div className="flex items-center justify-between px-3 pb-2 pt-1">
                <span className="text-[10.5px] text-slate-400 dark:text-zinc-600">
                  Enter envía · Shift+Enter salto
                </span>
                {sending ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <StopIcon />
                    Detener
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
                  >
                    Enviar
                    <SendIcon />
                  </button>
                )}
              </div>
            </div>
          </form>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Header — branding, mode switch, collapse
// ---------------------------------------------------------------------------

function ChatHeader({
  mode,
  theme,
  onModeChange,
  sending,
  onCollapse,
}: {
  mode: WorkspaceMode;
  theme: ModeTheme;
  onModeChange: (mode: WorkspaceMode) => void;
  sending: boolean;
  onCollapse: () => void;
}) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-slate-200/60 px-4 py-3.5 dark:border-zinc-800/70">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${theme.avatarFrom} ${theme.avatarTo} text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(15,23,42,0.18)]`}
          >
            A
            {sending ? (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-950" />
              </span>
            ) : null}
          </span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-[13px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-zinc-50">
              The Architect
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] ${theme.badgeBg} ${theme.badgeText}`}
              >
                <ModeDot mode={mode} />
                {theme.label}
              </span>
            </h2>
            <p className="mt-0.5 truncate text-[11px] leading-snug text-slate-500 dark:text-zinc-500">
              {theme.tagline}
            </p>
          </div>
        </div>
        <CollapseToggleButton
          direction="right"
          label="Ocultar chat"
          onClick={onCollapse}
        />
      </div>

      <ModeSwitch mode={mode} onChange={onModeChange} disabled={sending} />
    </header>
  );
}

// ---------------------------------------------------------------------------
// Collapsed launcher — floating button on the right edge.
// ---------------------------------------------------------------------------

function CollapsedLauncher({
  sending,
  messageCount,
  mode,
  onClick,
}: {
  sending: boolean;
  messageCount: number;
  mode: WorkspaceMode;
  onClick: () => void;
}) {
  const theme = MODE_THEME[mode];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 60, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      aria-label="Mostrar chat"
      title={sending ? "The Architect está trabajando…" : "Abrir chat"}
      className="group fixed right-5 top-1/2 z-30 inline-flex h-14 -translate-y-1/2 items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 pr-5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] transition-all hover:translate-x-0 hover:shadow-[0_12px_38px_rgba(15,23,42,0.18)] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${theme.avatarFrom} ${theme.avatarTo} text-white`}
      >
        <ChatIcon />
        {sending ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          </span>
        ) : null}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900 dark:text-zinc-50">
          The Architect
          <span
            className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${theme.badgeBg} ${theme.badgeText}`}
          >
            {theme.label}
          </span>
        </span>
        <span className="text-[10.5px] text-slate-500 dark:text-zinc-400">
          {sending
            ? "trabajando…"
            : messageCount === 0
              ? "Abrir chat"
              : `${messageCount} ${messageCount === 1 ? "mensaje" : "mensajes"}`}
        </span>
      </span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Empty state with clickable starter prompts
// ---------------------------------------------------------------------------

function EmptyState({
  mode,
  theme,
  onPick,
}: {
  mode: WorkspaceMode;
  theme: ModeTheme;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 px-1 pt-2">
      <div className="flex flex-col items-center text-center">
        <div
          className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${theme.avatarFrom} ${theme.avatarTo} text-white shadow-[0_6px_22px_rgba(99,102,241,0.25)]`}
        >
          <SparkleIcon />
        </div>
        <p className="text-[14px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-zinc-50">
          {mode === "plan" ? "Empecemos a planear" : "Listo para generar"}
        </p>
        <p className="mt-1.5 max-w-[280px] text-[11.5px] leading-relaxed text-slate-500 dark:text-zinc-500">
          {mode === "plan"
            ? "Conversa con The Architect para diseñar la arquitectura, el temario y el estilo antes de pasar a Execute."
            : "Pide cambios concretos. Si falta info crítica, The Architect te hará preguntas antes de escribir el .tex."}
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-zinc-600">
          Ideas para arrancar
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {theme.starters.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => onPick(s.prompt)}
              className={`group flex items-center justify-between gap-2 rounded-xl border ${theme.accentBorder} ${theme.accentSoft} px-3 py-2.5 text-left transition-all hover:-translate-y-[1px] hover:shadow-[0_4px_14px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_4px_14px_rgba(0,0,0,0.35)]`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-slate-800 dark:text-zinc-100">
                  {s.title}
                </p>
                <p
                  className={`mt-0.5 truncate text-[10.5px] ${theme.accentText} opacity-80`}
                >
                  {s.hint}
                </p>
              </div>
              <span
                className={`ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-400 transition-colors group-hover:text-slate-700 dark:bg-zinc-900 dark:text-zinc-500 dark:group-hover:text-zinc-100`}
              >
                <ArrowRightIcon />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode switch — segmented control with icons and descriptions
// ---------------------------------------------------------------------------

function ModeSwitch({
  mode,
  onChange,
  disabled,
}: {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/60">
      {(["plan", "execute"] as const).map((option) => {
        const active = mode === option;
        const theme = MODE_THEME[option];
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={
              "group relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 " +
              (active
                ? "bg-white shadow-[0_2px_8px_rgba(15,23,42,0.08)] dark:bg-zinc-950 dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                : "hover:bg-white/70 dark:hover:bg-zinc-950/60")
            }
            aria-pressed={active}
            title={
              option === "plan"
                ? "Plan — conversación estratégica"
                : "Execute — generar el .tex"
            }
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${theme.avatarFrom} ${theme.avatarTo} text-white transition-opacity ${active ? "opacity-100" : "opacity-60 group-hover:opacity-90"}`}
            >
              {option === "plan" ? <BulbIcon /> : <BoltIcon />}
            </span>
            <span className="min-w-0">
              <span
                className={`block text-[11.5px] font-semibold leading-tight ${
                  active
                    ? "text-slate-900 dark:text-zinc-50"
                    : "text-slate-600 dark:text-zinc-400"
                }`}
              >
                {theme.label}
              </span>
              <span
                className={`block truncate text-[9.5px] leading-snug ${
                  active
                    ? "text-slate-500 dark:text-zinc-500"
                    : "text-slate-400 dark:text-zinc-600"
                }`}
              >
                {option === "plan" ? "Ideas y estructura" : "Generar .tex"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat turn (user / assistant)
// ---------------------------------------------------------------------------

function ChatTurn({ message }: { message: WorkspaceMessage }) {
  const isUser = message.role === "user";
  const ts = useMemo(() => formatRelative(message.created_at), [
    message.created_at,
  ]);

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[88%] flex-col items-end gap-1">
          <div className="rounded-2xl rounded-tr-sm bg-slate-900 px-3.5 py-2.5 text-[13px] leading-relaxed text-white dark:bg-zinc-50 dark:text-zinc-950">
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-600">
            Tú · {ts}
          </span>
        </div>
      </div>
    );
  }

  const theme = MODE_THEME[message.mode];
  return (
    <div className="group flex gap-2.5">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${theme.avatarFrom} ${theme.avatarTo} text-[11px] font-semibold text-white`}
      >
        A
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-slate-400 dark:text-zinc-500">
          <span className="font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
            Architect
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${theme.badgeBg} ${theme.badgeText}`}
          >
            <ModeDot mode={message.mode} />
            {theme.label}
          </span>
          <span className="text-slate-300 dark:text-zinc-700">·</span>
          <span>{ts}</span>
          <button
            type="button"
            onClick={() => copyToClipboard(message.content)}
            className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Copiar respuesta"
            title="Copiar"
          >
            <CopyIcon className="h-3.5 w-3.5 text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200" />
          </button>
        </div>
        <ChatMarkdown text={message.content} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Streaming turn
// ---------------------------------------------------------------------------

function ChatStreamingTurn({
  mode,
  streamingText,
  phase,
}: {
  mode: WorkspaceMode;
  streamingText: string | null;
  phase: WorkspacePhase | null;
}) {
  const theme = MODE_THEME[mode];
  const hasText = !!streamingText && streamingText.length > 0;
  const phaseCopy: Record<WorkspacePhase, string> = {
    thinking: "Planeando estructura",
    "writing-latex": "Escribiendo .tex",
    finalizing: "Finalizando documento",
  };
  const trailingLabel =
    mode === "execute" ? phaseCopy[phase ?? "thinking"] : "Pensando";
  return (
    <div className="flex gap-2.5">
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${theme.avatarFrom} ${theme.avatarTo} text-[11px] font-semibold text-white`}
      >
        A
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-[10.5px] text-slate-400 dark:text-zinc-500">
          <span className="font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
            Architect
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${theme.badgeBg} ${theme.badgeText}`}
          >
            <ModeDot mode={mode} />
            {theme.label}
          </span>
        </div>
        {hasText ? (
          <>
            <ChatMarkdown text={streamingText!} />
            <PhasePill label={trailingLabel} theme={theme} compact />
          </>
        ) : (
          <PhasePill label={trailingLabel} theme={theme} />
        )}
      </div>
    </div>
  );
}

function PhasePill({
  label,
  theme,
  compact,
}: {
  label: string;
  theme: ModeTheme;
  compact?: boolean;
}) {
  return (
    <div
      className={
        (compact ? "mt-1.5 " : "") +
        `inline-flex items-center gap-1.5 rounded-full border ${theme.accentBorder} ${theme.accentSoft} px-2 py-0.5 text-[11px] ${theme.accentText}`
      }
    >
      <TypingDots />
      <span className="font-medium">{label.toLowerCase()}</span>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5">
      <span className="h-1 w-1 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-current opacity-80" />
      <span className="h-1 w-1 animate-[bounce_1s_ease-in-out_0.15s_infinite] rounded-full bg-current opacity-80" />
      <span className="h-1 w-1 animate-[bounce_1s_ease-in-out_0.3s_infinite] rounded-full bg-current opacity-80" />
    </span>
  );
}

function ModeDot({ mode }: { mode: WorkspaceMode }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        mode === "plan" ? "bg-indigo-500" : "bg-emerald-500"
      }`}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return "ahora";
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copiado.");
  } catch {
    toast.error("No se pudo copiar.");
  }
}

// ---------------------------------------------------------------------------
// Lightweight markdown renderer
//
// Supports the subset that matters for chat replies: headings (#, ##, ###),
// paragraphs, code fences, inline code, bold, italic, ordered/unordered
// lists, and horizontal rules. Anything more exotic falls back to a
// plain paragraph so the text never disappears.
// ---------------------------------------------------------------------------

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; lang: string; content: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "hr" };

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().replace(/^```/, "").trim();
      i++;
      const buf: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: "code", lang, content: buf.join("\n") });
      continue;
    }
    const hm = /^(#{1,3})\s+(.+)/.exec(line);
    if (hm) {
      blocks.push({
        kind: "heading",
        level: hm[1].length as 1 | 2 | 3,
        text: hm[2],
      });
      i++;
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|```|\s*[-*•]\s+|\s*\d+\.\s+|\s*---+\s*$)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", text: buf.join("\n") });
  }
  return blocks;
}

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g;
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) out.push(text.slice(lastIndex, m.index));
    const t = m[0];
    if (t.startsWith("`")) {
      out.push(
        <code
          key={`c-${key++}`}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11.5px] text-slate-800 dark:bg-zinc-800/80 dark:text-zinc-100"
        >
          {t.slice(1, -1)}
        </code>,
      );
    } else if (t.startsWith("**") || t.startsWith("__")) {
      out.push(
        <strong
          key={`b-${key++}`}
          className="font-semibold text-slate-900 dark:text-zinc-50"
        >
          {t.slice(2, -2)}
        </strong>,
      );
    } else {
      out.push(<em key={`i-${key++}`}>{t.slice(1, -1)}</em>);
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-2.5 text-[13.25px] leading-[1.65] text-slate-700 dark:text-zinc-200">
      {blocks.map((block, idx) => {
        switch (block.kind) {
          case "heading": {
            const size =
              block.level === 1
                ? "text-[15.5px]"
                : block.level === 2
                  ? "text-[14px]"
                  : "text-[13px]";
            return (
              <p
                key={idx}
                className={`${size} mt-1.5 font-semibold tracking-[-0.01em] text-slate-900 dark:text-zinc-50`}
              >
                {renderInline(block.text)}
              </p>
            );
          }
          case "paragraph":
            return (
              <p key={idx} className="whitespace-pre-wrap">
                {renderInline(block.text)}
              </p>
            );
          case "code":
            return <CodeBlock key={idx} lang={block.lang} content={block.content} />;
          case "ul":
            return (
              <ul key={idx} className="ml-1 list-none space-y-1.5">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-[0.55em] inline-block h-1 w-1 shrink-0 rounded-full bg-slate-400 dark:bg-zinc-500"
                    />
                    <span className="flex-1">{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="ml-1 list-none space-y-1.5">
                {block.items.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0 font-semibold tabular-nums text-slate-500 dark:text-zinc-400">
                      {i + 1}.
                    </span>
                    <span className="flex-1">{renderInline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case "hr":
            return (
              <hr
                key={idx}
                className="my-3 border-slate-200 dark:border-zinc-800"
              />
            );
        }
      })}
    </div>
  );
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const hasHeader = !!lang;
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900/60">
      {hasHeader ? (
        <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:border-zinc-800/80 dark:bg-zinc-950/40 dark:text-zinc-400">
          <span>{lang}</span>
          <button
            type="button"
            onClick={() => copyToClipboard(content)}
            className="inline-flex items-center gap-1 text-slate-400 transition-colors hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-100"
            aria-label="Copiar código"
            title="Copiar"
          >
            <CopyIcon className="h-3 w-3" />
            <span className="normal-case tracking-normal">Copiar</span>
          </button>
        </div>
      ) : null}
      <pre className="overflow-x-auto px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-800 dark:text-zinc-100">
        <code className="font-mono">{content}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChatIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M21 12a8.5 8.5 0 0 1-12.4 7.55L4 21l1.45-4.6A8.5 8.5 0 1 1 21 12Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 11 16-7-7 16-2.5-6.5L4 11Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" className="h-3 w-3" fill="none" viewBox="0 0 24 24">
      <rect
        x="6"
        y="6"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className ?? "h-3.5 w-3.5"}
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect
        x="8"
        y="8"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h13m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 18h6m-5 3h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.3V17h6v-1.2c0-.9.4-1.7 1-2.3A6 6 0 0 0 12 3Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5L15 7M9 17l-1.5 1.5m9 0L15 17M9 7 7.5 5.5M12 8.5 13.5 12 17 13.5 13.5 15 12 18.5 10.5 15 7 13.5 10.5 12 12 8.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
