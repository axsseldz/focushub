"use client";

import { FileUploaderRegular } from "@uploadcare/react-uploader";
import "@uploadcare/react-uploader/core.css";
import { toast } from "sonner";
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
};

export function WorkspaceAssets({
  assets,
  uploadcareKey,
  onUpload,
  onDelete,
}: Props) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200/70 bg-slate-50/50 dark:border-zinc-800/80 dark:bg-zinc-950/70">
      <header className="border-b border-slate-200/60 px-4 py-3 dark:border-zinc-800/70">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
          Assets
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400 dark:text-zinc-500">
          Sube imágenes y documentos. The Architect los puede insertar por
          nombre.
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {assets.length === 0 ? (
          <p className="px-1 text-[11.5px] text-slate-400 dark:text-zinc-600">
            Aún no hay assets.
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
                    onClick={() => {
                      if (confirm(`¿Eliminar ${a.file_name}?`)) {
                        void onDelete(a.id);
                      }
                    }}
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

      <div className="border-t border-slate-200/60 p-3 dark:border-zinc-800/70">
        {uploadcareKey ? (
          <FileUploaderRegular
            pubkey={uploadcareKey}
            multiple
            classNameUploader="reading-mode-uploader"
            onChange={(event) => {
              const entries = (event as UploadSuccessEvent).successEntries;
              if (entries?.length) {
                void onUpload(entries);
              }
            }}
          />
        ) : (
          <p className="text-[11px] text-rose-500">
            Configura NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY.
          </p>
        )}
      </div>
    </aside>
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

// Helper exported for the parent component so it can update Uploadcare's
// expected toast format consistently with the reading-mode upload flow.
export function showUploadError(message: string) {
  toast.error(message);
}
