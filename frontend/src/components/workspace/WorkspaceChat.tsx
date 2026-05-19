"use client";

import { AnimatePresence, motion } from "framer-motion";
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
  collapsed: boolean;
  onToggleCollapsed: () => void;
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

  // Keep the viewport pinned to the bottom as new tokens arrive.
  useEffect(() => {
    if (collapsed) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, streamingText, collapsed]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    await onSend(text);
  };

  return (
    <AnimatePresence mode="wait">
      {collapsed ? (
        <CollapsedLauncher
          key="launcher"
          sending={sending}
          messageCount={messages.length}
          onClick={onToggleCollapsed}
        />
      ) : (
        <motion.aside
          key="panel"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          className="flex h-full w-[360px] shrink-0 flex-col border-l border-slate-200/70 bg-white dark:border-zinc-800/80 dark:bg-zinc-950"
        >
          <header className="flex flex-col gap-2 border-b border-slate-200/60 px-4 py-3 dark:border-zinc-800/70">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-semibold text-white">
                  A
                </span>
                <h2 className="text-[12.5px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-zinc-100">
                  The Architect
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <ModeSwitch mode={mode} onChange={onModeChange} disabled={sending} />
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  aria-label="Ocultar chat"
                  title="Ocultar chat"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
            <p className="text-[11.5px] leading-relaxed text-slate-400 dark:text-zinc-500">
              {mode === "plan"
                ? "Discute ideas y estructura. No se escribe LaTeX en este modo."
                : "Solicita cambios. The Architect reescribe el documento."}
            </p>
          </header>

          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5"
          >
            {messages.length === 0 && !sending ? (
              <EmptyState />
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
            <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] focus-within:border-slate-400 dark:border-zinc-800 dark:bg-zinc-900/60 dark:focus-within:border-zinc-600">
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
                className="w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-zinc-100 dark:placeholder:text-zinc-600"
              />
              <div className="flex items-center justify-between px-3 pb-2 pt-1">
                <span className="text-[10.5px] text-slate-400 dark:text-zinc-600">
                  Enter · Shift+Enter salto
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
// Collapsed launcher — floating button on the right edge.
// ---------------------------------------------------------------------------

function CollapsedLauncher({
  sending,
  messageCount,
  onClick,
}: {
  sending: boolean;
  messageCount: number;
  onClick: () => void;
}) {
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
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
        <ChatIcon />
        {sending ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          </span>
        ) : null}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[12px] font-semibold text-slate-900 dark:text-zinc-50">
          The Architect
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
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/15 to-violet-600/15">
        <span className="bg-gradient-to-br from-indigo-500 to-violet-600 bg-clip-text text-[15px] font-bold text-transparent">
          A
        </span>
      </div>
      <p className="text-[13px] font-medium text-slate-700 dark:text-zinc-200">
        Empieza un nuevo plan
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-400 dark:text-zinc-500">
        Prueba con «Estructura un paper sobre…» o «Añade una sección de
        métodos.»
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode switch
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

// ---------------------------------------------------------------------------
// Chat turn (user / assistant)
// ---------------------------------------------------------------------------

function ChatTurn({ message }: { message: WorkspaceMessage }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-slate-900 px-3.5 py-2.5 text-[13px] leading-relaxed text-white dark:bg-zinc-50 dark:text-zinc-950">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-semibold text-white">
        A
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-slate-400 dark:text-zinc-500">
          <span>Architect</span>
          <span className="text-slate-300 dark:text-zinc-700">·</span>
          <span>{message.mode}</span>
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
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-semibold text-white">
        A
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.08em] text-slate-400 dark:text-zinc-500">
          <span>Architect</span>
          <span className="text-slate-300 dark:text-zinc-700">·</span>
          <span>{mode}</span>
        </div>
        {hasText ? (
          <>
            <ChatMarkdown text={streamingText!} />
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500">
              <TypingDots />
              <span>{trailingLabel.toLowerCase()}</span>
            </div>
          </>
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
            return (
              <pre
                key={idx}
                className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-slate-800 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-100"
              >
                <code className="font-mono">{block.content}</code>
              </pre>
            );
          case "ul":
            return (
              <ul
                key={idx}
                className="ml-1 list-none space-y-1.5"
              >
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

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

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
