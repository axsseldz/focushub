"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Sidebar } from "@/components/dashboard/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserButton } from "@clerk/nextjs";
import { API_BASE_URL, useAuthedFetch } from "@/lib/api";
import type { WorkspaceProject } from "@/types/workspace";

export function WorkspaceListClient() {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authedFetch(
          `${API_BASE_URL}/workspace/projects`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("No se pudo cargar tus proyectos.");
        const data: WorkspaceProject[] = await res.json();
        if (!cancelled) setProjects(data);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch, isLoaded, isSignedIn]);

  const deleteProject = useCallback(
    async (project: WorkspaceProject) => {
      const ok = confirm(
        `¿Eliminar «${project.title}»? Esta acción no se puede deshacer.`,
      );
      if (!ok) return;
      setDeletingId(project.id);
      try {
        const res = await authedFetch(
          `${API_BASE_URL}/workspace/projects/${project.id}`,
          { method: "DELETE" },
        );
        if (!res.ok && res.status !== 204) {
          throw new Error("No se pudo eliminar el proyecto.");
        }
        setProjects((curr) => curr.filter((p) => p.id !== project.id));
        toast.success("Proyecto eliminado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setDeletingId(null);
      }
    },
    [authedFetch],
  );

  const createProject = useCallback(async () => {
    setCreating(true);
    try {
      const res = await authedFetch(`${API_BASE_URL}/workspace/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Documento sin título" }),
      });
      if (!res.ok) throw new Error("No se pudo crear el proyecto.");
      const project: WorkspaceProject = await res.json();
      router.push(`/workspace/${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }, [authedFetch, router]);

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.title.toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-end gap-2 border-b border-slate-200/70 bg-white/85 px-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 sm:px-10">
          <ThemeToggle />
          <UserButton appearance={{ elements: { userButtonAvatarBox: "h-7 w-7" } }} />
        </header>

        <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 sm:py-10">
          {/* Hero */}
          <section className="flex flex-col gap-4">
            <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.045em] text-slate-950 dark:text-zinc-50 sm:text-[36px]">
              Workspace
            </h1>
            <p className="max-w-xl text-[14px] leading-6 text-slate-500 dark:text-zinc-400">
              Documentos LaTeX co-escritos con The Architect. Compila a PDF
              real con un click.
            </p>
          </section>

          {/* Action bar */}
          <section className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex h-10 w-full max-w-sm items-center overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-slate-400 focus-within:shadow-[0_0_0_4px_rgba(15,23,42,0.06)] dark:border-zinc-700 dark:bg-zinc-900">
              <span className="flex h-full items-center pl-3 text-slate-400 dark:text-zinc-500">
                <SearchIcon />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar proyectos…"
                aria-label="Buscar proyectos"
                className="h-full flex-1 bg-transparent px-2.5 text-[13.5px] text-slate-900 placeholder:text-slate-400 outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
              />
            </div>

            <button
              onClick={createProject}
              disabled={creating}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
            >
              <PlusIcon />
              {creating ? "Creando…" : "Nuevo proyecto"}
            </button>
          </section>

          {/* List */}
          <section className="mt-8 border-t border-slate-100 pt-8 dark:border-zinc-800/70">
            {loading ? (
              <ProjectGridSkeleton />
            ) : projects.length === 0 ? (
              <EmptyState onCreate={createProject} creating={creating} />
            ) : filteredProjects.length === 0 ? (
              <p className="py-12 text-center text-[13.5px] text-slate-500 dark:text-zinc-400">
                Ningún proyecto coincide con «{query}».
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={() => deleteProject(project)}
                    isDeleting={deletingId === project.id}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

function ProjectCard({
  project,
  onDelete,
  isDeleting,
}: {
  project: WorkspaceProject;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const updated = new Date(project.updated_at);
  return (
    <li className="group relative">
      <a
        href={`/workspace/${project.id}`}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_44px_-22px_rgba(15,23,42,0.18)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:shadow-[0_18px_44px_-22px_rgba(0,0,0,0.6)]"
      >
        {/* Paper-style preview strip */}
        <div className="relative h-28 overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white dark:border-zinc-900 dark:from-zinc-900 dark:to-zinc-950">
          <div className="absolute inset-x-6 top-5 space-y-1.5 opacity-60">
            <div className="h-2 w-1/2 rounded bg-slate-200 dark:bg-zinc-700" />
            <div className="h-1.5 w-3/4 rounded bg-slate-200/80 dark:bg-zinc-800" />
            <div className="h-1.5 w-2/3 rounded bg-slate-200/80 dark:bg-zinc-800" />
            <div className="h-1.5 w-4/5 rounded bg-slate-200/80 dark:bg-zinc-800" />
          </div>
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/90 dark:text-zinc-400">
            <DocumentIcon />
            LaTeX
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2 px-5 py-4">
          <h3 className="line-clamp-2 text-[14.5px] font-semibold tracking-[-0.015em] text-slate-900 dark:text-zinc-50">
            {project.title}
          </h3>
          <p className="mt-auto text-[11.5px] text-slate-400 dark:text-zinc-500">
            Editado {formatRelative(updated)}
          </p>
        </div>
      </a>

      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={`Eliminar ${project.title}`}
        title="Eliminar"
        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/85 text-slate-400 opacity-0 shadow-sm backdrop-blur-sm transition hover:text-rose-500 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50 dark:bg-zinc-900/85 dark:text-zinc-500 dark:hover:text-rose-400"
      >
        {isDeleting ? (
          <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
        ) : (
          <TrashIcon />
        )}
      </button>
    </li>
  );
}

function EmptyState({
  onCreate,
  creating,
}: {
  onCreate: () => void;
  creating: boolean;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/40 px-8 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm dark:bg-zinc-900 dark:text-zinc-400">
        <DocumentIcon large />
      </div>
      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-zinc-50">
        Aún no tienes documentos.
      </h3>
      <p className="mt-1 max-w-xs text-[13px] text-slate-500 dark:text-zinc-400">
        Crea uno y pídele estructura a The Architect. Compilará el PDF por ti.
      </p>
      <button
        onClick={onCreate}
        disabled={creating}
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950"
      >
        <PlusIcon />
        {creating ? "Creando…" : "Crear mi primer proyecto"}
      </button>
    </div>
  );
}

function ProjectGridSkeleton() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="h-28 animate-pulse bg-slate-100 dark:bg-zinc-900" />
          <div className="space-y-2 px-5 py-4">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * "Editado hace 3 días" — short, friendly. We bucket by day rather
 * than minute/hour since project list updates aren't that frequent.
 */
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "hace unos segundos";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m20 20-3.5-3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function DocumentIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={large ? "h-5 w-5" : "h-3 w-3"}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M6 4h7l5 5v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm7 0v5h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
