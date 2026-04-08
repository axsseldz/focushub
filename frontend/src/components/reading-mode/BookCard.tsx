"use client";

import { motion } from "framer-motion";
import { PdfThumbnail } from "@/components/reading-mode/PdfThumbnail";
import type { Book } from "@/types/book";

type BookCardProps = {
  book: Book;
  isDeleting?: boolean;
  onDelete: (book: Book) => void;
  onOpen: (book: Book) => void;
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
  onDelete,
  onOpen,
}: BookCardProps) {
  return (
    <motion.article
      whileHover={{ scale: 1.012, y: -4 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="group flex w-full flex-col gap-4 rounded-[1.75rem] border border-slate-200/80 bg-white p-4 text-left shadow-[0_14px_34px_rgba(15,23,42,0.045)] dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-end">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(book);
          }}
          disabled={isDeleting}
          className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-800 dark:hover:bg-red-900/30 dark:hover:text-red-400"
        >
          {isDeleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onOpen(book)}
        className="flex flex-col gap-4 text-left"
      >
        <PdfThumbnail
          fileUrl={book.fileUrl}
          filename={book.filename}
          thumbnailUrl={book.thumbnailUrl}
        />

        <div className="space-y-1.5">
          <h3 className="line-clamp-2 text-[15px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50 sm:text-base">
            {book.filename}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            {formatPacificDate(book.uploadedAt)}
          </p>
        </div>
      </button>
    </motion.article>
  );
}
