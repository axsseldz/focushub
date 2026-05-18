"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

type HeaderPopoverProps = {
  open: boolean;
  onClose: () => void;
  /** Botón que ancla el popover. Se renderiza como hijo directo. */
  trigger: ReactNode;
  /** Alineación horizontal del panel respecto al trigger. */
  align?: "left" | "right";
  /** Ancho mínimo del panel. */
  width?: number;
  /** Variante para focus mode: panel oscuro de cristal en lugar de
   *  blanco. Internamente añade la clase ``dark`` al contenido para
   *  activar las variantes dark de Tailwind ya existentes. */
  compact?: boolean;
  children: ReactNode;
};

/**
 * Popover anclado a un botón del header. Cierra con clic fuera,
 * tecla ``Escape`` o cuando el trigger lo decide. El trigger se
 * pasa como prop para que el contenedor pueda referenciar el botón
 * y detectar correctamente los clics afuera (sin considerar el
 * propio botón como "afuera").
 */
export function HeaderPopover({
  open,
  onClose,
  trigger,
  align = "right",
  width = 288,
  compact = false,
  children,
}: HeaderPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const node = containerRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  return (
    <div ref={containerRef} className="relative inline-flex">
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="dialog"
            className={`absolute top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${
              compact
                ? "dark border-white/10 bg-zinc-900/95 text-zinc-100 backdrop-blur-xl"
                : "border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.12)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
            } ${align === "right" ? "right-0" : "left-0"}`}
            style={{ width }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
