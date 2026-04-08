"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Book } from "@/types/book";
import { GestureCamera } from "@/components/reading-mode/GestureCamera";
import { SmartReadingToggle } from "@/components/reading-mode/SmartReadingToggle";

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

export function PdfReader({ book, onBack }: PdfReaderProps) {
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const [containerDims, setContainerDims] = useState({ width: 0, height: 0 });
  const [pageRatio, setPageRatio] = useState<number | null>(null); // width / height
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [smartReadingEnabled, setSmartReadingEnabled] = useState(false);
  const [pdfComponents, setPdfComponents] = useState<{
    Document: (typeof import("react-pdf"))["Document"];
    Page: (typeof import("react-pdf"))["Page"];
  } | null>(null);

  // Lazy-load react-pdf so the PDF engine only hits the bundle when needed
  useEffect(() => {
    let cancelled = false;

    void import("react-pdf").then((module) => {
      module.pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      if (!cancelled) {
        setPdfComponents({
          Document: module.Document,
          Page: module.Page,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Track container width for responsive page sizing
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;

    const updateDims = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      setContainerDims((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    const resizeObserver = new ResizeObserver(updateDims);

    updateDims();
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goToNextPage = () => {
    setCurrentPage((p) => Math.min(p + 1, numPages));
  };

  const goToPrevPage = () => {
    setCurrentPage((p) => Math.max(p - 1, 1));
  };

  // Compute the best-fit page dimension so the PDF fills the viewport without overflow.
  // Available space subtracts padding from each axis, then clamps to reasonable bounds.
  const availW = Math.min(Math.max(containerDims.width - 48, 280), 820);
  const availH = Math.max(containerDims.height - 32, 200); // 16px top + bottom padding
  // If the page ratio is known, pick the binding constraint; otherwise fall back to width.
  const pageProp: { width: number; height?: number } =
    pageRatio !== null && availH * pageRatio <= availW
      ? { width: availH * pageRatio, height: availH } // height-bound
      : { width: availW };                             // width-bound

  const Document = pdfComponents?.Document;
  const Page = pdfComponents?.Page;
  const isLoaded = numPages > 0;

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex h-screen flex-col bg-slate-50/70"
      >
        {/* ----------------------------------------------------------------
          Header
        ---------------------------------------------------------------- */}
        <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/92 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 py-4 sm:px-8">
            {/* Back button */}
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Volver
            </button>

            <div className="h-6 w-px bg-slate-200" />

            {/* Book title */}
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.03em] text-slate-950 sm:text-lg">
              {book.filename}
            </h1>

            {/* Page navigation controls */}
            {isLoaded && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPrevPage}
                  disabled={currentPage <= 1}
                  aria-label="Página anterior"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronUpIcon />
                </button>

                <span className="min-w-[4.5rem] text-center text-sm font-medium tabular-nums text-slate-600">
                  {currentPage} / {numPages}
                </span>

                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={currentPage >= numPages}
                  aria-label="Página siguiente"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronDownIcon />
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-slate-200 max-sm:hidden" />

            {/* Smart reading toggle */}
            <SmartReadingToggle
              enabled={smartReadingEnabled}
              onToggle={() => setSmartReadingEnabled((v) => !v)}
            />
          </div>
        </header>

        {/* ----------------------------------------------------------------
          Page canvas
        ---------------------------------------------------------------- */}
        <div
          ref={pagesContainerRef}
          className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center overflow-hidden px-4 py-4 sm:px-6 lg:px-8"
        >
          {Document && Page ? (
            <Document
              file={book.fileUrl}
              loading={<PageSkeleton />}
              onLoadSuccess={({ numPages: total }) => {
                setNumPages(total);
                setPageRatio(null); // reset until first page reports its ratio
              }}
              error={
                <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-5 text-sm text-red-700">
                  No se pudo cargar el PDF.
                </div>
              }
            >
              {/* Animate page transitions with a unique key per page number */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentPage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex justify-center"
                >
                  <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
                    <Page
                      pageNumber={currentPage}
                      {...pageProp}
                      onLoadSuccess={(page) => {
                        const vp = page.getViewport({ scale: 1 });
                        const ratio = vp.width / vp.height;
                        setPageRatio((prev) => (prev === ratio ? prev : ratio));
                      }}
                      renderAnnotationLayer={false}
                      renderTextLayer={false}
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </Document>
          ) : (
            <PageSkeleton />
          )}
        </div>

        {/* ----------------------------------------------------------------
          Bottom page navigation (convenience for mouse / touch users)
        ---------------------------------------------------------------- */}
        {isLoaded && (
          <footer className="sticky bottom-0 z-10 border-t border-slate-200/80 bg-white/92 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-center gap-4 px-6 py-3">
              <button
                type="button"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronUpIcon />
                Anterior
              </button>

              <span className="text-sm font-medium tabular-nums text-slate-500">
                {currentPage} de {numPages}
              </span>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
              >
                Siguiente
                <ChevronDownIcon />
              </button>
            </div>
          </footer>
        )}
      </motion.section>

      {/* GestureCamera renders a fixed overlay; lives outside the scrollable
          section so it stays anchored to the viewport corner at all times. */}
      <GestureCamera
        enabled={smartReadingEnabled}
        onNextPage={goToNextPage}
        onPrevPage={goToPrevPage}
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
      <div className="h-[70vh] animate-pulse rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.04)]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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
