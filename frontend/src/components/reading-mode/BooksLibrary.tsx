"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookCard } from "@/components/reading-mode/BookCard";
import { UploadTile } from "@/components/reading-mode/UploadTile";
import type { Book } from "@/types/book";

type UploadSuccessEvent = {
  successEntries: Array<{
    cdnUrl: string;
    mimeType?: string;
    name: string;
  }>;
};

type BooksLibraryProps = {
  books: Book[];
  /** Lista original sin filtrar — usada para diferenciar "no hay
   *  libros" de "no hay resultados de búsqueda". */
  totalBookCount: number;
  searchQuery: string;
  deletingBookId?: string | null;
  renamingBookId?: string | null;
  isLoading: boolean;
  onDeleteBook: (book: Book) => void;
  onOpenBook: (book: Book) => void;
  onRenameBook: (book: Book, nextTitle: string) => Promise<void> | void;
  onClearSearch: () => void;
  // Upload — el tile vive como primer ítem del grid.
  uploadcareKey: string;
  isUploading: boolean;
  onUploadStart: () => void;
  onUploadFailed: () => void;
  onUploadSuccess: (event: UploadSuccessEvent) => void;
};

const GRID_CLASSES =
  "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

export function BooksLibrary({
  books,
  totalBookCount,
  searchQuery,
  deletingBookId = null,
  renamingBookId = null,
  isLoading,
  onDeleteBook,
  onOpenBook,
  onRenameBook,
  onClearSearch,
  uploadcareKey,
  isUploading,
  onUploadStart,
  onUploadFailed,
  onUploadSuccess,
}: BooksLibraryProps) {
  if (isLoading) {
    return (
      <div className={GRID_CLASSES}>
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-3.5">
            <div className="aspect-[3/4] animate-pulse rounded-xl bg-slate-100 dark:bg-zinc-800" />
            <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-100 dark:bg-zinc-800" />
            <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-slate-100 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
    );
  }

  // El tile de upload se renderiza en TODOS los casos donde el grid
  // se muestra (vacío, lleno, filtrado vacío). Cuando hay búsqueda
  // sin resultados, mostramos el mensaje de "sin resultados" en
  // lugar del grid (el tile no aporta ahí — el usuario está
  // filtrando, no creando).
  const showNoResults = totalBookCount > 0 && books.length === 0 && searchQuery;

  if (showNoResults) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-8 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900 dark:text-zinc-100">
          Sin resultados
        </p>
        <p className="mt-1.5 text-[13px] text-slate-500 dark:text-zinc-500">
          No encontramos libros que coincidan con
          <span className="mx-1 font-medium text-slate-700 dark:text-zinc-300">
            “{searchQuery}”
          </span>
        </p>
        <button
          type="button"
          onClick={onClearSearch}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-zinc-100"
        >
          Limpiar búsqueda
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={GRID_CLASSES}
    >
      {/* Upload tile siempre como primer item del grid. */}
      <UploadTile
        pubkey={uploadcareKey}
        isUploading={isUploading}
        onUploadStart={onUploadStart}
        onUploadFailed={onUploadFailed}
        onUploadSuccess={onUploadSuccess}
      />

      <AnimatePresence>
        {books.map((book) => (
          <motion.div
            key={book.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <BookCard
              book={book}
              isDeleting={deletingBookId === book.id}
              isRenaming={renamingBookId === book.id}
              onDelete={onDeleteBook}
              onOpen={onOpenBook}
              onRename={onRenameBook}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
