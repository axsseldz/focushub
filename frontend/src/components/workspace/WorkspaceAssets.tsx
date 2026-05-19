"use client";

import { FileUploaderRegular } from "@uploadcare/react-uploader";
import type { UploadCtxProvider } from "@uploadcare/file-uploader";
import "@uploadcare/react-uploader/core.css";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { WorkspaceAsset } from "@/types/workspace";

type UploadedEntry = {
  cdnUrl: string;
  mimeType?: string;
  name: string;
};

type UploadSuccessEvent = {
  successEntries: UploadedEntry[];
};

type Props = {
  assets: WorkspaceAsset[];
  uploadcareKey: string | undefined;
  onUpload: (entries: UploadedEntry[]) => Promise<void>;
  onDelete: (assetId: number) => Promise<void>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function WorkspaceAssets({
  assets,
  uploadcareKey,
  onUpload,
  onDelete,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const apiRef = useRef<UploadCtxProvider | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<WorkspaceAsset | null>(
    null,
  );

  const openUploadFlow = useCallback(() => {
    apiRef.current?.api?.initFlow();
  }, []);

  return (
    <>
      <ConfirmDialog
        open={assetToDelete !== null}
        title="¿Eliminar este recurso?"
        description={
          assetToDelete
            ? `«${assetToDelete.file_name}» se eliminará permanentemente del proyecto.`
            : ""
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (assetToDelete) {
            void onDelete(assetToDelete.id);
            setAssetToDelete(null);
          }
        }}
        onCancel={() => setAssetToDelete(null)}
      />

      <AnimatePresence mode="wait">
        {collapsed ? (
          <CollapsedAssetsLauncher
            key="assets-launcher"
            assetCount={assets.length}
            onClick={onToggleCollapsed}
          />
        ) : (
          <motion.aside
            key="assets-panel"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200/70 bg-slate-50/50 dark:border-zinc-800/80 dark:bg-zinc-950/70"
          >
            <header className="border-b border-slate-200/60 px-4 py-3 dark:border-zinc-800/70">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
                    Recursos
                    {assets.length > 0 ? (
                      <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-semibold tabular-nums text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {assets.length}
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400 dark:text-zinc-500">
                    Imágenes y documentos del proyecto.
                  </p>
                </div>
                <CollapseToggleButton
                  direction="left"
                  label="Ocultar recursos"
                  onClick={onToggleCollapsed}
                />
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {assets.length === 0 ? (
                <p className="px-1 text-[11.5px] text-slate-400 dark:text-zinc-600">
                  Aún no hay recursos cargados.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {assets.map((a) => (
                    <li key={a.id}>
                      <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-zinc-900">
                        <FileIcon mime={a.mime_type} />
                        <span
                          className="flex-1 truncate text-[12.5px] text-slate-700 dark:text-zinc-200"
                          title={a.file_name}
                        >
                          {a.file_name}
                        </span>
                        <button
                          onClick={() => setAssetToDelete(a)}
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label="Eliminar"
                        >
                          <svg
                            className="h-3.5 w-3.5 text-slate-400 hover:text-rose-500 dark:text-zinc-500"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M6 6l12 12M6 18L18 6"
                              stroke="currentColor"
                              strokeLinecap="round"
                              strokeWidth="1.8"
                            />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-center border-t border-slate-200/60 p-4 dark:border-zinc-800/70">
              {uploadcareKey ? (
                <>
                  <button
                    type="button"
                    onClick={openUploadFlow}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_4px_14px_rgba(15,23,42,0.12)] transition-all hover:opacity-90 active:scale-[0.98] dark:bg-zinc-50 dark:text-zinc-900"
                  >
                    <UploadIcon />
                    Subir archivos
                  </button>
                  <div
                    aria-hidden="true"
                    className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden opacity-0"
                  >
                    <FileUploaderRegular
                      apiRef={apiRef}
                      pubkey={uploadcareKey}
                      multiple
                      classNameUploader="reading-mode-uploader"
                      onCommonUploadSuccess={(event) => {
                        const entries = (event as UploadSuccessEvent)
                          .successEntries;
                        if (entries?.length) {
                          void onUpload(entries);
                        }
                      }}
                    />
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-rose-500">
                  Configura NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY.
                </p>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Collapsed launcher — floating pill anchored to the left edge.
// ---------------------------------------------------------------------------

function CollapsedAssetsLauncher({
  assetCount,
  onClick,
}: {
  assetCount: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -60, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
      aria-label="Mostrar recursos"
      title="Mostrar recursos"
      className="group fixed left-5 top-1/2 z-30 inline-flex h-14 -translate-y-1/2 items-center gap-2.5 rounded-full border border-slate-200 bg-white pl-3 pr-5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] transition-all hover:shadow-[0_12px_38px_rgba(15,23,42,0.18)] dark:border-zinc-800 dark:bg-zinc-900"
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:from-zinc-200 dark:to-zinc-50 dark:text-zinc-900">
        <FolderIcon />
        {assetCount > 0 ? (
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9.5px] font-semibold text-white ring-2 ring-white dark:ring-zinc-900">
            {assetCount}
          </span>
        ) : null}
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[12px] font-semibold text-slate-900 dark:text-zinc-50">
          Recursos
        </span>
        <span className="text-[10.5px] text-slate-500 dark:text-zinc-400">
          {assetCount === 0
            ? "Subir archivos"
            : `${assetCount} ${assetCount === 1 ? "archivo" : "archivos"}`}
        </span>
      </span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Shared collapse toggle — used by both sidebars so the affordance is
// instantly recognisable. Pill button with chevron + label that animates
// in on hover.
// ---------------------------------------------------------------------------

export function CollapseToggleButton({
  direction,
  label,
  onClick,
}: {
  direction: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  const chevron =
    direction === "left" ? (
      <ChevronLeftIcon />
    ) : (
      <ChevronRightIcon />
    );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group/collapse -mr-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-slate-300 hover:bg-slate-50 hover:px-2.5 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {chevron}
      <span className="hidden text-[11px] font-medium group-hover/collapse:inline">
        Ocultar
      </span>
    </button>
  );
}

function FileIcon({ mime }: { mime: string | null }) {
  const isImage = mime?.startsWith("image/");
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500"
      fill="none"
      viewBox="0 0 24 24"
    >
      {isImage ? (
        <path
          d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-13Zm2.5 9.5L9 12l2.5 3 3.5-4.5 4 5.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      ) : (
        <path
          d="M6 4h7l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm7 0v5h5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 4v11m0-11 4 4m-4-4-4 4M5 20h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="m15 6-6 6 6 6"
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
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-11Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

// Helper exported for the parent component so it can update Uploadcare's
// expected toast format consistently with the reading-mode upload flow.
export function showUploadError(message: string) {
  toast.error(message);
}
