"use client";

import { FileUploaderRegular } from "@uploadcare/react-uploader/next";
import type { UploadCtxProvider } from "@uploadcare/file-uploader";
import { motion } from "framer-motion";
import { useCallback, useRef } from "react";

type UploadSuccessEvent = {
  successEntries: Array<{
    cdnUrl: string;
    mimeType?: string;
    name: string;
  }>;
};

type UploadTileProps = {
  pubkey: string;
  isUploading: boolean;
  onUploadStart: () => void;
  onUploadFailed: () => void;
  onUploadSuccess: (event: UploadSuccessEvent) => void;
};

/**
 * Tile que vive como primer ítem del grid de libros y ofrece subir
 * un nuevo PDF. Replica el footprint de BookCard (thumbnail + dos
 * líneas de meta) para alinearse en altura con el resto.
 *
 * El widget de Uploadcare se monta oculto (un nodo de 0px sin
 * pointer-events) y disparamos su flujo de upload imperativamente
 * vía ``apiRef.current.api.initFlow()`` cuando el usuario clickea
 * el card. Así toda la superficie del tile es clickeable, no sólo
 * la zona donde el web component renderiza su botón por defecto.
 */
export function UploadTile({
  pubkey,
  isUploading,
  onUploadStart,
  onUploadFailed,
  onUploadSuccess,
}: UploadTileProps) {
  const apiRef = useRef<UploadCtxProvider | null>(null);

  const handleClick = useCallback(() => {
    if (isUploading) return;
    apiRef.current?.api?.initFlow();
  }, [isUploading]);

  return (
    <motion.article
      initial={false}
      whileHover={isUploading ? undefined : { y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className="group relative flex w-full flex-col text-left"
    >
      <motion.button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        aria-label="Subir un nuevo libro"
        whileTap={isUploading ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className={`relative block aspect-[3/4] w-full overflow-hidden rounded-xl border-2 border-dashed transition-[border-color,background-color] duration-200 ${
          isUploading
            ? "cursor-wait border-slate-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900"
            : "cursor-pointer border-slate-200 bg-slate-50/60 group-hover:border-slate-900 group-hover:bg-slate-100/70 dark:border-zinc-700 dark:bg-zinc-900/40 dark:group-hover:border-zinc-300 dark:group-hover:bg-zinc-900"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 transition-colors duration-200 group-hover:text-slate-900 dark:text-zinc-400 dark:group-hover:text-zinc-100">
          {isUploading ? (
            <Spinner />
          ) : (
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 360, damping: 22 }}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition-colors duration-200 group-hover:border-slate-900 group-hover:bg-slate-900 group-hover:text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:group-hover:border-zinc-100 dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900"
            >
              <PlusIcon />
            </motion.span>
          )}
          <span className="text-[12px] font-medium tracking-[-0.01em]">
            {isUploading ? "Subiendo…" : "Subir libro"}
          </span>
        </div>
      </motion.button>

      {/* Meta debajo — mantiene la alineación de altura con los
          BookCard del grid. */}
      <div className="mt-3.5 space-y-1.5">
        <h3 className="text-[14px] font-semibold leading-snug tracking-[-0.025em] text-slate-950 dark:text-zinc-50">
          Agregar libro
        </h3>
        <p className="text-[12px] font-medium text-slate-500 dark:text-zinc-500">
          PDF · hasta 50 MB
        </p>
      </div>

      {/* Uploadcare widget — fuera de vista pero NO con
          ``pointer-events-none``: esa propiedad CSS se hereda, y se
          propagaría al ``<dialog>`` modal que abre ``initFlow()``,
          dejándolo visible pero inerte (no se podrían clickear las
          fuentes ni elegir archivo). Lo escondemos posicionándolo
          fuera del viewport con tamaño 0; el modal, al usar
          ``showModal()`` nativo, se renderiza en la top-layer del
          navegador y queda visible/interactivo. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden opacity-0"
      >
        <FileUploaderRegular
          apiRef={apiRef}
          pubkey={pubkey}
          sourceList="local, gdrive, dropbox"
          classNameUploader="uc-light reading-mode-uploader"
          imgOnly={false}
          accept="application/pdf,.pdf"
          multiple={false}
          onCommonUploadStart={onUploadStart}
          onCommonUploadFailed={onUploadFailed}
          onCommonUploadSuccess={onUploadSuccess}
        />
      </div>
    </motion.article>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 5.5v13M5.5 12h13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700 dark:border-zinc-700 dark:border-t-zinc-200"
    />
  );
}
