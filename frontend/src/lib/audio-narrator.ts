"use client";

import { useAuth } from "@clerk/nextjs";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { API_BASE_URL } from "@/lib/api";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NarratorVoice = "rous" | "diego";

export type NarratorStatus = "idle" | "loading" | "playing" | "error";

export type UseAudioNarratorOptions = {
  paragraphs: string[];
  voice: NarratorVoice;
  /**
   * Pista útil para invalidar la sesión al cambiar de página: si el
   * caller pasa un nuevo valor, la narración actual se detiene.
   */
  resetKey?: string | number | null;
  /**
   * Se invoca SOLO cuando la narración llega al final de la lista
   * de párrafos por sí sola (no cuando el usuario aprieta stop ni
   * cuando el resetKey la cancela). Permite al caller continuar la
   * reproducción (por ejemplo, pasando a la siguiente página).
   */
  onFinished?: () => void;
};

export type UseAudioNarratorReturn = {
  status: NarratorStatus;
  /** Índice del párrafo que se está reproduciendo, o ``null`` cuando no hay nada activo. */
  activeParagraph: number | null;
  error: string | null;
  play: (fromIndex?: number) => Promise<void>;
  stop: () => void;
  isAvailable: boolean;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Reproduce los párrafos como audio narrado por ElevenLabs. La
 * llamada al backend transmite MP3 mientras ElevenLabs lo genera —
 * intentamos consumirla con MediaSource para mínima latencia y, si
 * el navegador no soporta ``audio/mpeg`` en MSE, caemos a Blob.
 *
 * La API es voluntariamente chica: ``play`` arranca (o reanuda en un
 * índice), ``stop`` aborta inmediatamente para que ElevenLabs no
 * siga generando ni cobrando caracteres.
 */
export function useAudioNarrator(
  options: UseAudioNarratorOptions,
): UseAudioNarratorReturn {
  const { paragraphs, voice, resetKey, onFinished } = options;
  const { userId, isLoaded, isSignedIn } = useAuth();

  // Mantenemos onFinished detrás de un ref para que el callback de
  // play() no se invalide cada vez que cambia la identidad de la
  // función pasada por el caller.
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  const [status, setStatus] = useState<NarratorStatus>("idle");
  const [activeParagraph, setActiveParagraph] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs para coordinar el ciclo de vida del audio actual. Usamos
  // refs (no state) porque queremos lecturas síncronas dentro de los
  // callbacks de play() y stop() sin disparar re-renders.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Token que se incrementa cada vez que arrancamos/paramos. Las
  // promesas pendientes verifican el token al resolverse y descartan
  // su trabajo si ya no son la sesión vigente — evita races cuando
  // el usuario pulsa stop y play en rápida sucesión.
  const sessionTokenRef = useRef(0);

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    sessionTokenRef.current += 1;
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    cleanupAudio();
    setActiveParagraph(null);
    setStatus("idle");
  }, [cleanupAudio]);

  // Cualquier cambio en la lista de párrafos o el resetKey (por
  // ejemplo: cambio de página o de libro) invalida la narración
  // actual — seguir reproduciendo el audio anterior sobre un texto
  // distinto sería confuso para el usuario. stop() ajusta estado
  // como respuesta a un evento externo (el caller cambió de
  // contenido), no como derivación de estado interno, así que la
  // regla react-hooks/set-state-in-effect no aplica.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    stop();
  }, [resetKey, paragraphs, stop]);

  // Limpieza al desmontar.
  useEffect(() => {
    return () => {
      sessionTokenRef.current += 1;
      if (abortRef.current) abortRef.current.abort();
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const play = useCallback(
    async (fromIndex = 0) => {
      if (!isLoaded || !isSignedIn || !userId) {
        setError("Inicia sesión para escuchar el libro.");
        setStatus("error");
        return;
      }
      if (paragraphs.length === 0) return;

      // Cancela cualquier reproducción en curso antes de arrancar.
      sessionTokenRef.current += 1;
      const token = sessionTokenRef.current;
      if (abortRef.current) abortRef.current.abort();
      cleanupAudio();
      setError(null);

      const playIndex = async (index: number) => {
        if (token !== sessionTokenRef.current) return;
        if (index >= paragraphs.length) {
          setStatus("idle");
          setActiveParagraph(null);
          // Sólo notificamos "fin natural" si realmente había
          // contenido para reproducir. Llamar a play(0) con la lista
          // vacía no debería contarse como "terminó".
          if (paragraphs.length > 0) {
            onFinishedRef.current?.();
          }
          return;
        }

        setActiveParagraph(index);
        setStatus("loading");

        const controller = new AbortController();
        abortRef.current = controller;

        let response: Response;
        try {
          response = await fetch(`${API_BASE_URL}/audio/narrate`, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": userId,
            },
            body: JSON.stringify({ text: paragraphs[index], voice }),
          });
        } catch (fetchErr) {
          if (token !== sessionTokenRef.current) return;
          if ((fetchErr as Error).name === "AbortError") return;
          setError("No se pudo conectar con el servicio de narración.");
          setStatus("error");
          return;
        }

        if (token !== sessionTokenRef.current) return;
        if (!response.ok || !response.body) {
          let detail = `El servicio de narración respondió con ${response.status}.`;
          try {
            const payload = (await response.clone().json()) as {
              detail?: string;
            };
            if (payload?.detail) detail = payload.detail;
          } catch {
            // Body no era JSON; nos quedamos con el mensaje genérico.
          }
          setError(detail);
          setStatus("error");
          return;
        }

        try {
          await playStream(response, {
            controller,
            isCurrent: () => token === sessionTokenRef.current,
            setAudio: (audio) => {
              audioRef.current = audio;
            },
            setObjectUrl: (url) => {
              if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
              }
              objectUrlRef.current = url;
            },
            onPlaying: () => {
              if (token !== sessionTokenRef.current) return;
              setStatus("playing");
            },
            onEnded: () => {
              if (token !== sessionTokenRef.current) return;
              // Reset session ref slot — la siguiente llamada usa su propio AbortController.
              abortRef.current = null;
              void playIndex(index + 1);
            },
            onError: () => {
              if (token !== sessionTokenRef.current) return;
              setError("Se interrumpió la reproducción del audio.");
              setStatus("error");
            },
          });
        } catch (streamErr) {
          if (token !== sessionTokenRef.current) return;
          if ((streamErr as Error).name === "AbortError") return;
          setError("Error reproduciendo el audio.");
          setStatus("error");
        }
      };

      await playIndex(Math.max(0, Math.min(fromIndex, paragraphs.length - 1)));
    },
    [cleanupAudio, isLoaded, isSignedIn, paragraphs, userId, voice],
  );

  const isAvailable = useMemo(() => paragraphs.length > 0, [paragraphs.length]);

  return {
    status,
    activeParagraph,
    error,
    play,
    stop,
    isAvailable,
  };
}

