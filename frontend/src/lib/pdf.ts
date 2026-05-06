"use client";

let workerConfigured = false;
const pdfDocumentCache = new Map<string, Promise<PdfDocumentLike>>();

// ---------------------------------------------------------------------------
// Internal types (structural interface so pdfjs types do not bleed out)
// ---------------------------------------------------------------------------

type PdfDocumentLike = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageLike>;
  cleanup: () => void;
};

type PdfPageLike = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: unknown[] }>;
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
  cleanup: () => void;
};

type RawTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

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

async function getPdfDocument(fileUrl: string): Promise<PdfDocumentLike> {
  const cached = pdfDocumentCache.get(fileUrl);
  if (cached) return cached;

  const promise = getPdfJs().then(
    (pdfjs) =>
      pdfjs.getDocument(fileUrl).promise as unknown as Promise<PdfDocumentLike>,
  );

  pdfDocumentCache.set(fileUrl, promise);
  return promise;
}

function isRawTextItem(item: unknown): item is RawTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as RawTextItem).str === "string" &&
    "transform" in item &&
    Array.isArray((item as RawTextItem).transform) &&
    (item as RawTextItem).transform.length >= 6
  );
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PdfParagraphCrop = {
  id: string;
  dataUrl: string;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getPdfPageCount(fileUrl: string): Promise<number> {
  const pdf = await getPdfDocument(fileUrl);
  return pdf.numPages;
}

export async function extractPdfPageParagraphCrops(
  fileUrl: string,
  pageNumber: number,
  renderScale = 2.5,
  paddingPx = 28,
): Promise<PdfParagraphCrop[]> {
  const pdf = await getPdfDocument(fileUrl);
  const page = await pdf.getPage(pageNumber);

  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: renderScale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    page.cleanup();
    return [];
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  const textContent = await page.getTextContent();
  page.cleanup();

  const pageH = baseViewport.height;
  const canvasH = canvas.height;
  const canvasW = canvas.width;

  type CanvasBBox = { left: number; top: number; right: number; bottom: number };

  const bboxes: CanvasBBox[] = textContent.items
    .filter(isRawTextItem)
    .filter((item) => item.str.trim().length > 0)
    .map((item) => {
      const pdfX = item.transform[4];
      const pdfY = item.transform[5];
      const pdfH = Math.abs(item.height) || Math.abs(item.transform[0]) || 12;
      const pdfW = Math.abs(item.width) || pdfH;

      return {
        left: pdfX * renderScale,
        top: (pageH - pdfY - pdfH) * renderScale,
        right: (pdfX + pdfW) * renderScale,
        bottom: (pageH - pdfY) * renderScale,
      };
    })
    .filter((b) => b.right > b.left && b.bottom > b.top);

  if (bboxes.length === 0) {
    canvas.width = 0;
    canvas.height = 0;
    return [];
  }

  bboxes.sort((a, b) => {
    const dy = a.top - b.top;
    return Math.abs(dy) > 4 ? dy : a.left - b.left;
  });

  const colLeft = Math.min(...bboxes.map((b) => b.left));
  const colRight = Math.max(...bboxes.map((b) => b.right));
  const colWidth = colRight - colLeft;

  // ---------------------------------------------------------------------------
  // Build horizontal lines, tracking their horizontal extent too
  // ---------------------------------------------------------------------------
  type Line = {
    top: number;
    bottom: number;
    lineLeft: number;
    lineRight: number;
  };
  const lines: Line[] = [];

  for (const bbox of bboxes) {
    const prev = lines[lines.length - 1];
    const overlap = prev
      ? Math.min(bbox.bottom, prev.bottom) - Math.max(bbox.top, prev.top)
      : -1;
    const isSameLine = prev && overlap > (bbox.bottom - bbox.top) * 0.3;

    if (!prev || !isSameLine) {
      lines.push({
        top: bbox.top,
        bottom: bbox.bottom,
        lineLeft: bbox.left,
        lineRight: bbox.right,
      });
    } else {
      prev.top = Math.min(prev.top, bbox.top);
      prev.bottom = Math.max(prev.bottom, bbox.bottom);
      prev.lineLeft = Math.min(prev.lineLeft, bbox.left);
      prev.lineRight = Math.max(prev.lineRight, bbox.right);
    }
  }

  if (lines.length === 0) {
    canvas.width = 0;
    canvas.height = 0;
    return [];
  }

  // ---------------------------------------------------------------------------
  // Sparse page detection: portadas, páginas de título, separadores de parte.
  // Si la página tiene pocas líneas de texto la devolvemos como un único bloque
  // para no recortarla en fragmentos sin sentido.
  // ---------------------------------------------------------------------------
  const SPARSE_LINE_THRESHOLD = 6;

  const makeSingleCrop = (
    topY: number,
    bottomY: number,
  ): PdfParagraphCrop | null => {
    const cx = Math.max(0, colLeft - paddingPx);
    const cxEnd = Math.min(canvasW, colRight + paddingPx);
    const cw = cxEnd - cx;
    const cy = Math.max(0, topY - paddingPx);
    const cyEnd = Math.min(canvasH, bottomY + paddingPx);
    const ch = cyEnd - cy;
    if (cw <= 0 || ch <= 0) return null;
    const cc = document.createElement("canvas");
    cc.width = cw;
    cc.height = ch;
    const cctx = cc.getContext("2d");
    if (!cctx) return null;
    cctx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    const result: PdfParagraphCrop = {
      id: "para-1",
      dataUrl: cc.toDataURL("image/jpeg", 0.95),
    };
    cc.width = 0;
    cc.height = 0;
    return result;
  };

  if (lines.length < SPARSE_LINE_THRESHOLD) {
    const single = makeSingleCrop(lines[0].top, lines[lines.length - 1].bottom);
    canvas.width = 0;
    canvas.height = 0;
    return single ? [single] : [];
  }

  // ---------------------------------------------------------------------------
  // Median body-text line height — used to detect titles and footnotes
  // ---------------------------------------------------------------------------
  const medianBodyH = (() => {
    const hs = lines.map((l) => l.bottom - l.top).sort((a, b) => a - b);
    return hs[Math.floor(hs.length / 2)] || 14;
  })();

  // ---------------------------------------------------------------------------
  // Group consecutive lines into paragraph blocks
  // ---------------------------------------------------------------------------
  const rawGroups: Line[][] = [];
  let current: Line[] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    const gap = curr.top - prev.bottom;
    const lineH = prev.bottom - prev.top;

    if (gap > lineH * 0.8) {
      rawGroups.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  rawGroups.push(current);

  // ---------------------------------------------------------------------------
  // Post-process groups:
  //   1. Discard isolated narrow groups at extreme top/bottom (page numbers,
  //      running headers/footers).
  //   2. Merge title-only groups (≤2 tall lines) into the next group so that
  //      chapter titles appear together with the first paragraph.
  // ---------------------------------------------------------------------------
  const isHeaderFooter = (group: Line[]): boolean => {
    if (group.length > 2) return false;
    const groupTop = group[0].top;
    const groupBottom = group[group.length - 1].bottom;
    const atEdge =
      groupTop < canvasH * 0.10 || groupBottom > canvasH * 0.92;
    const isNarrow = group.every(
      (l) => l.lineRight - l.lineLeft < colWidth * 0.40,
    );
    return atEdge && isNarrow;
  };

  const isTitleGroup = (group: Line[]): boolean => {
    if (group.length > 2) return false;
    return group.every((l) => l.bottom - l.top > medianBodyH * 1.25);
  };

  // First pass: strip headers/footers
  const withoutEdges = rawGroups.filter((g) => !isHeaderFooter(g));

  // Second pass: merge title groups forward
  const mergedGroups: Line[][] = [];
  let i = 0;
  while (i < withoutEdges.length) {
    const group = withoutEdges[i];
    if (isTitleGroup(group) && i < withoutEdges.length - 1) {
      // Merge: title lines come first (they're already above the next group)
      mergedGroups.push([...group, ...withoutEdges[i + 1]]);
      i += 2;
    } else {
      mergedGroups.push(group);
      i += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Crop the canvas once per final group
  // ---------------------------------------------------------------------------
  const cropX = Math.max(0, colLeft - paddingPx);
  const cropEndX = Math.min(canvasW, colRight + paddingPx);
  const cropW = cropEndX - cropX;

  if (cropW <= 0) {
    canvas.width = 0;
    canvas.height = 0;
    return [];
  }

  const crops: PdfParagraphCrop[] = [];

  for (const group of mergedGroups) {
    const top = group[0].top;
    const bottom = group[group.length - 1].bottom;

    const cropY = Math.max(0, top - paddingPx * 0.75);
    const cropEndY = Math.min(canvasH, bottom + paddingPx * 0.75);
    const cropH = cropEndY - cropY;

    if (cropH <= 0) continue;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");

    if (!cropCtx) continue;

    cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    crops.push({
      id: `para-${crops.length + 1}`,
      dataUrl: cropCanvas.toDataURL("image/jpeg", 0.95),
    });

    cropCanvas.width = 0;
    cropCanvas.height = 0;
  }

  canvas.width = 0;
  canvas.height = 0;

  return crops;
}

export async function renderPdfThumbnail(fileUrl: string): Promise<string> {
  const pdf = await getPdfDocument(fileUrl);
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

  await page.render({ canvas, canvasContext: context, viewport }).promise;

  const thumbnail = canvas.toDataURL("image/jpeg", 0.84);

  page.cleanup();
  canvas.width = 0;
  canvas.height = 0;

  return thumbnail;
}
