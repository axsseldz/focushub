"use client";

import { useCallback, useEffect, useRef } from "react";
import { API_BASE_URL, useAuthedFetch } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * "Auto-bookmark" persistido por backend para un libro de un usuario.
 *
 * - ``last_page`` siempre presente — la última página vista.
 * - ``last_paragraph_index`` opcional — sólo se setea cuando hay
 *   narración activa o el usuario interactúa con el highlight. Puede
 *   quedar en ``null`` si el libro nunca se narró.
 */
export type ReadingProgress = {
  book_id: number;
  last_page: number;
  last_paragraph_index: number | null;
  updated_at: string;
};

type ProgressPayload = {
  last_page: number;
  last_paragraph_index: number | null;
};

type AuthedFetch = ReturnType<typeof useAuthedFetch>;

// ---------------------------------------------------------------------------
// Fetch / save
// ---------------------------------------------------------------------------

/**
 * Trae el último bookmark guardado para ``bookId``. ``null`` cuando el
 * usuario nunca lo abrió antes (404 silencioso o respuesta vacía).
 */
export async function fetchReadingProgress(
  authedFetch: AuthedFetch,
  bookId: string,
): Promise<ReadingProgress | null> {
  const response = await authedFetch(
    `${API_BASE_URL}/files/${bookId}/progress`,
    { cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("No se pudo obtener el progreso.");
  // FastAPI devuelve ``null`` cuando el libro existe pero no hay row.
  const text = await response.text();
  if (!text || text === "null") return null;
  return JSON.parse(text) as ReadingProgress;
}

async function putReadingProgress(
  authedFetch: AuthedFetch,
  bookId: string,
  payload: ProgressPayload,
): Promise<void> {
  await authedFetch(`${API_BASE_URL}/files/${bookId}/progress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Hook — debounced autosave
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 800;

type AutosaveOptions = {
  /** Cuando ``false``, el hook no dispara nada — útil para gatear por
   *  ``isLoaded && isSignedIn`` desde el caller sin condicionar el
   *  uso del hook. */
  enabled: boolean;
  bookId: string;
  lastPage: number;
  /** Índice del párrafo activo (narrador o resume pendiente). ``null``
   *  cuando todavía no hay nada que destacar. */
  lastParagraphIndex: number | null;
};

/**
 * Persiste con debounce el último punto leído al backend. Cada cambio
 * en ``lastPage`` o ``lastParagraphIndex`` reinicia el timer; el PUT
 * sólo viaja cuando los valores estuvieron estables durante
 * {@link DEBOUNCE_MS}. Evita martillar la DB cuando el narrador avanza
 * párrafo por párrafo y a la vez no pierde el último estado.
 *
 * Al desmontar (o al cambiar de libro) el effect hace flush sin debounce
 * — si el usuario navega a otro libro inmediatamente, igual queremos
 * persistir lo último.
 */
export function useReadingProgressAutosave(options: AutosaveOptions): void {
  const { enabled, bookId, lastPage, lastParagraphIndex } = options;
  const authedFetch = useAuthedFetch();

  // Última lectura efectivamente enviada al backend — evita PUT redundantes.
  const lastSentRef = useRef<{
    page: number;
    paragraph: number | null;
  } | null>(null);

  // El identity de ``authedFetch`` cambia con userId — guardamos la versión
  // vigente en un ref para que el timer en curso no quede capturando un
  // closure obsoleto.
  const fetchRef = useRef(authedFetch);
  useEffect(() => {
    fetchRef.current = authedFetch;
  }, [authedFetch]);

  useEffect(() => {
    if (!enabled) return;
    // Mismo estado que la última vez? No-op.
    const sent = lastSentRef.current;
    if (
      sent &&
      sent.page === lastPage &&
      sent.paragraph === lastParagraphIndex
    ) {
      return;
    }

    const handle = window.setTimeout(() => {
      lastSentRef.current = {
        page: lastPage,
        paragraph: lastParagraphIndex,
      };
      void putReadingProgress(fetchRef.current, bookId, {
        last_page: lastPage,
        last_paragraph_index: lastParagraphIndex,
      }).catch(() => {
        // Background — un fallo aislado no debe romper la lectura.
        // El siguiente cambio reintenta automáticamente.
        lastSentRef.current = null;
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [enabled, bookId, lastPage, lastParagraphIndex]);

  // Reset del "ya enviado" cuando cambia de libro — el siguiente render
  // dispara el PUT inicial para el nuevo libro.
  useEffect(() => {
    lastSentRef.current = null;
  }, [bookId]);
}

// ---------------------------------------------------------------------------
// Imperative save (flush sin debounce) — útil al cerrar libro / unload.
// ---------------------------------------------------------------------------

/** Devuelve un saver imperativo que el caller puede usar para forzar
 *  un flush ante eventos puntuales (cierre del libro, beforeunload). */
export function useImperativeProgressSaver(bookId: string): (
  page: number,
  paragraphIndex: number | null,
) => void {
  const authedFetch = useAuthedFetch();
  return useCallback(
    (page, paragraphIndex) => {
      void putReadingProgress(authedFetch, bookId, {
        last_page: page,
        last_paragraph_index: paragraphIndex,
      }).catch(() => {
        // ignore
      });
    },
    [authedFetch, bookId],
  );
}