// ---------------------------------------------------------------------------
// Streaming playback helpers
// ---------------------------------------------------------------------------

type PlayStreamArgs = {
  controller: AbortController;
  isCurrent: () => boolean;
  setAudio: (audio: HTMLAudioElement) => void;
  setObjectUrl: (url: string) => void;
  onPlaying: () => void;
  onEnded: () => void;
  onError: () => void;
};

async function playStream(
  response: Response,
  args: PlayStreamArgs,
): Promise<void> {
  // Si el navegador soporta MSE con audio/mpeg podemos empezar a
  // reproducir con la primera ráfaga de bytes. Si no, juntamos todo
  // en un Blob y reproducimos al final — más latencia pero
  // universal.
  const canUseMse =
    typeof window !== "undefined" &&
    typeof window.MediaSource !== "undefined" &&
    window.MediaSource.isTypeSupported("audio/mpeg");

  if (canUseMse) {
    await playWithMediaSource(response, args);
  } else {
    await playWithBlob(response, args);
  }
}

async function playWithMediaSource(
  response: Response,
  args: PlayStreamArgs,
): Promise<void> {
  const { controller, isCurrent, setAudio, setObjectUrl, onPlaying, onEnded, onError } = args;
  const mediaSource = new MediaSource();
  const audio = new Audio();
  const objectUrl = URL.createObjectURL(mediaSource);
  audio.src = objectUrl;
  setAudio(audio);
  setObjectUrl(objectUrl);

  audio.onplaying = () => onPlaying();
  audio.onended = () => onEnded();
  audio.onerror = () => onError();

  const sourceOpen = new Promise<SourceBuffer>((resolve, reject) => {
    const onOpen = () => {
      mediaSource.removeEventListener("sourceopen", onOpen);
      try {
        const sb = mediaSource.addSourceBuffer("audio/mpeg");
        resolve(sb);
      } catch (err) {
        reject(err);
      }
    };
    mediaSource.addEventListener("sourceopen", onOpen);
  });

  const sourceBuffer = await sourceOpen;
  const reader = response.body!.getReader();
  const pending: Uint8Array[] = [];
  let appending = false;
  let streamDone = false;

  const flush = () => {
    if (appending || sourceBuffer.updating) return;
    const next = pending.shift();
    if (!next) {
      if (streamDone && mediaSource.readyState === "open") {
        try {
          mediaSource.endOfStream();
        } catch {
          // Si ya se cerró, no pasa nada.
        }
      }
      return;
    }
    appending = true;
    try {
      // @ts-expect-error — appendBuffer admite BufferSource; el tipo de TS es estrecho
      sourceBuffer.appendBuffer(next);
    } catch (err) {
      appending = false;
      onError();
      controller.abort();
      throw err;
    }
  };

  sourceBuffer.addEventListener("updateend", () => {
    appending = false;
    flush();
  });

  controller.signal.addEventListener("abort", () => {
    try {
      reader.cancel();
    } catch {
      // ignore
    }
    if (mediaSource.readyState === "open") {
      try {
        mediaSource.endOfStream();
      } catch {
        // ignore
      }
    }
  });

  void audio.play().catch(() => {
    // Autoplay puede ser bloqueado; lo marcamos como error para
    // que el usuario sepa que tiene que volver a interactuar.
    onError();
  });

  try {
    while (isCurrent()) {
      const { value, done } = await reader.read();
      if (done) {
        streamDone = true;
        flush();
        return;
      }
      if (value && value.byteLength > 0) {
        pending.push(value);
        flush();
      }
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    throw err;
  }
}

async function playWithBlob(
  response: Response,
  args: PlayStreamArgs,
): Promise<void> {
  const { controller, isCurrent, setAudio, setObjectUrl, onPlaying, onEnded, onError } = args;

  const blob = await response.blob();
  if (!isCurrent() || controller.signal.aborted) return;

  const objectUrl = URL.createObjectURL(blob);
  const audio = new Audio(objectUrl);
  setAudio(audio);
  setObjectUrl(objectUrl);

  audio.onplaying = () => onPlaying();
  audio.onended = () => onEnded();
  audio.onerror = () => onError();
  controller.signal.addEventListener("abort", () => {
    audio.pause();
  });

  await audio.play().catch(() => onError());
}
