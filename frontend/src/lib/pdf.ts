"use client";

let workerConfigured = false;

async function getPdfJs() {
  const { pdfjs } = await import("react-pdf");

  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigured = true;
  }

  return pdfjs;
}

// Tope duro por chunk de ElevenLabs. El backend valida lo mismo
// (NarrateRequest.text max_length=1000), así que cualquier párrafo
// más largo se vuelve a partir.
const MAX_CHUNK_CHARS = 1000;
// Objetivo de tamaño para una "unidad de narración". Suficiente para
// ~10 a 20 segundos de audio y a la vez chico para que el highlight
// avance con frecuencia y se sienta vivo.
const TARGET_CHUNK_CHARS = 320;

export type ParagraphRect = {
  /** Coordenadas en píxeles CSS del viewport a escala 1. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PageNarration = {
  paragraphs: string[];
  /** rects[i] = rects del párrafo i (uno por línea visual). */
  rects: ParagraphRect[][];
  /** Dimensiones del viewport del PDF a escala 1 — sirven para mapear
   *  los rects al tamaño renderizado actual. */
  pageSize: { width: number; height: number };
};

type PdfTextItem = {
  str?: string;
  hasEOL?: boolean;
  transform?: number[];
  width?: number;
  height?: number;
};

type AnyPdfDoc = {
  getPage: (n: number) => Promise<AnyPdfPage>;
};
type AnyPdfPage = {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  getViewport: (opts: { scale: number }) => {
    width: number;
    height: number;
    convertToViewportRectangle: (rect: number[]) => number[];
  };
  cleanup: () => void;
};

/**
 * Extrae el contenido de la página agrupándolo en "unidades de
 * narración" (~{@link TARGET_CHUNK_CHARS} caracteres, cortando en
 * frontera de oración) y devuelve, para cada unidad, las cajas que
 * cubre su texto en el PDF. Las cajas se usan luego como overlay
 * para resaltar el párrafo activo encima del propio documento.
 */
export async function extractPageNarration(
  pdf: AnyPdfDoc,
  pageNumber: number,
): Promise<PageNarration> {
  const page = await pdf.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const pageSize = { width: viewport.width, height: viewport.height };

    const items = content.items;

    type Token = {
      text: string;
      rect: ParagraphRect | null;
      hasEOL: boolean;
    };
    const tokens: Token[] = items.map((item) => ({
      text: typeof item.str === "string" ? item.str : "",
      rect: rectForItem(item, viewport),
      hasEOL: Boolean(item.hasEOL),
    }));

    type Chunk = { text: string; rects: ParagraphRect[] };
    const chunks: Chunk[] = [];
    let cur: Chunk = { text: "", rects: [] };

    const flushCur = () => {
      const cleaned = cur.text.replace(/\s+/g, " ").trim();
      if (cleaned) chunks.push({ text: cleaned, rects: cur.rects });
      cur = { text: "", rects: [] };
    };

    for (const token of tokens) {
      if (token.text) {
        if (cur.text && !/\s$/.test(cur.text) && token.text[0] !== " ") {
          cur.text += " ";
        }
        cur.text += token.text;
        if (token.rect) cur.rects.push(token.rect);
      }

      const cleaned = cur.text.replace(/\s+/g, " ").trim();
      const endsSentence = /[.!?…:;]$/.test(cleaned);
      const longEnough = cleaned.length >= TARGET_CHUNK_CHARS;
      const tooLong = cleaned.length >= MAX_CHUNK_CHARS;

      if (tooLong || (token.hasEOL && longEnough && endsSentence)) {
        flushCur();
      }
    }
    flushCur();

    // Si una unidad supera el máximo permitido por ElevenLabs,
    // partirla por oración y heredar todas las cajas del original (no
    // sabemos qué caja exacta cubre cada frase, así que iluminamos la
    // unidad completa en cada sub-chunk).
    const paragraphs: string[] = [];
    const rects: ParagraphRect[][] = [];
    for (const chunk of chunks) {
      if (chunk.text.length <= MAX_CHUNK_CHARS) {
        paragraphs.push(chunk.text);
        rects.push(mergeRectsByLine(chunk.rects));
        continue;
      }
      const subs = splitLongParagraph(chunk.text);
      const mergedRects = mergeRectsByLine(chunk.rects);
      for (const sub of subs) {
        paragraphs.push(sub);
        rects.push(mergedRects);
      }
    }

    return { paragraphs, rects, pageSize };
  } finally {
    page.cleanup();
  }
}

