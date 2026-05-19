"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Book } from "@/types/book";
import { FocusMode } from "@/components/reading-mode/FocusMode";
import { GestureCamera } from "@/components/reading-mode/GestureCamera";
import { AudiolibroMenu } from "@/components/reading-mode/AudiolibroMenu";
import {
  SettingsMenu,
  type ReaderTone,
} from "@/components/reading-mode/SettingsMenu";
import { ParagraphHighlight } from "@/components/reading-mode/ParagraphHighlight";
import { useFocusMode } from "@/lib/focus-mode";
import { useReadingSessionTracker } from "@/lib/reading-tracker";
import { API_BASE_URL, useAuthedFetch } from "@/lib/api";
import { extractPageNarration, type PageNarration } from "@/lib/pdf";
import { useAudioNarrator, type NarratorVoice } from "@/lib/audio-narrator";
import {
  fetchReadingProgress,
  useReadingProgressAutosave,
} from "@/lib/reading-progress";
import { useAuth } from "@clerk/nextjs";
import { useTheme } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PdfReaderProps = {
  book: Book;
  onBack: () => void;
  onPageCountResolved?: (pageCount: number) => void;
};

// ---------------------------------------------------------------------------
// Persistent reader preferences
// ---------------------------------------------------------------------------

const PAGE_STORAGE_KEY = (bookId: string) => `focushub:lastPage:${bookId}`;
const TONE_STORAGE_KEY = "focushub:readerTone";
const VOICE_STORAGE_KEY = "focushub:narratorVoice";
const TONE_ORDER: readonly ReaderTone[] = ["light", "sepia", "dark"] as const;

function readSavedPage(bookId: string): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(PAGE_STORAGE_KEY(bookId));
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readSavedTone(): ReaderTone {
  if (typeof window === "undefined") return "light";
  const raw = window.localStorage.getItem(TONE_STORAGE_KEY);
  return raw === "sepia" || raw === "dark" ? raw : "light";
}

function readSavedVoice(): NarratorVoice {
  if (typeof window === "undefined") return "rous";
  const raw = window.localStorage.getItem(VOICE_STORAGE_KEY);
  return raw === "diego" ? "diego" : "rous";
}

function toneFilter(tone: ReaderTone): string {
  switch (tone) {
    case "sepia":
      return "sepia(0.45) saturate(0.85) brightness(0.98)";
    case "dark":
      return "invert(0.92) hue-rotate(180deg)";
    default:
      return "none";
  }
}

// ---------------------------------------------------------------------------
// Zoom
// ---------------------------------------------------------------------------

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3] as const;
const DEFAULT_ZOOM = 1;

