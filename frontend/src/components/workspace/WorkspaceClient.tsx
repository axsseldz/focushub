"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { API_BASE_URL, useAuthedFetch } from "@/lib/api";
import { PdfCanvas } from "@/lib/latex-render";
import { readSSE } from "@/lib/sse";
import { WorkspaceAssets } from "@/components/workspace/WorkspaceAssets";
import { WorkspaceChat } from "@/components/workspace/WorkspaceChat";
import { WorkspaceSettingsMenu } from "@/components/workspace/WorkspaceSettingsMenu";
import { LaTeXPeekEditor } from "@/components/workspace/LaTeXPeekEditor";
import type {
  SyncResponse,
  WorkspaceAsset,
  WorkspaceMessage,
  WorkspaceMode,
  WorkspacePhase,
  WorkspaceProjectDetail,
} from "@/types/workspace";

const UPLOADCARE_KEY = process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY;

type UploadedEntry = {
  cdnUrl: string;
  mimeType?: string;
  name: string;
};

// LaTeX command we care about — matches both ``\includegraphics{x}`` and
// ``\includegraphics[opts]{x}``. We don't try to parse the option block;
// we only need the filename in the braces.
const INCLUDEGRAPHICS_RE = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;

function findMissingImageReferences(
  latexSource: string,
  assets: WorkspaceAsset[],
): string[] {
  if (!latexSource) return [];
  const refs = new Set<string>();
  for (const match of latexSource.matchAll(INCLUDEGRAPHICS_RE)) {
    const ref = match[1].trim();
    if (ref) refs.add(ref);
  }
  if (refs.size === 0) return [];

  const exact = new Set<string>();
  const baseNames = new Set<string>();
  for (const a of assets) {
    exact.add(a.file_name);
    const dot = a.file_name.lastIndexOf(".");
    if (dot > 0) baseNames.add(a.file_name.slice(0, dot));
  }

  // Preserve insertion order so the banner lists missing refs in the
  // order they appear in the document.
  const missing: string[] = [];
  for (const ref of refs) {
    if (exact.has(ref)) continue;
    const refBase = ref.includes(".")
      ? ref.slice(0, ref.lastIndexOf("."))
      : ref;
    if (baseNames.has(refBase)) continue;
    missing.push(ref);
  }
  return missing;
}