function rectForItem(
  item: PdfTextItem,
  viewport: AnyPdfPage extends never
    ? never
    : ReturnType<AnyPdfPage["getViewport"]>,
): ParagraphRect | null {
  const tx = item.transform;
  if (!tx || tx.length < 6) return null;
  const width = item.width ?? Math.abs(tx[0]);
  // pdfjs reporta a veces height=0; usamos la escala Y de la matriz
  // como aproximación del alto de la línea (corresponde al font size).
  const height = item.height && item.height > 0 ? item.height : Math.abs(tx[3]);
  if (!width || !height) return null;

  const x0 = tx[4];
  const y0 = tx[5];
  const [vx0, vy0, vx1, vy1] = viewport.convertToViewportRectangle([
    x0,
    y0,
    x0 + width,
    y0 + height,
  ]);
  const left = Math.min(vx0, vx1);
  const top = Math.min(vy0, vy1);
  const w = Math.abs(vx1 - vx0);
  const h = Math.abs(vy1 - vy0);
  if (w < 0.5 || h < 0.5) return null;
  return { x: left, y: top, width: w, height: h };
}

function mergeRectsByLine(rects: ParagraphRect[]): ParagraphRect[] {
  if (rects.length === 0) return [];
  // Agrupamos cajas con baseline similar para formar una sola caja
  // por línea visual. "Similar" = los centros verticales caen dentro
  // de la mitad del alto del rect más alto del grupo.
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: ParagraphRect[][] = [];
  for (const rect of sorted) {
    const last = lines[lines.length - 1];
    if (!last) {
      lines.push([rect]);
      continue;
    }
    const lastTop = Math.min(...last.map((r) => r.y));
    const lastBottom = Math.max(...last.map((r) => r.y + r.height));
    const lastCenter = (lastTop + lastBottom) / 2;
    const rectCenter = rect.y + rect.height / 2;
    const tolerance = Math.max(rect.height, lastBottom - lastTop) * 0.6;
    if (Math.abs(rectCenter - lastCenter) <= tolerance) {
      last.push(rect);
    } else {
      lines.push([rect]);
    }
  }
  return lines.map((group) => {
    const left = Math.min(...group.map((r) => r.x));
    const top = Math.min(...group.map((r) => r.y));
    const right = Math.max(...group.map((r) => r.x + r.width));
    const bottom = Math.max(...group.map((r) => r.y + r.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
}

function splitLongParagraph(text: string): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+|\S[^.!?…]*$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (trimmed.length > MAX_CHUNK_CHARS) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      const words = trimmed.split(/\s+/);
      let buf = "";
      for (const word of words) {
        const next = buf ? `${buf} ${word}` : word;
        if (next.length > MAX_CHUNK_CHARS) {
          if (buf) chunks.push(buf);
          buf = word;
        } else {
          buf = next;
        }
      }
      if (buf) chunks.push(buf);
      continue;
    }

    const next = current ? `${current} ${trimmed}` : trimmed;
    if (next.length > MAX_CHUNK_CHARS) {
      if (current) chunks.push(current);
      current = trimmed;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function renderPdfThumbnail(fileUrl: string): Promise<string> {
  const pdfjs = await getPdfJs();
  const pdf = await pdfjs.getDocument(fileUrl).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const targetWidth = 320;
  const scale = targetWidth / baseViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se pudo crear la vista previa del PDF.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  }).promise;

  const thumbnail = canvas.toDataURL("image/jpeg", 0.84);

  page.cleanup();
  pdf.cleanup();
  canvas.width = 0;
  canvas.height = 0;

  return thumbnail;
}
