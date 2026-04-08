"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookCard } from "@/components/reading-mode/BookCard";
import type { Book } from "@/types/book";

type BooksLibraryProps = {
  books: Book[];
  deletingBookId?: string | null;
  isLoading: boolean;
  onDeleteBook: (book: Book) => void;
  onOpenBook: (book: Book) => void;
};

export function BooksLibrary({
  books,
  deletingBookId = null,
  isLoading,
  onDeleteBook,
  onOpenBook,
}: BooksLibraryProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="aspect-3/4 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-800" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded-full bg-slate-100 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded-full bg-slate-100 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="rounded-[1.9rem] border border-dashed border-slate-200 bg-slate-50/70 px-8 py-18 text-center shadow-[0_12px_32px_rgba(15,23,42,0.03)] dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-zinc-50">
          Sube tu primer libro para comenzar a leer
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-zinc-500">
          Cuando subas un PDF, aparecerá aquí con vista previa y acceso directo
          al modo de lectura.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
    >
      <AnimatePresence>
        {books.map((book) => (
          <motion.div
            key={book.id}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <BookCard
              book={book}
              isDeleting={deletingBookId === book.id}
              onDelete={onDeleteBook}
              onOpen={onOpenBook}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
