"use client";

import { useEffect, useRef, useState } from "react";
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
}: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the viewport pinned to the bottom as new tokens arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, streamingText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await onSend(text);
  };

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200/70 bg-white dark:border-zinc-800/80 dark:bg-zinc-950">
      <header className="flex flex-col gap-2 border-b border-slate-200/60 px-4 py-3 dark:border-zinc-800/70">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
            The Architect
          </h2>
          <ModeSwitch mode={mode} onChange={onModeChange} disabled={sending} />
        </div>
        <p className="text-[11.5px] leading-relaxed text-slate-400 dark:text-zinc-500">
          {mode === "plan"
            ? "Discute ideas y estructura. No se escribe LaTeX en este modo."
            : "Solicita cambios. The Architect reescribe el documento."}
        </p>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 text-[13.5px] leading-relaxed"
      >
        {messages.length === 0 && !sending ? (
          <p className="text-[12.5px] text-slate-400 dark:text-zinc-500">
            Empieza: «Estructura un paper sobre…» o «Añade una sección de
            métodos.»
          </p>
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
        className="border-t border-slate-200/60 px-4 py-3 dark:border-zinc-800/70"
      >
        <textarea
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
              ? "Plan: ¿qué quieres construir?"
              : "Execute: pide un cambio concreto."
          }
          disabled={sending}
          className="w-full resize-none rounded-md bg-transparent text-[13px] text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-600"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10.5px] text-slate-400 dark:text-zinc-600">
            Enter para enviar · Shift+Enter salto
          </span>
          {sending ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              className="rounded-md bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-950"
            >
              Enviar
            </button>
          )}
        </div>
      </form>
    </aside>
  );
}

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
    <div className="inline-flex overflow-hidden rounded-md border border-slate-200 text-[11px] dark:border-zinc-800">
      {(["plan", "execute"] as const).map((option) => {
        const active = mode === option;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={
              (active
                ? "bg-slate-900 px-2 py-0.5 font-medium text-white dark:bg-zinc-50 dark:text-zinc-950"
                : "px-2 py-0.5 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100") +
              " disabled:opacity-40"
            }
          >
            {option === "plan" ? "Plan" : "Execute"}
          </button>
        );
      })}
    </div>
  );
}

function ChatTurn({ message }: { message: WorkspaceMessage }) {
  const isUser = message.role === "user";
  return (
    <div className="flex gap-2.5">
      <div
        className={
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold " +
          (isUser
            ? "bg-slate-900 text-white dark:bg-zinc-50 dark:text-zinc-950"
            : "border border-slate-300 text-slate-500 dark:border-zinc-700 dark:text-zinc-400")
        }
      >
        {isUser ? "Tú" : "A"}
      </div>
      <div className="flex-1">
        <div className="mb-0.5 flex items-center gap-2 text-[10.5px] text-slate-400 dark:text-zinc-600">
          <span>{isUser ? "Tú" : "Architect"}</span>
          <span>·</span>
          <span className="uppercase tracking-[0.05em]">{message.mode}</span>
        </div>
        <p className="whitespace-pre-wrap text-[13px] text-slate-700 dark:text-zinc-200">
          {message.content}
        </p>
      </div>
    </div>
  );
}

function ChatStreamingTurn({
  mode,
  streamingText,
  phase,
}: {
  mode: WorkspaceMode;
  streamingText: string | null;
  phase: WorkspacePhase | null;
}) {
  const hasText = !!streamingText && streamingText.length > 0;
  const phaseCopy: Record<WorkspacePhase, string> = {
    thinking: "Planeando estructura",
    "writing-latex": "Escribiendo .tex",
    finalizing: "Finalizando documento",
  };
  const trailingLabel =
    mode === "execute"
      ? phaseCopy[phase ?? "thinking"]
      : "Pensando";
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
        A
      </div>
      <div className="flex-1">
        <div className="mb-0.5 flex items-center gap-2 text-[10.5px] text-slate-400 dark:text-zinc-600">
          <span>Architect</span>
          <span>·</span>
          <span className="uppercase tracking-[0.05em]">{mode}</span>
        </div>
        {hasText ? (
          <p className="whitespace-pre-wrap text-[13px] text-slate-700 dark:text-zinc-200">
            {streamingText}
            {mode === "execute" ? (
              <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[11px] text-slate-400 dark:text-zinc-500">
                <TypingDots />
                <span>{trailingLabel.toLowerCase()}</span>
              </span>
            ) : (
              <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 animate-pulse bg-slate-400 dark:bg-zinc-500" />
            )}
          </p>
        ) : (
          <div className="flex items-center gap-1.5 text-[13px] text-slate-400 dark:text-zinc-500">
            <span>{trailingLabel}</span>
            <TypingDots />
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-end gap-0.5">
      <span className="h-1 w-1 animate-[bounce_1s_ease-in-out_infinite] rounded-full bg-slate-400 dark:bg-zinc-500" />
      <span className="h-1 w-1 animate-[bounce_1s_ease-in-out_0.15s_infinite] rounded-full bg-slate-400 dark:bg-zinc-500" />
      <span className="h-1 w-1 animate-[bounce_1s_ease-in-out_0.3s_infinite] rounded-full bg-slate-400 dark:bg-zinc-500" />
    </span>
  );
}
