"use client";

import "@uploadcare/react-uploader/core.css";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Manrope } from "next/font/google";
import { UserButton, useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { BooksLibrary } from "@/components/reading-mode/BooksLibrary";
import { BookOpenDialog } from "@/components/reading-mode/BookOpenDialog";
import { PdfReader } from "@/components/reading-mode/PdfReader";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { renderPdfThumbnail } from "@/lib/pdf";
import { API_BASE_URL, useAuthedFetch } from "@/lib/api";
import { markBookOpened, sortBooksByLastOpened } from "@/lib/last-opened";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { Book, StoredFile } from "@/types/book";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

type UploadedEntry = {
  cdnUrl: string;
  mimeType?: string;
  name: string;
};

type UploadSuccessEvent = {
  successEntries: UploadedEntry[];
};

function mapStoredFileToBook(file: StoredFile): Book {
  return {
    id: String(file.id),
    filename: file.file_name,
    displayName: file.display_name,
    fileUrl: file.file_url,
    thumbnailUrl: file.thumbnail_url,
    pageCount: file.page_count ?? null,
    uploadedAt: file.created_at,
  };
}

function readLastPage(bookId: string): number {
  if (typeof window === "undefined") return 1;
  const raw = window.localStorage.getItem(`focushub:lastPage:${bookId}`);
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

type LibraryStats = {
  total: number;
  inProgress: number;
};

function computeStats(books: Book[]): LibraryStats {
  let inProgress = 0;
  for (const book of books) {
    const total = book.pageCount ?? 0;
    if (total <= 0) continue;
    const last = readLastPage(book.id);
    if (last <= 1) continue;
    if (last < total) inProgress += 1;
  }
  return { total: books.length, inProgress };
}

export function ReadingModeClient() {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [deletingBookId, setDeletingBookId] = useState<string | null>(null);
  const [renamingBookId, setRenamingBookId] = useState<string | null>(null);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  // Libro que el usuario clickeó pero aún no decidió en qué modo
  // abrirlo. Mientras este valor exista, se muestra el BookOpenDialog.
  const [pendingBook, setPendingBook] = useState<Book | null>(null);
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const loadBooks = async () => {
      try {
        const response = await authedFetch(`${API_BASE_URL}/files`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No se pudo cargar la biblioteca.");
        const storedFiles: StoredFile[] = await response.json();
        const pdfBooks = storedFiles
          .filter((file) => file.file_name.toLowerCase().endsWith(".pdf"))
          .map(mapStoredFileToBook);
        setBooks(sortBooksByLastOpened(pdfBooks, userId));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "No se pudo cargar la biblioteca.",
        );
      } finally {
        setIsLoadingBooks(false);
      }
    };

    void loadBooks();
  }, [authedFetch, isLoaded, isSignedIn, userId]);

  const handleUpload = async (event: UploadSuccessEvent) => {
    const uploadedFile = event.successEntries[0];
    if (!uploadedFile) {
      toast.error("No se pudo obtener la información del archivo.");
      return;
    }
    const isPdf =
      uploadedFile.mimeType === "application/pdf" ||
      uploadedFile.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Solo se permiten archivos PDF en Modo Lectura.");
      return;
    }

    setIsUploading(true);
    try {
      const thumbnailUrl = await renderPdfThumbnail(uploadedFile.cdnUrl);
      const response = await authedFetch(`${API_BASE_URL}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: uploadedFile.cdnUrl,
          file_name: uploadedFile.name,
          thumbnail_url: thumbnailUrl,
        }),
      });
      if (!response.ok) throw new Error("No se pudo guardar el libro en el backend.");

      const savedFile: StoredFile = await response.json();
      const savedBook = mapStoredFileToBook(savedFile);
      markBookOpened(userId, savedBook.id);
      setBooks((current) => sortBooksByLastOpened([savedBook, ...current], userId));
      setSelectedBook(savedBook);
      toast.success("Libro agregado a tu biblioteca.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ocurrió un error al subir el libro.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleRenameBook = async (book: Book, nextTitle: string) => {
    const trimmed = nextTitle.trim();
    const currentTitle = book.displayName ?? book.filename;
    if (!trimmed || trimmed === currentTitle) return;

    setRenamingBookId(book.id);
    try {
      const response = await authedFetch(`${API_BASE_URL}/files/${book.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: trimmed }),
      });
      if (!response.ok) throw new Error("No se pudo actualizar el título.");
      const updatedFile: StoredFile = await response.json();
      const updatedBook = mapStoredFileToBook(updatedFile);
      setBooks((current) =>
        current.map((b) => (b.id === book.id ? updatedBook : b)),
      );
      setSelectedBook((current) => (current?.id === book.id ? updatedBook : current));
      toast.success("Título actualizado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ocurrió un error al actualizar el título.",
      );
    } finally {
      setRenamingBookId(null);
    }
  };

  const handleDeleteBook = async (book: Book) => {
    setDeletingBookId(book.id);
    try {
      const response = await authedFetch(`${API_BASE_URL}/files/${book.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("No se pudo eliminar el libro.");
      setBooks((current) => current.filter((b) => b.id !== book.id));
      if (selectedBook?.id === book.id) setSelectedBook(null);
      toast.success("Libro eliminado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ocurrió un error al eliminar el libro.",
      );
    } finally {
      setDeletingBookId(null);
    }
  };

  // Stats derivadas — recalcadas en cada render. Cuesta nada (es
  // un loop por la lista de libros) y se mantiene fresco cuando el
  // usuario vuelve al lector (selectedBook flip dispara render).
  const stats = useMemo(
    () => (selectedBook ? null : computeStats(books)),
    [books, selectedBook],
  );

  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return books;
    return books.filter((book) =>
      (book.displayName ?? book.filename).toLowerCase().includes(q),
    );
  }, [books, searchQuery]);

  // Reader full-screen.
  if (selectedBook) {
    return (
      <main
        className={`${manrope.className} min-h-screen bg-white text-slate-950 dark:bg-zinc-950 dark:text-zinc-50`}
      >
        <ConfirmDialog
          open={bookToDelete !== null}
          title="¿Eliminar este libro?"
          description="Esta acción no se puede deshacer. El libro será eliminado permanentemente de tu biblioteca."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={() => {
            if (bookToDelete) {
              void handleDeleteBook(bookToDelete);
              setBookToDelete(null);
            }
          }}
          onCancel={() => setBookToDelete(null)}
        />
        <PdfReader
          key={selectedBook.id}
          book={selectedBook}
          onBack={() => setSelectedBook(null)}
          onPageCountResolved={(pageCount) => {
            setBooks((current) =>
              current.map((b) =>
                b.id === selectedBook.id ? { ...b, pageCount } : b,
              ),
            );
            setSelectedBook((current) =>
              current && current.id === selectedBook.id
                ? { ...current, pageCount }
                : current,
            );
          }}
        />
      </main>
    );
  }

  // Library shell.
  return (
    <main
      className={`${manrope.className} min-h-screen bg-white text-slate-950 dark:bg-zinc-950 dark:text-zinc-50`}
    >
      <ConfirmDialog
        open={bookToDelete !== null}
        title="¿Eliminar este libro?"
        description="Esta acción no se puede deshacer. El libro será eliminado permanentemente de tu biblioteca."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (bookToDelete) {
            void handleDeleteBook(bookToDelete);
            setBookToDelete(null);
          }
        }}
        onCancel={() => setBookToDelete(null)}
      />

      <div className="flex">
        <Sidebar />

        <motion.section
          key="library"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="min-w-0 flex-1"
        >
          {/* ------------------------------------------------------------
              Top bar — thin, sticky. Solo tema + usuario. La navegación
              vive en el sidebar para que la barra superior sea casi aire.
          ------------------------------------------------------------ */}
          <div className="sticky top-0 z-10 flex h-14 items-center justify-end gap-2 border-b border-slate-200/70 bg-white/85 px-6 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85 sm:px-10">
            <ThemeToggle />
            <UserButton
              appearance={{
                elements: { userButtonAvatarBox: "h-7 w-7" },
              }}
            />
          </div>

          <div className="mx-auto w-full max-w-[1280px] px-6 py-8 sm:px-10 sm:py-10">
            <LibraryHero
              stats={stats ?? { total: 0, inProgress: 0 }}
              isLoading={isLoadingBooks}
            />

            <div className="mt-7">
              <LibrarySearch
                query={searchQuery}
                onQueryChange={setSearchQuery}
              />
            </div>

            <div className="mt-8 border-t border-slate-100 pt-8 dark:border-zinc-800/70">
              <BooksLibrary
                books={filteredBooks}
                totalBookCount={books.length}
                searchQuery={searchQuery}
                deletingBookId={deletingBookId}
                renamingBookId={renamingBookId}
                isLoading={isLoadingBooks}
                onDeleteBook={setBookToDelete}
                onOpenBook={(book) => setPendingBook(book)}
                onRenameBook={handleRenameBook}
                onClearSearch={() => setSearchQuery("")}
                uploadcareKey={process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY ?? ""}
                isUploading={isUploading}
                onUploadStart={() => setIsUploading(true)}
                onUploadFailed={() => setIsUploading(false)}
                onUploadSuccess={handleUpload}
              />

              <BookOpenDialog
                book={pendingBook}
                onClose={() => setPendingBook(null)}
                onOpenReading={(book) => {
                  markBookOpened(userId, book.id);
                  setBooks((current) => sortBooksByLastOpened(current, userId));
                  setPendingBook(null);
                  setSelectedBook(book);
                }}
              />
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Hero — título + dos métricas con count-up. Sin eyebrow, sin ruido.
// ---------------------------------------------------------------------------

type LibraryHeroProps = {
  stats: LibraryStats;
  isLoading: boolean;
};

function LibraryHero({ stats, isLoading }: LibraryHeroProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
      className="flex flex-col"
    >
      <h1 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.045em] text-slate-950 dark:text-zinc-50 sm:text-[36px]">
        Biblioteca
      </h1>

      <HeroStats stats={stats} isLoading={isLoading} />
    </motion.header>
  );
}

function HeroStats({
  stats,
  isLoading,
}: {
  stats: LibraryStats;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="mt-3 h-[18px] w-56 animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
    );
  }
  if (stats.total === 0) {
    return (
      <p className="mt-3 text-[14px] text-slate-500 dark:text-zinc-400">
        Tu primer libro está a un clic de aquí.
      </p>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2.5 text-[13.5px] text-slate-500 dark:text-zinc-400">
      <Stat value={stats.total} label={stats.total === 1 ? "libro" : "libros"} />
      <Dot />
      <Stat
        value={stats.inProgress}
        label="en progreso"
        dim={stats.inProgress === 0}
      />
    </div>
  );
}

function Stat({
  value,
  label,
  dim,
}: {
  value: number;
  label: string;
  dim?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5 tabular-nums">
      <span
        className={`text-[15px] font-semibold tracking-[-0.015em] ${
          dim
            ? "text-slate-400 dark:text-zinc-600"
            : "text-slate-950 dark:text-zinc-50"
        }`}
      >
        <AnimatedCount value={value} />
      </span>
      <span className={dim ? "opacity-70" : ""}>{label}</span>
    </span>
  );
}

function Dot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[3px] w-[3px] rounded-full bg-slate-300 dark:bg-zinc-700"
    />
  );
}

/**
 * Anima un entero de 0 al valor objetivo cuando el componente se
 * monta o cambia ``value``. Usa motion values directamente para
 * evitar cascadas de setState en cada frame.
 */
function AnimatedCount({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (latest) => Math.round(latest).toString());
  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.55,
      ease: [0.22, 0.61, 0.36, 1],
    });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span>{rounded}</motion.span>;
}

// ---------------------------------------------------------------------------
// Actions bar — búsqueda + upload primario
// ---------------------------------------------------------------------------

type LibrarySearchProps = {
  query: string;
  onQueryChange: (next: string) => void;
};

function LibrarySearch({ query, onQueryChange }: LibrarySearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  // SSR-safe: arranca como `true` en el server, se corrige en el
  // cliente sin disparar setState dentro de un effect.
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => true,
  );

  // ⌘K / Ctrl+K enfoca el search desde cualquier parte de la library.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const editing =
        tag === "input" || tag === "textarea" || target?.isContentEditable;
      const cmdOrCtrl = event.metaKey || event.ctrlKey;
      if (cmdOrCtrl && event.key.toLowerCase() === "k" && !editing) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (event.key === "/" && !editing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleClear = useCallback(() => {
    onQueryChange("");
    inputRef.current?.focus();
  }, [onQueryChange]);

  return (
    <div className="relative max-w-md">
      {/* Search bar — animated focus state + ⌘K shortcut hint */}
      <div className="relative">
        <motion.div
          animate={{
            borderColor: isFocused
              ? "rgb(15, 23, 42)"
              : query
                ? "rgb(203, 213, 225)"
                : "rgb(226, 232, 240)",
            boxShadow: isFocused
              ? "0 0 0 4px rgba(15, 23, 42, 0.07)"
              : "0 0 0 0px rgba(15, 23, 42, 0)",
          }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative flex h-10 items-center overflow-hidden rounded-lg border bg-white dark:border-zinc-700 dark:bg-zinc-900"
        >
          <motion.span
            aria-hidden="true"
            animate={{
              color: isFocused
                ? "rgb(15, 23, 42)"
                : "rgb(148, 163, 184)",
              x: isFocused ? 0 : 0,
            }}
            transition={{ duration: 0.18 }}
            className="flex h-full items-center pl-3 dark:!text-zinc-500"
          >
            <SearchIcon />
          </motion.span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Buscar en tu biblioteca…"
            aria-label="Buscar libros"
            className="h-full flex-1 bg-transparent px-2.5 text-[13.5px] text-slate-900 placeholder:text-slate-400 outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          {query ? (
            <motion.button
              type="button"
              onClick={handleClear}
              aria-label="Limpiar búsqueda"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.12 }}
              className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <CloseIcon />
            </motion.button>
          ) : (
            <kbd className="mr-2.5 hidden items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 sm:inline-flex">
              {isMac ? "⌘" : "Ctrl"}
              <span className="opacity-60">K</span>
            </kbd>
          )}
        </motion.div>
      </div>
    </div>
  );
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

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}