export function WorkspaceClient({ projectId }: { projectId: string }) {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<WorkspaceProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<WorkspaceMode>("plan");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [phase, setPhase] = useState<WorkspacePhase | null>(null);
  const [peekOpen, setPeekOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [chatCollapsed, setChatCollapsed] = useState(false);

  // Compiled PDF state. ``pdfUrl`` is a blob URL the viewer consumes;
  // ``compileError`` carries the tail of the tectonic log when the
  // last compile attempt failed. ``compiling`` is true while a
  // /pdf request is in-flight (separate from ``sending`` which is the
  // chat stream).
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);

  // Keep the in-flight chat AbortController in a ref so the cancel
  // button can reach across renders without re-arming the effect.
  const abortRef = useRef<AbortController | null>(null);

  // Abort any in-flight stream on unmount so we don't leak the
  // connection (and so React doesn't warn about setState after unmount).
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Revoke the previous blob URL whenever a new one is set, and on
  // unmount, so we don't leak memory after each compile.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const compilePdf = useCallback(async () => {
    if (!project) return;
    setCompiling(true);
    setCompileError(null);
    try {
      const res = await authedFetch(
        `${API_BASE_URL}/workspace/projects/${project.id}/pdf`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        // The detail comes back as JSON when FastAPI throws HTTPException;
        // best-effort parse so we surface the tectonic log tail.
        let parsed = "";
        try {
          parsed = (JSON.parse(detail).detail as string) ?? detail;
        } catch {
          parsed = detail;
        }
        setCompileError(parsed || "No se pudo compilar el PDF.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : String(err));
    } finally {
      setCompiling(false);
    }
  }, [authedFetch, project]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authedFetch(
          `${API_BASE_URL}/workspace/projects/${projectId}`,
          { cache: "no-store" },
        );
        if (res.status === 404) {
          toast.error("Proyecto no encontrado.");
          router.push("/workspace");
          return;
        }
        if (!res.ok) throw new Error("No se pudo cargar el proyecto.");
        const data: WorkspaceProjectDetail = await res.json();
        if (!cancelled) {
          setProject(data);
          setTitleDraft(data.title);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, isLoaded, isSignedIn, projectId, router]);

  // Compile on initial load so the user sees the current state of the
  // doc as a real PDF, not a blank canvas.
  useEffect(() => {
    if (!project) return;
    // Run only once per project load; subsequent compiles happen
    // explicitly after Execute turns finish.
    void compilePdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!project) return;

      // Cancel any in-flight stream before starting a new one so we
      // don't end up with two assistant turns racing for the same chat.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSending(true);
      setStreamingText("");
      setPhase(mode === "execute" ? "thinking" : null);

      // Optimistic user turn — replaced once the backend emits the real
      // ``user_message`` event with its persisted id.
      const tempUserMsgId = -Date.now();
      const tempUserMsg: WorkspaceMessage = {
        id: tempUserMsgId,
        role: "user",
        mode,
        content: text,
        created_at: new Date().toISOString(),
      };
      setProject((curr) =>
        curr ? { ...curr, messages: [...curr.messages, tempUserMsg] } : curr,
      );

      let replyAcc = "";
      let executeFinished = false;

      try {
        const res = await authedFetch(
          `${API_BASE_URL}/workspace/projects/${project.id}/chat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text, mode }),
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          throw new Error(detail?.detail ?? "Error en el chat.");
        }

        for await (const event of readSSE(res, controller.signal)) {
          const type = event.type as string | undefined;
          if (type === "user_message") {
            const real = event.message as WorkspaceMessage;
            setProject((curr) =>
              curr
                ? {
                    ...curr,
                    messages: curr.messages.map((m) =>
                      m.id === tempUserMsgId ? real : m,
                    ),
                  }
                : curr,
            );
          } else if (type === "reply") {
            replyAcc += String(event.content ?? "");
            setStreamingText(replyAcc);
          } else if (type === "latex") {
            // We no longer render live LaTeX — we wait for ``done`` and
            // compile the final source server-side. Ignored on purpose.
          } else if (type === "phase") {
            const next = event.phase as WorkspacePhase | undefined;
            if (next) setPhase(next);
          } else if (type === "done") {
            const assistant = event.message as WorkspaceMessage;
            const latex = event.latex_source as string | null;
            setProject((curr) => {
              if (!curr) return curr;
              const next: WorkspaceProjectDetail = {
                ...curr,
                messages: [...curr.messages, assistant],
              };
              if (typeof latex === "string") {
                next.latex_source = latex;
              }
              return next;
            });
            // Trigger a real compile if the document changed.
            if (typeof latex === "string") {
              executeFinished = true;
            }
          } else if (type === "error") {
            throw new Error(String(event.message ?? "Error en el chat."));
          }
        }
      } catch (err) {
        const aborted =
          err instanceof DOMException && err.name === "AbortError";
        if (!aborted) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
        setProject((curr) =>
          curr
            ? {
                ...curr,
                messages: curr.messages.filter((m) => m.id !== tempUserMsgId),
              }
            : curr,
        );
      } finally {
        setSending(false);
        setStreamingText(null);
        setPhase(null);
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        // Fire the compile after we've cleared sending so the canvas
        // transitions from "building" (overlay shown) → "compiling"
        // (overlay still shown while the PDF arrives) → success.
        if (executeFinished) {
          void compilePdf();
        }
      }
    },
    [authedFetch, compilePdf, mode, project],
  );

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleSaveSource = useCallback(
    async (next: string) => {
      if (!project) return;
      try {
        const res = await authedFetch(
          `${API_BASE_URL}/workspace/projects/${project.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latex_source: next }),
          },
        );
        if (!res.ok) throw new Error("No se pudo guardar el documento.");
        setProject((curr) =>
          curr ? { ...curr, latex_source: next } : curr,
        );
        toast.success("Documento actualizado.");
        // Manual save also kicks a fresh compile.
        void compilePdf();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [authedFetch, compilePdf, project],
  );

  const handleUploadAssets = useCallback(
    async (entries: UploadedEntry[]) => {
      if (!project) return;
      for (const entry of entries) {
        try {
          const res = await authedFetch(
            `${API_BASE_URL}/workspace/projects/${project.id}/assets`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                file_name: entry.name,
                file_url: entry.cdnUrl,
                mime_type: entry.mimeType ?? null,
              }),
            },
          );
          if (!res.ok) throw new Error(`No se pudo guardar ${entry.name}.`);
          const asset: WorkspaceAsset = await res.json();
          setProject((curr) =>
            curr ? { ...curr, assets: [...curr.assets, asset] } : curr,
          );
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      }
    },
    [authedFetch, project],
  );

  const handleDeleteAsset = useCallback(
    async (assetId: number) => {
      if (!project) return;
      try {
        const res = await authedFetch(
          `${API_BASE_URL}/workspace/projects/${project.id}/assets/${assetId}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("No se pudo eliminar el asset.");
        setProject((curr) =>
          curr
            ? {
                ...curr,
                assets: curr.assets.filter((a) => a.id !== assetId),
              }
            : curr,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    },
    [authedFetch, project],
  );

  const handleSync = useCallback(async () => {
    if (!project) return;
    setSyncing(true);
    try {
      const res = await authedFetch(
        `${API_BASE_URL}/workspace/projects/${project.id}/sync-to-library`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          (detail?.detail as string) ?? "No se pudo guardar el PDF.",
        );
      }
      const data: SyncResponse = await res.json();
      setProject((curr) =>
        curr ? { ...curr, last_exported_file_id: data.file_id } : curr,
      );
      toast.success(`Guardado en tu biblioteca como ${data.file_name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }, [authedFetch, project]);

  const handleDownloadPdf = useCallback(() => {
    if (!pdfUrl || !project) {
      toast.error("El PDF aún no está listo.");
      return;
    }
    const a = document.createElement("a");
    a.href = pdfUrl;
    const safeTitle = (project.title || "reporte")
      .replace(/[^a-zA-Z0-9-_ ]+/g, "")
      .trim() || "reporte";
    a.download = `${safeTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfUrl, project]);

  const handleRenameProject = useCallback(async () => {
    if (!project) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === project.title) {
      setEditingTitle(false);
      setTitleDraft(project.title);
      return;
    }
    try {
      const res = await authedFetch(
        `${API_BASE_URL}/workspace/projects/${project.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmed }),
        },
      );
      if (!res.ok) throw new Error("No se pudo renombrar.");
      setProject((curr) => (curr ? { ...curr, title: trimmed } : curr));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setTitleDraft(project.title);
    } finally {
      setEditingTitle(false);
    }
  }, [authedFetch, project, titleDraft]);

  const messages = useMemo(() => project?.messages ?? [], [project?.messages]);
  const assets = useMemo(() => project?.assets ?? [], [project?.assets]);

  // Anything the document references via ``\includegraphics`` that no
  // longer exists in the asset list — typically because the user just
  // deleted it. Surfaced as a banner on the canvas so the stale PDF is
  // clearly marked as out-of-date.
  const missingAssets = useMemo(
    () => findMissingImageReferences(project?.latex_source ?? "", assets),
    [project?.latex_source, assets],
  );

  if (loading || !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-white text-sm text-slate-500 dark:bg-zinc-950 dark:text-zinc-400">
        Cargando workspace…
      </div>
    );
  }

  // The canvas is in "building" state any time we expect the PDF to
  // be replaced soon: while the chat stream is alive in Execute mode,
  // OR while the compile endpoint is fetching a fresh PDF.
  const building = (sending && mode === "execute") || compiling;

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-zinc-950">
      <WorkspaceAssets
        assets={assets}
        uploadcareKey={UPLOADCARE_KEY}
        onUpload={handleUploadAssets}
        onDelete={handleDeleteAsset}
      />

      <section className="flex min-w-0 min-h-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 px-6 py-3 dark:border-zinc-800/80">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/workspace")}
              aria-label="Volver al workspace"
              title="Volver al workspace"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
            >
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  d="M15 6 9 12l6 6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.9"
                />
              </svg>
              <span>Volver</span>
            </button>
            <div className="h-5 w-px bg-slate-200 dark:bg-zinc-700" />
            {editingTitle ? (
              <input
                value={titleDraft}
                autoFocus
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={handleRenameProject}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameProject();
                  if (e.key === "Escape") {
                    setTitleDraft(project.title);
                    setEditingTitle(false);
                  }
                }}
                className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-[14px] font-medium text-slate-900 outline-none focus:border-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
              />
            ) : (
              <button
                onClick={() => {
                  setTitleDraft(project.title);
                  setEditingTitle(true);
                }}
                className="group/title flex min-w-0 items-center gap-1.5 text-[14px] font-medium text-slate-900 transition-colors hover:text-slate-600 dark:text-zinc-50 dark:hover:text-zinc-300"
                title="Renombrar — el nombre se usa al guardar el PDF en tu biblioteca"
              >
                <span className="truncate">{project.title}</span>
                <svg
                  className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-colors group-hover/title:text-slate-500 dark:text-zinc-700 dark:group-hover/title:text-zinc-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M16.5 4.5l3 3M4.5 19.5l4-1 11-11-3-3-11 11-1 4Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void compilePdf()}
              disabled={compiling || sending}
              title="Volver a compilar el documento"
              aria-label="Compilar"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
            >
              {compiling ? (
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-slate-700 dark:border-zinc-600 dark:border-t-zinc-200"
                />
              ) : (
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M4.5 12a7.5 7.5 0 0 1 13.2-4.85M19.5 5v3.5h-3.5M19.5 12a7.5 7.5 0 0 1-13.2 4.85M4.5 19v-3.5H8"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
              )}
              <span>{compiling ? "Compilando" : "Compilar"}</span>
            </button>
            <WorkspaceSettingsMenu
              onShowCode={() => setPeekOpen(true)}
              onSyncToLibrary={handleSync}
              onDownloadPdf={handleDownloadPdf}
              syncing={syncing}
              compiling={compiling}
              pdfReady={!!pdfUrl}
            />
            <UserButton />
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <PdfCanvas
            pdfUrl={pdfUrl}
            building={building}
            errorDetail={compileError}
            missingAssets={missingAssets}
          />
        </div>
      </section>

      <WorkspaceChat
        messages={messages}
        mode={mode}
        onModeChange={setMode}
        onSend={handleSendMessage}
        onCancel={handleCancel}
        sending={sending}
        streamingText={streamingText}
        phase={phase}
        collapsed={chatCollapsed}
        onToggleCollapsed={() => setChatCollapsed((c) => !c)}
      />

      <LaTeXPeekEditor
        open={peekOpen}
        source={project.latex_source}
        onClose={() => setPeekOpen(false)}
        onSave={handleSaveSource}
      />
    </div>
  );
}
