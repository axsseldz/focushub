"use client";

import Link from "next/link";
import { FileUploaderRegular } from "@uploadcare/react-uploader/next";
import "@uploadcare/react-uploader/core.css";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BooksLibrary } from "@/components/reading-mode/BooksLibrary";
import { PdfReader } from "@/components/reading-mode/PdfReader";
import { renderPdfThumbnail } from "@/lib/pdf";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Book, StoredFile } from "@/types/book";

type UploadedEntry = {
  cdnUrl: string;
  mimeType?: string;
  name: string;
};

type UploadSuccessEvent = {
  successEntries: UploadedEntry[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function mapStoredFileToBook(file: StoredFile): Book {
  return {
    id: String(file.id),
    filename: file.file_name,
    fileUrl: file.file_url,
    thumbnailUrl: file.thumbnail_url,
    uploadedAt: file.created_at,
  };
}

export function ReadingModeClient() {
  const [books, setBooks] = useState<Book[]>([]);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadBooks = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/files`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No se pudo cargar la biblioteca.");
        }

        const storedFiles: StoredFile[] = await response.json();
        const pdfBooks = storedFiles
          .filter((file) => file.file_name.toLowerCase().endsWith(".pdf"))
          .map(mapStoredFileToBook);

        setBooks(pdfBooks);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No se pudo cargar la biblioteca.",
        );
      } finally {
        setIsLoadingBooks(false);
      }
    };

    void loadBooks();
  }, []);

  const handleUpload = async (event: UploadSuccessEvent) => {
    const uploadedFile = event.successEntries[0];

    if (!uploadedFile) {
      setErrorMessage("No se pudo obtener la información del archivo.");
      return;
    }

    const isPdf =
      uploadedFile.mimeType === "application/pdf" ||
      uploadedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setErrorMessage("Solo se permiten archivos PDF en Modo Lectura.");
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const thumbnailUrl = await renderPdfThumbnail(uploadedFile.cdnUrl);
      const response = await fetch(`${API_BASE_URL}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_url: uploadedFile.cdnUrl,
          file_name: uploadedFile.name,
          thumbnail_url: thumbnailUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar el libro en el backend.");
      }

      const savedFile: StoredFile = await response.json();
      const savedBook = mapStoredFileToBook(savedFile);

      setBooks((currentBooks) => [savedBook, ...currentBooks]);
      setSelectedBook(savedBook);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al subir el libro.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteBook = async (book: Book) => {
    setDeletingBookId(book.id);
    setErrorMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/files/${book.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("No se pudo eliminar el libro.");
      }

      setBooks((currentBooks) =>
        currentBooks.filter((currentBook) => currentBook.id !== book.id),
      );
      if (selectedBook?.id === book.id) {
        setSelectedBook(null);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error al eliminar el libro.",
      );
    } finally {
      setDeletingBookId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-slate-950 dark:[background-image:none] dark:bg-zinc-950 dark:text-zinc-50">
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={bookToDelete !== null}
        title="¿Eliminar este libro?"
        description="Esta acción no se puede deshacer. El libro será eliminado permanentemente de tu biblioteca."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (bookToDelete) {
            void handleDeleteBook(bookToDelete);
            setBookToDelete(null);
          }
        }}
        onCancel={() => setBookToDelete(null)}
      />

      <AnimatePresence mode="wait">
        {selectedBook ? (
          <PdfReader
            key={selectedBook.id}
            book={selectedBook}
            onBack={() => setSelectedBook(null)}
          />
        ) : (
          <motion.section
            key="library"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12 sm:px-8 lg:px-10 dark:text-zinc-50"
          >
            <div className="mb-8">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <BackIcon />
                <span>Volver</span>
              </Link>
            </div>

            <header className="grid gap-8 border-b border-slate-200/80 pb-10 dark:border-zinc-800 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <div className="max-w-2xl">
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                  Biblioteca
                </p>
                <motion.h1
                  initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.55, delay: 0.06, ease: "easeOut" }}
                  className="mt-3 text-4xl font-semibold tracking-[-0.065em] sm:text-5xl lg:text-[3.6rem]"
                >
                  <span className="bg-[linear-gradient(135deg,#020617_0%,#334155_42%,#0f172a_100%)] bg-clip-text text-transparent dark:bg-[linear-gradient(135deg,#fafafa_0%,#a1a1aa_42%,#e4e4e7_100%)]">
                    Modo Lectura
                  </span>
                </motion.h1>
              </div>

              <div className="w-full rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.045)] dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium tracking-[-0.02em] text-slate-700 dark:text-zinc-300">
                    Subir libro
                  </p>
                  <ThemeToggle />
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-zinc-500">
                  Agrega un libro nuevo a tu biblioteca.
                </p>
                <div className="mt-4">
                  <div className="relative inline-flex h-11 w-full max-w-46 overflow-hidden rounded-full">
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                      <UploadIcon />
                      <span>Seleccionar libro</span>
                    </div>
                    <div className="absolute inset-0 opacity-0">
                      <FileUploaderRegular
                        pubkey={process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY!}
                        sourceList="local, gdrive, dropbox"
                        classNameUploader="uc-light reading-mode-uploader"
                        onCommonUploadSuccess={handleUpload}
                      />
                    </div>
                  </div>
                </div>
                {isUploading ? (
                  <p className="mt-3 text-sm text-slate-500">
                    Guardando libro y generando vista previa...
                  </p>
                ) : null}
              </div>
            </header>

            <section className="py-10">
              <div className="mb-7">
                {errorMessage ? (
                  <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <BooksLibrary
                books={books}
                deletingBookId={deletingBookId}
                isLoading={isLoadingBooks}
                onDeleteBook={setBookToDelete}
                onOpenBook={setSelectedBook}
              />
            </section>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 16.25V6.75M12 6.75l-3.5 3.5M12 6.75l3.5 3.5M5.75 17.75v.5A1.75 1.75 0 0 0 7.5 20h9a1.75 1.75 0 0 0 1.75-1.75v-.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M15.25 5.75 9 12l6.25 6.25M9.5 12h9.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
