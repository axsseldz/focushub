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
