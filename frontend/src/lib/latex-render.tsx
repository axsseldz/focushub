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
  missingAssets = [],
}: {
  /** Blob URL of the compiled PDF, or ``null`` if nothing rendered yet. */
  pdfUrl: string | null;
  /** When true, the PDF view is blurred and the build animation is on top. */
  building: boolean;
  /** If the last compile failed, the tail of the tectonic log. */
  errorDetail?: string | null;
  /** Names of images referenced by ``\includegraphics`` in the source
   *  that don't match any uploaded asset. Surfaced as a warning banner
   *  on top of the canvas so the user notices stale references after
   *  deleting an asset that the document still uses. */
  missingAssets?: string[];
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
      {missingAssets.length > 0 ? (
        // When the document references a deleted asset the rendered PDF
        // doesn't represent the current state of the source — replace
        // it entirely with the banner so the user can't act on a stale
        // preview.
        <MissingAssetsBanner names={missingAssets} />
      ) : (
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
      )}

      {building && missingAssets.length === 0 ? <BuildingOverlay /> : null}
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

function MissingAssetsBanner({ names }: { names: string[] }) {
  const single = names.length === 1;
  return (
    <div
      role="alert"
      className="mb-6 w-full max-w-[816px] rounded-xl border border-amber-300 bg-amber-50/95 px-4 py-3 text-amber-900 shadow-[0_8px_24px_-12px_rgba(120,53,15,0.18)] backdrop-blur-sm dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          <WarningIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold tracking-[-0.01em]">
            {single ? "Falta una imagen" : `Faltan ${names.length} imágenes`}
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-amber-800/90 dark:text-amber-200/90">
            El documento todavía referencia{" "}
            {single ? "este archivo eliminado" : "estos archivos eliminados"}{" "}
            con <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11.5px] dark:bg-amber-500/20">{`\\includegraphics`}</code>
            . Vuelve a subir{single ? "lo" : "los"} o pídele a The Architect
            que ajuste el documento.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {names.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-white/70 px-2 py-0.5 text-[11.5px] font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100"
              >
                <span aria-hidden="true" className="text-amber-500 dark:text-amber-400">
                  ✕
                </span>
                <code className="font-mono">{name}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function WarningIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 9v4m0 3.5h.01M10.3 4.7 2.7 17.5A2 2 0 0 0 4.4 20.5h15.2a2 2 0 0 0 1.7-3l-7.6-12.8a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
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
 * Minimalist compile indicator. A thin indeterminate progress bar
 * sweeps across the top edge of the canvas and a small monochrome
 * pill sits centered. No glow, no shimmer, no color. Designed to read
 * as "working" without competing for attention with the document.
 */
function BuildingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-slate-200/50 dark:bg-zinc-800/50">
        <div className="workspace-progress-sweep h-full w-1/3 bg-slate-900/80 dark:bg-zinc-100/80" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3.5 py-1.5 text-[12px] font-medium tracking-[-0.005em] text-slate-600 shadow-[0_1px_3px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90 dark:text-zinc-300">
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-slate-700 dark:border-zinc-700 dark:border-t-zinc-200"
          />
          <span>Compilando</span>
        </div>
      </div>
    </div>
  );
}
