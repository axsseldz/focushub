"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Book } from "@/types/book";

type PdfReaderProps = {
  book: Book;
  onBack: () => void;
};

export function PdfReader({ book, onBack }: PdfReaderProps) {
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [pdfComponents, setPdfComponents] = useState<{
    Document: (typeof import("react-pdf"))["Document"];
    Page: (typeof import("react-pdf"))["Page"];
  } | null>(null);

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

  useEffect(() => {
    const container = pagesContainerRef.current;

    if (!container) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      setContainerWidth(container.clientWidth);
    });

    setContainerWidth(container.clientWidth);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const pageWidth = Math.min(Math.max(containerWidth - 48, 280), 820);
  const Document = pdfComponents?.Document;
  const Page = pdfComponents?.Page;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex min-h-screen flex-col bg-slate-50/70"
    >
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Volver
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <h1 className="truncate text-base font-semibold tracking-[-0.03em] text-slate-950 sm:text-lg">
            {book.filename}
          </h1>
        </div>
      </header>

      <div
        ref={pagesContainerRef}
        className="mx-auto flex w-full max-w-6xl flex-1 justify-center px-4 py-8 sm:px-6 lg:px-8"
      >
        {Document && Page ? (
          <Document
            file={book.fileUrl}
            loading={
              <div className="flex w-full max-w-3xl flex-col gap-5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-96 animate-pulse rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.04)]"
                  />
                ))}
              </div>
            }
            onLoadSuccess={({ numPages: totalPages }) => setNumPages(totalPages)}
            error={
              <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-5 text-sm text-red-700">
                No se pudo cargar el PDF.
              </div>
            }
            className="w-full"
          >
            <div className="flex w-full flex-col items-center gap-6">
              {Array.from({ length: numPages }, (_, index) => (
                <motion.div
                  key={index + 1}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.18) }}
                  className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)]"
                >
                  <Page
                    pageNumber={index + 1}
                    width={pageWidth}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                  />
                </motion.div>
              ))}
            </div>
          </Document>
        ) : (
          <div className="flex w-full max-w-3xl flex-col gap-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-96 animate-pulse rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.04)]"
              />
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}
