"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { renderPdfThumbnail } from "@/lib/pdf";

type PdfThumbnailProps = {
  fileUrl: string;
  filename: string;
  thumbnailUrl: string | null;
};

export function PdfThumbnail({
  fileUrl,
  filename,
  thumbnailUrl,
}: PdfThumbnailProps) {
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!thumbnailUrl);

  useEffect(() => {
    let cancelled = false;

    if (thumbnailUrl) {
      return;
    }

    renderPdfThumbnail(fileUrl)
      .then((generatedThumbnail) => {
        if (!cancelled) {
          setGeneratedPreview(generatedThumbnail);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setGeneratedPreview(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fileUrl, thumbnailUrl]);

  const previewSrc = thumbnailUrl ?? generatedPreview;

  return (
    <div className="relative aspect-3/4 overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-[linear-gradient(180deg,#f8fafc,#eef2f7)] p-2 dark:border-zinc-700 dark:bg-zinc-800 dark:[background-image:none]">
      {isLoading ? (
        <div className="absolute inset-2 animate-pulse rounded-2xl bg-[linear-gradient(180deg,#f8fafc,#eef2f7)] dark:bg-zinc-700 dark:[background-image:none]" />
      ) : null}

      {previewSrc ? (
        <motion.div
          initial={{ opacity: 0.4, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="absolute inset-2 overflow-hidden rounded-2xl shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
        >
          <Image
            alt={`Vista previa de ${filename}`}
            src={previewSrc}
            fill
            unoptimized={previewSrc.startsWith("data:")}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </motion.div>
      ) : null}

      {!isLoading && !previewSrc ? (
        <div className="absolute inset-2 flex items-center justify-center rounded-2xl bg-slate-100 text-sm font-medium text-slate-400 dark:bg-zinc-700 dark:text-zinc-500">
          PDF
        </div>
      ) : null}
    </div>
  );
}
