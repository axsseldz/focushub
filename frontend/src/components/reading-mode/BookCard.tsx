"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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

  const startEditing = () => {
    setDraftTitle(displayTitle);
    setIsEditing(true);
  };

  // Auto-focus + select when entering edit mode.
  useEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isEditing]);

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
      whileHover={{ scale: 1.012, y: -4 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="group flex w-full flex-col gap-4 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 text-left shadow-[0_14px_34px_rgba(15,23,42,0.045)] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start justify-end gap-2">
        {!isEditing && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              startEditing();
            }}
            disabled={isRenaming || isDeleting}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <PencilIcon />
            <span>{isRenaming ? "Guardando..." : "Editar título"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(book);
          }}
          disabled={isDeleting}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        >
          {isDeleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => !isEditing && onOpen(book)}
        disabled={isEditing}
        className="flex flex-col gap-4 text-left"
      >
        <PdfThumbnail
          fileUrl={book.fileUrl}
          filename={displayTitle}
          thumbnailUrl={book.thumbnailUrl}
        />
      </button>

      <div className="space-y-1.5">
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:focus:border-zinc-300 dark:focus:ring-zinc-700"
              aria-label="Título del libro"
              disabled={isRenaming}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isRenaming}
                className="flex-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {isRenaming ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={cancelRename}
                disabled={isRenaming}
                className="flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(book)}
            className="w-full text-left"
          >
            <h3 className="line-clamp-2 text-[15px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-zinc-50 sm:text-base">
              {displayTitle}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-zinc-500">
              {formatPacificDate(book.uploadedAt)}
            </p>
          </button>
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
