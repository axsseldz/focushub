"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Book } from "@/types/book";
import { GestureCamera } from "@/components/reading-mode/GestureCamera";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  extractPdfPageParagraphCrops,
  getPdfPageCount,
  type PdfParagraphCrop,
} from "@/lib/pdf";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PdfReaderProps = {
  book: Book;
  onBack: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_STORAGE_KEY = (bookId: string) => `focushub:lastPage:${bookId}`;

function readSavedPage(bookId: string): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(PAGE_STORAGE_KEY(bookId));
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function PdfReader({ book, onBack }: PdfReaderProps) {
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  // Lazy initialiser reads the last known page from localStorage so the
  // reader resumes exactly where the user left off. Clamped to numPages
  // once the PDF reports its total length (see onLoadSuccess below).
  const [currentPage, setCurrentPage] = useState(() => readSavedPage(book.id));
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [paragraphCrops, setParagraphCrops] = useState<PdfParagraphCrop[]>([]);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Brief toast shown when the user resumes a book on a page > 1 so
  // the jump is not surprising.
  const [resumedFromPage, setResumedFromPage] = useState<number | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onBack]);

  // Persist the current page per book so the next open resumes here.
  // Only write once numPages is known so we never store 0 or a clamp-
  // corrected value that doesn't match a user action.
  useEffect(() => {
    if (numPages === 0) return;
    try {
      window.localStorage.setItem(
        PAGE_STORAGE_KEY(book.id),
        String(currentPage),
      );
    } catch {
      // Ignore storage failures (quota, private mode, etc.)
    }
  }, [book.id, currentPage, numPages]);

  // Auto-dismiss the "resumed from page N" toast after 4 s.
  useEffect(() => {
    if (resumedFromPage === null) return;
    const id = window.setTimeout(() => setResumedFromPage(null), 4000);
    return () => window.clearTimeout(id);
  }, [resumedFromPage]);

  // Load page count once; on success clamp saved page and show resume toast.
  useEffect(() => {
    let cancelled = false;

    setLoadError(null);

    void getPdfPageCount(book.fileUrl)
      .then((total) => {
        if (cancelled) return;
        setNumPages(total);
        setCurrentPage((p) => {
          const clamped = Math.min(Math.max(p, 1), total);
          if (clamped > 1) setResumedFromPage(clamped);
          return clamped;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("No se pudo cargar el PDF.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [book.fileUrl]);

  // Render the current page and extract paragraph crops whenever the page changes.
  useEffect(() => {
    if (numPages === 0) return;

    let cancelled = false;

    setIsLoading(true);
    setLoadError(null);
    setParagraphCrops([]);
    setCurrentBlock(0);

    void extractPdfPageParagraphCrops(book.fileUrl, currentPage)
      .then((crops) => {
        if (cancelled) return;
        setParagraphCrops(crops);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("No se pudo cargar esta página.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [book.fileUrl, currentPage, numPages]);

  // ---------------------------------------------------------------------------
  // Navigation — block within page, then page
  // ---------------------------------------------------------------------------

  const goToNextBlock = () => {
    if (currentBlock < paragraphCrops.length - 1) {
      setCurrentBlock((b) => b + 1);
    } else if (currentPage < numPages) {
      setCurrentPage((p) => p + 1);
      // currentBlock resets to 0 in the extraction effect
    }
  };

  const goToPrevBlock = () => {
    if (currentBlock > 0) {
      setCurrentBlock((b) => b - 1);
    } else if (currentPage > 1) {
      setCurrentPage((p) => p - 1);
      // Show last block of prev page after crops load
    }
  };

  const isLoaded = numPages > 0;
  const isLastBlock =
    currentBlock === paragraphCrops.length - 1 && currentPage >= numPages;
  const isFirstBlock = currentBlock === 0 && currentPage <= 1;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-screen flex-col bg-slate-50/70 dark:bg-zinc-950"
      >
        {/* ----------------------------------------------------------------
          Header
        ---------------------------------------------------------------- */}
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/92 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4 sm:px-8">
            {/* Back button */}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Volver
            </button>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <DashboardIcon />
              Dashboard
            </Link>

            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700" />

            {/* Book title */}
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.03em] text-slate-950 dark:text-zinc-50 sm:text-lg">
              {book.displayName ?? book.filename}
            </h1>

            {/* Block / page progress */}
            {isLoaded && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPrevBlock}
                  disabled={isFirstBlock}
                  aria-label="Bloque anterior"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  <ChevronUpIcon />
                </button>

                <span className="min-w-[6rem] text-center text-sm font-medium tabular-nums text-slate-600 dark:text-zinc-400">
                  {paragraphCrops.length > 0
                    ? `${currentBlock + 1} / ${paragraphCrops.length}`
                    : `p. ${currentPage}`}
                </span>

                <button
                  type="button"
                  onClick={goToNextBlock}
                  disabled={isLastBlock}
                  aria-label="Bloque siguiente"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  <ChevronDownIcon />
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 max-sm:hidden" />

            {/* Gesture toggle */}
            <button
              type="button"
              onClick={() => setGestureEnabled((v) => !v)}
              title="Navegar con gestos de mano"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                gestureEnabled
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400"
                  : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              <HandIcon active={gestureEnabled} />
              Gestos
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 max-sm:hidden" />
            <ThemeToggle />
          </div>
        </header>

        {/* ----------------------------------------------------------------
          Page canvas
        ---------------------------------------------------------------- */}
        <div
          ref={pagesContainerRef}
          className="mx-auto flex w-full max-w-6xl flex-1 justify-center overflow-y-auto px-4 py-6 sm:px-6 lg:px-8"
        >
          {isLoading ? (
            <PageSkeleton />
          ) : loadError ? (
            <div className="w-full max-w-3xl rounded-3xl border border-red-100 bg-red-50 px-6 py-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
              {loadError}
            </div>
          ) : paragraphCrops.length > 0 ? (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${currentPage}-${currentBlock}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex w-full max-w-4xl flex-col items-center"
              >
                {/* Paragraph label */}
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                  Pág.&nbsp;{currentPage}&nbsp;·&nbsp;Párrafo&nbsp;{currentBlock + 1}&nbsp;de&nbsp;{paragraphCrops.length}
                </p>

                {/* Cropped paragraph image */}
                <div className="w-full overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={paragraphCrops[currentBlock].dataUrl}
                    alt={`Párrafo ${currentBlock + 1} de la página ${currentPage}`}
                    className="h-auto w-full select-none"
                    draggable={false}
                  />
                </div>

                {/* Progress dots */}
                {paragraphCrops.length > 1 && (
                  <div className="mt-5 flex gap-1.5">
                    {paragraphCrops.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentBlock(idx)}
                        aria-label={`Ir al párrafo ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-200 ${
                          idx === currentBlock
                            ? "w-5 bg-slate-700 dark:bg-zinc-200"
                            : "w-1.5 bg-slate-300 hover:bg-slate-400 dark:bg-zinc-600 dark:hover:bg-zinc-400"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="w-full max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-800 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-300">
              Esta página no contiene texto seleccionable y no puede dividirse en párrafos. Si el PDF es una imagen escaneada necesitará OCR.
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------
          Bottom page navigation (convenience for mouse / touch users)
        ---------------------------------------------------------------- */}
        {isLoaded && (
          <footer className="sticky bottom-0 z-10 border-t border-slate-200/80 bg-white/92 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
            <div className="mx-auto flex max-w-6xl items-center justify-center gap-4 px-6 py-3">
              <button
                type="button"
                onClick={goToPrevBlock}
                disabled={isFirstBlock}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <ChevronUpIcon />
                Anterior
              </button>

              <span className="text-sm font-medium tabular-nums text-slate-500 dark:text-zinc-500">
                Pág. {currentPage} / {numPages}
              </span>

              <button
                type="button"
                onClick={goToNextBlock}
                disabled={isLastBlock}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Siguiente
                <ChevronDownIcon />
              </button>
            </div>
          </footer>
        )}
      </motion.section>

      {/* Resume toast — fades in when the user reopens a book past page 1
          and auto-dismisses a few seconds later. */}
      <AnimatePresence>
        {resumedFromPage !== null && (
          <motion.div
            key="resume-toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-auto fixed left-1/2 top-20 z-40 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-[0_18px_44px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-900">
              <span className="text-slate-700 dark:text-zinc-200">
                Continuando desde la página{" "}
                <strong className="tabular-nums">{resumedFromPage}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  setResumedFromPage(null);
                }}
                className="rounded-full border border-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                Empezar de cero
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed overlays — live outside the scrollable section so they stay
          anchored to the viewport corners at all times. */}
      <GestureCamera
        enabled={gestureEnabled}
        onNextPage={goToNextBlock}
        onPrevPage={goToPrevBlock}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <div className="h-[70vh] animate-pulse rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.04)] dark:border-zinc-800 dark:bg-zinc-900" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function HandIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 transition-colors duration-200 ${active ? "text-emerald-500" : "text-slate-400"}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M18 11V9a2 2 0 0 0-4 0v-.5M14 8.5V6a2 2 0 0 0-4 0v3M10 9V5a2 2 0 0 0-4 0v8l-1.5-2a1.5 1.5 0 0 0-2.122 2.122L5 18a7 7 0 0 0 7 3.5 7 7 0 0 0 7-7v-3.5a2 2 0 0 0-4 0V11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M18 15.25 12 9l-6 6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 9.25 12 15.5l6-6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.75 6.75a2 2 0 0 1 2-2h10.5a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2V6.75ZM9.5 4.75v14.5M4.75 9.5h14.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
