"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PdfThumbnail } from "@/components/reading-mode/PdfThumbnail";
import type { Book } from "@/types/book";

type BookCardProps = {
  book: Book;
  isDeleting?: boolean;
  isRenaming?: boolean;
  onDelete: (book: Book) => void;
  onOpen: (book: Book) => void;
  onRename: (book: Book, nextTitle: string) => Promise<void> | void;
};

function formatPacificDate(dateValue: string) {
  const normalizedDate = /(?:Z|[+-]\d{2}:\d{2})$/.test(dateValue)
    ? dateValue
    : `${dateValue}Z`;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Los_Angeles",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(normalizedDate));
}

// Mirrors the key used by PdfReader to persist the last-read page per book.
// Reading from the same key lets the library render a progress bar that
// stays in sync with the reader without any extra plumbing.
function readSavedPage(bookId: string): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(`focushub:lastPage:${bookId}`);
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function subscribeToStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function BookCard({
  book,
  isDeleting = false,
  isRenaming = false,
  onDelete,
  onOpen,
  onRename,
}: BookCardProps) {
  const displayTitle = book.displayName ?? book.filename;
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(displayTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  const getSnapshot = useCallback(() => readSavedPage(book.id), [book.id]);
  const currentPage = useSyncExternalStore(
    subscribeToStorage,
    getSnapshot,
    () => null,
  );

  const total = book.pageCount ?? null;
  const hasProgress = total !== null && currentPage !== null && total > 0;
  const progressRatio = hasProgress
    ? Math.min(1, Math.max(0, currentPage / total))
    : 0;
  const progressPercent = Math.round(progressRatio * 100);
  const isStarted = hasProgress && currentPage > 1;

  useEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isEditing]);

  const startEditing = () => {
    setDraftTitle(displayTitle);
    setIsEditing(true);
  };

  const commitRename = async () => {
    const next = draftTitle.trim();
    if (!next || next === displayTitle) {
      setDraftTitle(displayTitle);
      setIsEditing(false);
      return;
    }
    await onRename(book, next);
    setIsEditing(false);
  };

  const cancelRename = () => {
    setDraftTitle(displayTitle);
    setIsEditing(false);
  };

  return (
    <motion.article
      initial={false}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="group relative flex w-full flex-col text-left"
    >
      {/* -----------------------------------------------------------------
          Thumbnail — la única zona "loud" del card. Click abre el
          BookOpenDialog (gestionado por el padre). Hover revela el
          cluster de acciones flotando en la esquina superior derecha.
      ----------------------------------------------------------------- */}
      <motion.button
        type="button"
        onClick={() => !isEditing && onOpen(book)}
        disabled={isEditing}
        aria-label={`Abrir ${displayTitle}`}
        whileTap={isEditing ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className="relative block overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-[box-shadow,border-color] duration-200 group-hover:border-slate-300 group-hover:shadow-[0_18px_38px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:group-hover:border-zinc-700 dark:group-hover:shadow-[0_18px_38px_rgba(0,0,0,0.5)]"
      >
        <PdfThumbnail
          fileUrl={book.fileUrl}
          filename={displayTitle}
          thumbnailUrl={book.thumbnailUrl}
        />
        {/* Wash sutil al hacer hover — añade profundidad sin saturar */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/0 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:from-slate-950/8"
        />
        {/* Indicador de progreso integrado al thumb — reemplaza la
            pill ruidosa anterior. La presencia misma de la barra
            comunica "en curso"; la extensión muestra cuánto se ha
            leído. Neutral, sin chillar. */}
        {hasProgress && isStarted && (
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            aria-label={`Progreso de lectura: ${progressPercent}%`}
            className="absolute inset-x-0 bottom-0 h-[3px] bg-slate-900/12 dark:bg-zinc-100/15"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1], delay: 0.05 }}
              className="h-full bg-slate-900/85 dark:bg-zinc-100/90"
            />
          </div>
        )}
      </motion.button>

      {/* Acciones — solo aparecen en hover (o focus dentro del card) y
          se rinden sobre el thumb para no agregar chrome permanente */}
      {!isEditing && (
        <div className="pointer-events-none absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              startEditing();
            }}
            disabled={isRenaming || isDeleting}
            aria-label="Editar título"
            title="Editar título"
            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/90 bg-white/95 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.08)] backdrop-blur transition-colors hover:text-slate-900 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            <PencilIcon />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(book);
            }}
            disabled={isDeleting}
            aria-label="Eliminar libro"
            title="Eliminar"
            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200/90 bg-white/95 text-slate-600 shadow-[0_4px_12px_rgba(15,23,42,0.08)] backdrop-blur transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-300 dark:hover:border-red-900/40 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <TrashIcon />
          </button>
        </div>
      )}

      {/* -----------------------------------------------------------------
          Meta — título + subtítulo + barra de progreso fina.
      ----------------------------------------------------------------- */}
      <div className="mt-3.5 space-y-1.5">
        {isEditing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void commitRename();
            }}
            onClick={(event) => event.stopPropagation()}
            className="space-y-2"
          >
            <input
              ref={inputRef}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              maxLength={255}
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13.5px] font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-700"
              aria-label="Título del libro"
              disabled={isRenaming}
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={isRenaming}
                className="flex-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-50"
              >
                {isRenaming ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={cancelRename}
                disabled={isRenaming}
                className="flex-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onOpen(book)}
              className="block w-full text-left"
            >
              <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-[-0.025em] text-slate-950 dark:text-zinc-50">
                {displayTitle}
              </h3>
            </button>
            <p className="text-[12px] font-medium tabular-nums text-slate-500 dark:text-zinc-500">
              {isStarted ? (
                <>
                  <span className="text-slate-900 dark:text-zinc-200">
                    {progressPercent}%
                  </span>
                  <span className="mx-1.5 text-slate-300 dark:text-zinc-700">·</span>
                  {currentPage} / {total}
                </>
              ) : (
                formatPacificDate(book.uploadedAt)
              )}
            </p>
          </>
        )}
      </div>
    </motion.article>
  );
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3ZM14 6l4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 7h14M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7v11.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7M10 11v6M14 11v6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
