"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { Book } from "@/types/book";

type BookOpenDialogProps = {
  /** El libro que se está por abrir; ``null`` cierra el modal. */
  book: Book | null;
  onClose: () => void;
  onOpenReading: (book: Book) => void;
};

/**
 * Modal centrado que aparece cuando el usuario hace click en un
 * libro. Pregunta qué modo de trabajo prefiere: Lectura (disponible)
 * o Escritura (próximamente, deshabilitado). Pensado como un puente
 * profesional entre la biblioteca y el modo de trabajo — no como un
 * confirm cualquiera.
 */
export function BookOpenDialog({
  book,
  onClose,
  onOpenReading,
}: BookOpenDialogProps) {
  // ESC cierra; el listener vive solo mientras hay un libro activo.
  useEffect(() => {
    if (!book) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [book, onClose]);

  // Bloquea el scroll del body mientras el modal está abierto para
  // que el fondo no se mueva al hacer scroll dentro del card.
  useEffect(() => {
    if (!book) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [book]);

  return (
    <AnimatePresence>
      {book && (
        <motion.div
          key="book-open-dialog"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop con blur */}
          <motion.button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-md dark:bg-black/65"
          />

          {/* Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="book-open-dialog-title"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar diálogo"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <CloseIcon />
            </button>

            {/* Header */}
            <div className="px-7 pb-2 pt-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                Abrir libro
              </p>
              <h2
                id="book-open-dialog-title"
                className="mt-1 line-clamp-2 text-[20px] font-semibold tracking-[-0.025em] text-slate-950 dark:text-zinc-50"
              >
                {book.displayName ?? book.filename}
              </h2>
              <p className="mt-2 text-[13.5px] leading-6 text-slate-500 dark:text-zinc-400">
                ¿En qué modo querés trabajar con este libro?
              </p>
            </div>

            {/* Mode cards */}
            <div className="grid grid-cols-1 gap-3 px-7 pb-7 pt-4 sm:grid-cols-2">
              <ModeCard
                icon={<ReadingIcon />}
                title="Modo lectura"
                description="Inmersivo, con narración por voz, gestos y métricas de progreso."
                badge="Disponible"
                accent="emerald"
                onClick={() => onOpenReading(book)}
                delay={0.04}
              />
              <ModeCard
                icon={<WritingIcon />}
                title="Modo escritura"
                description="Tomá notas, resaltá pasajes y crea anotaciones sobre el PDF."
                badge="Próximamente"
                accent="muted"
                disabled
                delay={0.1}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Mode card
// ---------------------------------------------------------------------------

type ModeCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  accent: "emerald" | "muted";
  onClick?: () => void;
  disabled?: boolean;
  delay?: number;
};

function ModeCard({
  icon,
  title,
  description,
  badge,
  accent,
  onClick,
  disabled = false,
  delay = 0,
}: ModeCardProps) {
  const accentClasses =
    accent === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-slate-400 dark:text-zinc-500";

  const badgeClasses =
    accent === "emerald"
      ? "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-300"
      : "border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: "easeOut" }}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={`group relative flex h-full flex-col items-start gap-3 overflow-hidden rounded-xl border p-5 text-left transition-all duration-200 ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)] dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200/70 bg-slate-50 ${accentClasses} ${
          disabled ? "" : "transition-transform duration-200 group-hover:scale-[1.04]"
        } dark:border-zinc-700/70 dark:bg-zinc-800`}
      >
        {icon}
      </span>

      <div className="flex flex-1 flex-col">
        <span
          className={`text-[14.5px] font-semibold tracking-[-0.02em] ${
            disabled
              ? "text-slate-700 dark:text-zinc-300"
              : "text-slate-950 dark:text-zinc-50"
          }`}
        >
          {title}
        </span>
        <span
          className={`mt-1 text-[12.5px] leading-5 ${
            disabled
              ? "text-slate-400 dark:text-zinc-600"
              : "text-slate-500 dark:text-zinc-400"
          }`}
        >
          {description}
        </span>
      </div>

      <span
        className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] ${badgeClasses}`}
      >
        {accent === "emerald" && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        )}
        {badge}
      </span>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ReadingIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h4.25a2.5 2.5 0 0 1 2.25 1.4 2.5 2.5 0 0 1 2.25-1.4H18.5A1.5 1.5 0 0 1 20 5.5v12a1.5 1.5 0 0 1-1.5 1.5h-4.25a2.5 2.5 0 0 0-2.25 1.4 2.5 2.5 0 0 0-2.25-1.4H5.5A1.5 1.5 0 0 1 4 17.5v-12ZM12 6.4v13.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function WritingIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M4 19.75h4.5L20 8.25a2.12 2.12 0 0 0-3-3L5.5 16.75v3ZM14.5 7.75l3 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
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