function nextZoomUp(current: number): number {
  return ZOOM_LEVELS.find((l) => l > current + 0.0001) ?? current;
}
function nextZoomDown(current: number): number {
  let best = current;
  for (const l of ZOOM_LEVELS) {
    if (l < current - 0.0001) best = l;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type PdfDocProxy = { numPages: number; getPage: (n: number) => Promise<unknown> };

export function PdfReader({ book, onBack, onPageCountResolved }: PdfReaderProps) {
  const authedFetch = useAuthedFetch();
  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const pagesContainerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PdfDocProxy | null>(null);

  const [containerDims, setContainerDims] = useState({ width: 0, height: 0 });
  const [pageRatio, setPageRatio] = useState<number | null>(null);
  const [numPages, setNumPages] = useState(0);
  // Arranca con la última página guardada localmente — cache offline-first.
  // Apenas llega el fetch del backend (más arriba en useEffect) reconciliamos
  // si el valor remoto es más reciente.
  const [currentPage, setCurrentPage] = useState(() => readSavedPage(book.id));
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [gestureEnabled, setGestureEnabled] = useState(false);
  const [tone, setTone] = useState<ReaderTone>("light");
  const [voice, setVoice] = useState<NarratorVoice>("rous");
  const [pageNarration, setPageNarration] = useState<PageNarration | null>(null);
  // "Resume paragraph" — índice del párrafo donde quedó el usuario, traído
  // del backend al montar. Se usa para:
  //   1. Pre-resaltar el párrafo (sin reproducir audio) cuando los rects
  //      de la página guardada terminan de cargar.
  //   2. Auto-scroll suave a ese párrafo cuando se vuelve visible.
  //   3. Indicarle a ``play()`` desde qué índice arrancar al apretar Play.
  // Se limpia cuando: el usuario cambia de página, arranca la narración,
  // o el narrador ya emite su propio ``activeParagraph`` (autoritativo).
  const [pendingResumeParagraph, setPendingResumeParagraph] = useState<
    number | null
  >(null);
  // Página a la que pertenece ``pendingResumeParagraph``. Sirve para
  // descartar el resume si el usuario navega a otra página antes de
  // reanudar — el párrafo guardado sólo tiene sentido en su página.
  const [resumePage, setResumePage] = useState<number | null>(null);
  // Modo "narración continua": cuando el usuario aprieta Iniciar
  // narración encendemos este flag. Se mantiene encendido aunque
  // cambien la página (manual, teclado o gestos) o termine la
  // página actual — el effect de auto-reanudación se encarga de
  // arrancar la siguiente. Stop o un error lo apagan.
  const [autoPlayNarration, setAutoPlayNarration] = useState(false);
  const [resumedFromPage, setResumedFromPage] = useState<number | null>(null);
  const [pdfComponents, setPdfComponents] = useState<{
    Document: (typeof import("react-pdf"))["Document"];
    Page: (typeof import("react-pdf"))["Page"];
  } | null>(null);

  // Restore persisted tone + voice once mounted (SSR-safe).
  useEffect(() => {
    setTone(readSavedTone());
    setVoice(readSavedVoice());
  }, []);

  // Fetch del bookmark remoto al montar. Si trae un valor más nuevo
  // que el cache local (o el cache local no existía) reconciliamos
  // página y guardamos el párrafo pendiente para el resume.
  useEffect(() => {
    if (!authLoaded || !isSignedIn) return;
    let cancelled = false;
    void fetchReadingProgress(authedFetch, book.id)
      .then((progress) => {
        if (cancelled || !progress) return;
        // Confiamos en el backend como fuente de verdad — un mismo
        // usuario puede estar leyendo en otra máquina.
        setCurrentPage((prev) =>
          progress.last_page > 0 ? progress.last_page : prev,
        );
        if (progress.last_paragraph_index !== null) {
          setPendingResumeParagraph(progress.last_paragraph_index);
          setResumePage(progress.last_page);
        }
      })
      .catch(() => {
        // Sin progreso remoto: nos quedamos con el cache local.
      });
    return () => {
      cancelled = true;
    };
  }, [authedFetch, authLoaded, isSignedIn, book.id]);
  useEffect(() => {
    try {
      window.localStorage.setItem(TONE_STORAGE_KEY, tone);
    } catch {
      // ignore storage failures
    }
  }, [tone]);
  useEffect(() => {
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, voice);
    } catch {
      // ignore storage failures
    }
  }, [voice]);

  const zoomIn = useCallback(() => setZoom((z) => nextZoomUp(z)), []);
  const zoomOut = useCallback(() => setZoom((z) => nextZoomDown(z)), []);
  const resetZoom = useCallback(() => setZoom(DEFAULT_ZOOM), []);
  const canZoomIn = zoom < ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
  const canZoomOut = zoom > ZOOM_LEVELS[0];

  const cycleTone = useCallback(() => {
    setTone((current) => {
      const next = TONE_ORDER[(TONE_ORDER.indexOf(current) + 1) % TONE_ORDER.length];
      return next;
    });
  }, []);

  // Reset zoom whenever the user opens a different book.
  useEffect(() => {
    setZoom(DEFAULT_ZOOM);
  }, [book.id]);

  const {
    enabled: focusEnabled,
    enable: enableFocus,
    disable: disableFocus,
    notificationsMuted,
  } = useFocusMode();
  const toggleFocus = useCallback(() => {
    if (focusEnabled) disableFocus();
    else enableFocus();
  }, [focusEnabled, enableFocus, disableFocus]);
  const toggleGestures = useCallback(() => setGestureEnabled((v) => !v), []);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Engagement tracking.
  const { notifyReadingActivity } = useReadingSessionTracker(book.id);

  useEffect(() => {
    if (numPages > 0) notifyReadingActivity();
  }, [currentPage, numPages, notifyReadingActivity]);

  // -------------------------------------------------------------------------
  // Narración: extracción de texto + audio
  // -------------------------------------------------------------------------

  // Extraemos el texto + cajas de la página apenas la página está
  // disponible. Esto deja al usuario apretar "Iniciar narración"
  // sin latencia de extracción.
  useEffect(() => {
    if (!pdfDocRef.current || numPages === 0) return;
    const doc = pdfDocRef.current;
    let cancelled = false;
    setPageNarration(null);
    extractPageNarration(doc as Parameters<typeof extractPageNarration>[0], currentPage)
      .then((data) => {
        if (!cancelled) setPageNarration(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPageNarration({
            paragraphs: [],
            rects: [],
            pageSize: { width: 0, height: 0 },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, numPages]);

  // Memoizamos la lista de párrafos para no romper la identidad
  // del array entre renders cuando pageNarration es el mismo objeto.
  const narratorParagraphs = useMemo(
    () => pageNarration?.paragraphs ?? [],
    [pageNarration],
  );

  // Cuando la narración termina la última frase de la página, este
  // handler avanza a la siguiente. La auto-reanudación la dispara
  // el effect que vigila pageNarration + autoPlayNarration. Si ya
  // estamos en la última, apagamos el modo continuo en lugar de
  // quedarnos colgados intentando reanudar.
  const handleNarrationFinished = useCallback(() => {
    setCurrentPage((p) => {
      if (p >= numPages) {
        setAutoPlayNarration(false);
        return p;
      }
      return p + 1;
    });
  }, [numPages]);

  const narrator = useAudioNarrator({
    paragraphs: narratorParagraphs,
    voice,
    resetKey: `${book.id}:${currentPage}`,
    onFinished: handleNarrationFinished,
  });

  // -------------------------------------------------------------------------
  // Keyboard
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable =
        tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable;

      if (e.key === "Escape") {
        if (focusEnabled) disableFocus();
        else onBack();
        return;
      }

      if (!isEditable && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        if (focusEnabled) disableFocus();
        else enableFocus();
        return;
      }

      if (isEditable) return;

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomOut();
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        resetZoom();
        return;
      }

      if (
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "PageDown" ||
        e.key === " "
      ) {
        e.preventDefault();
        setCurrentPage((p) => Math.min(p + 1, numPages));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentPage((p) => Math.max(p - 1, 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    onBack,
    focusEnabled,
    numPages,
    disableFocus,
    enableFocus,
    zoomIn,
    zoomOut,
    resetZoom,
  ]);

  // Persist current page per book.
  useEffect(() => {
    if (numPages === 0) return;
    try {
      window.localStorage.setItem(PAGE_STORAGE_KEY(book.id), String(currentPage));
    } catch {
      // ignore
    }
  }, [book.id, currentPage, numPages]);

  // Resume toast auto-dismiss.
  useEffect(() => {
    if (resumedFromPage === null) return;
    const id = window.setTimeout(() => setResumedFromPage(null), 4000);
    return () => window.clearTimeout(id);
  }, [resumedFromPage]);

  // Lazy-load react-pdf.
  useEffect(() => {
    let cancelled = false;
    void import("react-pdf").then((module) => {
      module.pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      if (!cancelled) {
        setPdfComponents({ Document: module.Document, Page: module.Page });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Container size for responsive page sizing.
  useEffect(() => {
    const container = pagesContainerRef.current;
    if (!container) return;
    const updateDims = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      setContainerDims((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h },
      );
    };
    const resizeObserver = new ResizeObserver(updateDims);
    updateDims();
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const goToNextPage = useCallback(
    () => setCurrentPage((p) => Math.min(p + 1, numPages)),
    [numPages],
  );
  const goToPrevPage = useCallback(
    () => setCurrentPage((p) => Math.max(p - 1, 1)),
    [],
  );

  // Page rendering size.
  const availW = Math.min(Math.max(containerDims.width - 48, 280), 820);
  const availH = Math.max(containerDims.height - 32, 200);
  const fitWidth =
    pageRatio !== null && availH * pageRatio <= availW ? availH * pageRatio : availW;
  const renderedWidth = fitWidth * zoom;
  const pageProp: { width: number } = { width: renderedWidth };

  const Document = pdfComponents?.Document;
  const Page = pdfComponents?.Page;
  const isLoaded = numPages > 0;

  // Highlight scale and active rects.
  const renderScale = useMemo(() => {
    if (!pageNarration || pageNarration.pageSize.width <= 0) return 1;
    return renderedWidth / pageNarration.pageSize.width;
  }, [pageNarration, renderedWidth]);

  // Índice efectivo del párrafo a resaltar:
  //   - mientras el narrador está activo, su ``activeParagraph`` manda;
  //   - antes de apretar Play, mostramos el ``pendingResumeParagraph``
  //     SOLO si seguimos en la página donde quedó el usuario.
  const highlightedParagraph = useMemo(() => {
    if (narrator.activeParagraph !== null) return narrator.activeParagraph;
    if (pendingResumeParagraph !== null && resumePage === currentPage) {
      return pendingResumeParagraph;
    }
    return null;
  }, [
    narrator.activeParagraph,
    pendingResumeParagraph,
    resumePage,
    currentPage,
  ]);

  const activeRects = useMemo(() => {
    if (!pageNarration || highlightedParagraph === null) return [];
    return pageNarration.rects[highlightedParagraph] ?? [];
  }, [pageNarration, highlightedParagraph]);

  // Auto-scroll suave al párrafo de resume cuando finalmente tenemos
  // su rect y el contenedor montado. Sólo lo hacemos una vez por
  // resume (limpiamos ``resumePage`` cuando ya queda visible) para no
  // pelearle al usuario si scrollea manualmente.
  const didScrollResumeRef = useRef(false);
  useEffect(() => {
    if (didScrollResumeRef.current) return;
    if (pendingResumeParagraph === null) return;
    if (resumePage !== currentPage) return;
    if (!pageNarration) return;
    const rects = pageNarration.rects[pendingResumeParagraph];
    if (!rects || rects.length === 0) return;
    const container = pagesContainerRef.current;
    if (!container) return;

    // Convertimos el rect (en coords del PDF a escala 1) a pixeles del
    // viewport renderizado y luego al espacio del contenedor.
    const firstRect = rects[0];
    const targetY = firstRect.y * renderScale;
    // Buscamos el <div> que envuelve la página renderizada (el primer
    // hijo absolutely-positioned dentro del flex). Usamos ``getBoundingClientRect``
    // para sumar el offset del page wrapper respecto al scroller.
    const pageWrapper = container.querySelector(
      "[data-pdf-page-wrapper]",
    ) as HTMLElement | null;
    if (!pageWrapper) return;

    const pageTopInContainer =
      pageWrapper.getBoundingClientRect().top -
      container.getBoundingClientRect().top +
      container.scrollTop;
    // Centramos el párrafo dejándolo a ~25% del viewport visible,
    // así el lector ve contexto arriba y abajo.
    const scrollTo = Math.max(
      0,
      pageTopInContainer + targetY - container.clientHeight * 0.25,
    );
    container.scrollTo({ top: scrollTo, behavior: "smooth" });
    didScrollResumeRef.current = true;
  }, [
    pendingResumeParagraph,
    resumePage,
    currentPage,
    pageNarration,
    renderScale,
  ]);

  // Si el usuario navega a otra página, el resume marcador del que
  // veníamos deja de ser relevante.
  useEffect(() => {
    if (resumePage !== null && resumePage !== currentPage) {
      setPendingResumeParagraph(null);
      setResumePage(null);
      didScrollResumeRef.current = false;
    }
  }, [currentPage, resumePage]);

  const handleStartNarration = useCallback(() => {
    setAutoPlayNarration(true);
    // Si hay un párrafo pendiente para la página actual, arrancamos
    // desde ahí. Una vez que el narrador toma control, su propio
    // ``activeParagraph`` manda y limpiamos el resume.
    const startIndex =
      pendingResumeParagraph !== null && resumePage === currentPage
        ? pendingResumeParagraph
        : 0;
    setPendingResumeParagraph(null);
    setResumePage(null);
    void narrator.play(startIndex);
  }, [narrator, pendingResumeParagraph, resumePage, currentPage]);
  const handleStopNarration = useCallback(() => {
    setAutoPlayNarration(false);
    narrator.stop();
  }, [narrator]);

  // Autosave debounced: cada vez que cambia página o párrafo activo,
  // sincronizamos al backend. El índice persistido es el efectivo
  // (narrador o resume); si ninguno está activo guardamos ``null`` —
  // así el siguiente resume sólo destacará si realmente hubo
  // narración previa.
  useReadingProgressAutosave({
    enabled: authLoaded && Boolean(isSignedIn),
    bookId: book.id,
    lastPage: currentPage,
    lastParagraphIndex: highlightedParagraph,
  });

  // Auto-reanudación al aterrizar en una página nueva mientras el
  // modo continuo sigue prendido. Cubre los tres caminos por los
  // que el usuario llega a otra página: gestos, teclado / botones
  // de footer y avance automático tras terminar la página anterior.
  // Si la nueva página no tiene texto narrable saltamos sola a la
  // siguiente para no quedarnos colgados en una página de imagen.
  const { status: narratorStatus, play: narratorPlay } = narrator;
  useEffect(() => {
    if (!autoPlayNarration) return;
    if (!pageNarration) return;
    if (narratorStatus !== "idle") return;
    if (pageNarration.paragraphs.length === 0) {
      if (currentPage < numPages) {
        setCurrentPage((p) => Math.min(p + 1, numPages));
      } else {
        setAutoPlayNarration(false);
      }
      return;
    }
    void narratorPlay(0);
  }, [
    pageNarration,
    autoPlayNarration,
    narratorStatus,
    narratorPlay,
    currentPage,
    numPages,
  ]);

  // Si la narración cae en error apagamos el modo continuo para no
  // seguir pegándole al backend con párrafos rotos en cada página.
  useEffect(() => {
    if (narratorStatus === "error" && autoPlayNarration) {
      setAutoPlayNarration(false);
    }
  }, [narratorStatus, autoPlayNarration]);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`flex h-screen flex-col transition-colors duration-700 ease-out ${
          focusEnabled
            ? "bg-[#0a0a0c] text-zinc-200"
            : "bg-slate-50/70 dark:bg-zinc-950"
        }`}
      >
        {/* --------------------------------------------------------------
            Header — en modo lectura normal muestra navegación a la
            izquierda + título + acciones a la derecha. En focus mode
            ocultamos navegación y título pero mantenemos las dos
            features principales (Focus y Audiolibro) y Ajustes a la
            derecha, sobre el wash, para que el usuario nunca quede
            sin acceso a las herramientas.
        -------------------------------------------------------------- */}
        <header
          className={`sticky top-0 z-[60] transition-colors duration-500 ${
            focusEnabled
              ? "border-transparent bg-transparent"
              : "border-b border-slate-200/80 bg-white/92 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
          }`}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3.5 sm:px-8">
            {!focusEnabled && (
              <>
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Volver a la biblioteca"
                  title="Volver"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100"
                >
                  <BackIcon />
                </button>

                <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700" />

                <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-[-0.03em] text-slate-950 dark:text-zinc-50 sm:text-lg">
                  {book.displayName ?? book.filename}
                </h1>
              </>
            )}

            {/* Spacer cuando el header está vacío a la izquierda
                (focus mode) — empuja los menús al borde derecho. */}
            {focusEnabled && <div className="flex-1" />}

            <GestosButton
              active={gestureEnabled}
              onClick={toggleGestures}
              compact={focusEnabled}
            />

            <FocusButton
              active={focusEnabled}
              onClick={toggleFocus}
              compact={focusEnabled}
            />

            {isLoaded && (
              <AudiolibroMenu
                status={narrator.status}
                voice={voice}
                onVoiceChange={setVoice}
                onPlay={handleStartNarration}
                onStop={handleStopNarration}
                error={narrator.error}
                hasContent={(pageNarration?.paragraphs.length ?? 0) > 0}
                compact={focusEnabled}
                autoPlay={autoPlayNarration}
              />
            )}

            <SettingsMenu
              zoom={zoom}
              canZoomIn={canZoomIn}
              canZoomOut={canZoomOut}
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onZoomReset={resetZoom}
              tone={tone}
              onToneChange={(next) => {
                if (next !== tone) setTone(next);
                else cycleTone();
              }}
              compact={focusEnabled}
            />
          </div>
        </header>

        {/* --------------------------------------------------------------
            Page canvas
        -------------------------------------------------------------- */}
        <div
          ref={pagesContainerRef}
          className={`mx-auto w-full flex-1 overflow-auto transition-[padding,max-width] duration-500 ease-out ${
            focusEnabled
              ? "max-w-3xl px-6 py-10 sm:px-12 lg:px-16"
              : "max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
          }`}
        >
          <div className="flex min-h-full min-w-full items-center justify-center">
            {Document && Page ? (
              <Document
                file={book.fileUrl}
                loading={<PageSkeleton />}
                onLoadSuccess={(pdf) => {
                  pdfDocRef.current = pdf as unknown as PdfDocProxy;
                  setNumPages(pdf.numPages);
                  setPageRatio(null);
                  setCurrentPage((p) => {
                    const clamped = Math.min(Math.max(p, 1), pdf.numPages);
                    if (clamped > 1) setResumedFromPage(clamped);
                    return clamped;
                  });
                  if (pdf.numPages > 0 && book.pageCount !== pdf.numPages) {
                    void authedFetch(`${API_BASE_URL}/files/${book.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ page_count: pdf.numPages }),
                    })
                      .then((res) => {
                        if (res.ok) onPageCountResolved?.(pdf.numPages);
                      })
                      .catch(() => {
                        // background sync — ignore
                      });
                  }
                }}
                error={
                  <div className="rounded-3xl border border-red-100 bg-red-50 px-6 py-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
                    No se pudo cargar el PDF.
                  </div>
                }
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="flex justify-center"
                  >
                    <div
                      data-pdf-page-wrapper
                      className={`relative overflow-hidden rounded-[1.75rem] border transition-[background-color] duration-500 ${
                        focusEnabled
                          ? "border-white/5 bg-zinc-900 shadow-none"
                          : "border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.05)] dark:border-zinc-700 dark:bg-zinc-900"
                      }`}
                    >
                      <div
                        className="transition-[filter] duration-500"
                        style={{ filter: toneFilter(tone) }}
                      >
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
                      <ParagraphHighlight
                        rects={activeRects}
                        scale={renderScale}
                        tone={tone}
                        isDark={isDark}
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </Document>
            ) : (
              <PageSkeleton />
            )}
          </div>
        </div>

        {/* --------------------------------------------------------------
            Footer — page navigation only. Hidden during focus mode.
        -------------------------------------------------------------- */}
        {isLoaded && !focusEnabled && (
          <footer className="sticky bottom-0 z-10 border-t border-slate-200/80 bg-white/92 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
            <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-6 py-3">
              <button
                type="button"
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                aria-label="Página anterior"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <ChevronLeftIcon />
              </button>

              <span className="min-w-[6rem] text-center text-sm font-medium tabular-nums text-slate-600 dark:text-zinc-400">
                {currentPage} / {numPages}
              </span>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                aria-label="Página siguiente"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-35 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <ChevronRightIcon />
              </button>
            </div>
          </footer>
        )}
      </motion.section>

      {/* Resume toast */}
      <AnimatePresence>
        {resumedFromPage !== null && !notificationsMuted && (
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

      <GestureCamera
        enabled={gestureEnabled}
        onNextPage={goToNextPage}
        onPrevPage={goToPrevPage}
      />

      <FocusMode />
    </>
  );
}

// ---------------------------------------------------------------------------
// Focus button — pareja visual del botón de Audiolibro
// ---------------------------------------------------------------------------

function FocusButton({
  active,
  onClick,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? "Salir de Focus (Esc)" : "Modo Focus (F)"}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-[-0.01em] transition-all ${
        active
          ? "border-emerald-300/70 bg-emerald-500/15 text-emerald-200 shadow-[0_4px_14px_rgba(16,185,129,0.18)] hover:bg-emerald-500/25"
          : compact
            ? "border-white/20 bg-white/10 text-white/90 backdrop-blur hover:bg-white/20"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-zinc-100"
      }`}
    >
      {active ? <FocusActiveDot /> : <FocusIcon />}
      {active ? "En Focus" : "Focus"}
    </button>
  );
}

function FocusActiveDot() {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-2 w-2 items-center justify-center"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
      <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
    </span>
  );
}

function FocusIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 8.5V6a2 2 0 0 1 2-2h2.5M20 8.5V6a2 2 0 0 0-2-2h-2.5M4 15.5V18a2 2 0 0 0 2 2h2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Gestos button — toggle de navegación con gestos
// ---------------------------------------------------------------------------

function GestosButton({
  active,
  onClick,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  compact: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? "Desactivar gestos" : "Navegar con gestos de mano"}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold tracking-[-0.01em] transition-all ${
        active
          ? compact
            ? "border-emerald-300/70 bg-emerald-500/15 text-emerald-200"
            : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400"
          : compact
            ? "border-white/20 bg-white/10 text-white/90 backdrop-blur hover:bg-white/20"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:text-zinc-100"
      }`}
    >
      <HandIcon active={active} />
      Gestos
    </button>
  );
}

function HandIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 transition-colors ${
        active ? "text-emerald-400" : "text-current"
      }`}
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

function BackIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M15.25 5.75 9 12l6.25 6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M14.5 6 8.5 12l6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M9.5 6 15.5 12l-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}
