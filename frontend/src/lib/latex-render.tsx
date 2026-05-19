"use client";

/**
 * Workspace canvas — PDF viewer for the compiled `.tex` output.
 *
 * The previous JS-based LaTeX parser was replaced with real
 * server-side compilation via Tectonic (see ``backend/app/latex_compile.py``).
 * The frontend just renders the resulting PDF bytes with
 * react-pdf.
 */

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";

type PdfComponents = {
  Document: ComponentType<{
    file: string | { url: string } | Blob | ArrayBuffer;
    onLoadSuccess?: (info: { numPages: number }) => void;
    onLoadError?: (err: Error) => void;
    loading?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
  }>;
  Page: ComponentType<{
    pageNumber: number;
    width?: number;
    renderAnnotationLayer?: boolean;
    renderTextLayer?: boolean;
    className?: string;
  }>;
};

let pdfComponentsPromise: Promise<PdfComponents> | null = null;

async function loadPdfComponents(): Promise<PdfComponents> {
  if (pdfComponentsPromise) return pdfComponentsPromise;
  pdfComponentsPromise = (async () => {
    const mod = await import("react-pdf");
    mod.pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return { Document: mod.Document, Page: mod.Page };
  })();
  return pdfComponentsPromise;
}

export function PdfCanvas({
  pdfUrl,
  building,
  errorDetail,
}: {
  /** Blob URL of the compiled PDF, or ``null`` if nothing rendered yet. */
  pdfUrl: string | null;
  /** When true, the PDF view is blurred and the build animation is on top. */
  building: boolean;
  /** If the last compile failed, the tail of the tectonic log. */
  errorDetail?: string | null;
}) {
  const [components, setComponents] = useState<PdfComponents | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageWidth, setPageWidth] = useState(720);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadPdfComponents().then((c) => {
      if (!cancelled) setComponents(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Observe container width so PDF pages scale to fit.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        // Leave a small inset so the page edge isn't flush against
        // the gutter.
        setPageWidth(Math.max(360, Math.min(900, Math.floor(width - 32))));
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col items-center overflow-y-auto bg-slate-100 px-4 py-8 dark:bg-zinc-900"
    >
      <div
        className={
          "flex w-full max-w-[900px] flex-col items-center gap-6 transition-[filter,opacity] duration-300 " +
          (building
            ? "pointer-events-none scale-[0.985] blur-[6px] opacity-70"
            : "blur-0 opacity-100")
        }
      >
        {pdfUrl && components ? (
          <components.Document
            file={pdfUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            loading={<EmptyPaperPlaceholder label="Cargando PDF…" />}
            onLoadError={() => setNumPages(0)}
            className="flex flex-col items-center gap-6"
          >
            {Array.from({ length: numPages }, (_, i) => (
              <div
                key={i}
                className="workspace-paper overflow-hidden rounded-sm shadow-[0_8px_24px_-12px_rgba(15,23,42,0.25)]"
              >
                <components.Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </div>
            ))}
          </components.Document>
        ) : errorDetail ? (
          <CompileErrorBox detail={errorDetail} />
        ) : (
          <EmptyPaperPlaceholder
            label={
              building
                ? "Construyendo documento…"
                : "Pídele a The Architect que cree tu primer documento."
            }
          />
        )}
      </div>

      {building ? <BuildingOverlay /> : null}
    </div>
  );
}

function EmptyPaperPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="workspace-paper flex w-full max-w-[816px] items-center justify-center rounded-sm border border-slate-200 px-12 text-center text-[13.5px] text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]"
      style={{ aspectRatio: "1 / 1.414" }}
    >
      {label}
    </div>
  );
}

function CompileErrorBox({ detail }: { detail: string }) {
  return (
    <div className="w-full max-w-[816px] rounded-md border border-rose-300 bg-rose-50 p-4 text-[12px] text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
      <p className="mb-2 font-semibold">No se pudo compilar el documento.</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-snug">
        {detail}
      </pre>
    </div>
  );
}

/**
 * Full-bleed overlay shown while The Architect is generating + the
 * server is compiling the .tex. The animation is layered:
 *
 * 1. A drifting conic-gradient glow that orbits the canvas.
 * 2. A sweeping shimmer that crosses the page horizontally.
 * 3. A small status pill in the center with current label.
 *
 * Everything is pure CSS — no GSAP needed for the canvas overlay.
 */
function BuildingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="workspace-build-glow absolute inset-0" />
      <div className="workspace-build-shimmer absolute inset-x-0 top-1/2 h-32 -translate-y-1/2" />
      <div className="relative z-10 flex items-center gap-3 rounded-full bg-white/90 px-5 py-2.5 text-[12.5px] font-medium text-slate-700 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:bg-zinc-950/80 dark:text-zinc-100">
        <span className="workspace-build-pulse h-2 w-2 rounded-full bg-emerald-500" />
        <span>Construyendo PDF…</span>
        <BuildingDots />
      </div>
    </div>
  );
}

function BuildingDots() {
  return (
    <span className="inline-flex items-end gap-1">
      <span className="h-1.5 w-1.5 animate-[workspace-bounce_1.1s_ease-in-out_infinite] rounded-full bg-slate-400 dark:bg-zinc-500" />
      <span className="h-1.5 w-1.5 animate-[workspace-bounce_1.1s_ease-in-out_0.18s_infinite] rounded-full bg-slate-400 dark:bg-zinc-500" />
      <span className="h-1.5 w-1.5 animate-[workspace-bounce_1.1s_ease-in-out_0.36s_infinite] rounded-full bg-slate-400 dark:bg-zinc-500" />
    </span>
  );
}
