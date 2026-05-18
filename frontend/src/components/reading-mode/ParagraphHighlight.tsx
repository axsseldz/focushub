"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { ParagraphRect } from "@/lib/pdf";
import type { ReaderTone } from "@/components/reading-mode/SettingsMenu";

type ParagraphHighlightProps = {
  /** Cajas (a escala 1 del viewport del PDF) del párrafo activo. */
  rects: ParagraphRect[];
  /** Factor para convertir las coordenadas a escala 1 al tamaño
   *  renderizado actual de la página. */
  scale: number;
  /** Tono del lector — define cómo se ve la página y guía el color
   *  del highlight para que se integre. */
  tone: ReaderTone;
  /** Dark mode global de la app. Sólo modula el tono "día" cuando la
   *  UI alrededor es oscura. */
  isDark: boolean;
};

type HighlightStyle = {
  background: string;
  blendMode: "multiply" | "screen" | "normal";
};

function styleFor(tone: ReaderTone, isDark: boolean): HighlightStyle {
  // Las elecciones de color están pensadas para integrarse con la
  // apariencia final del canvas del PDF (después del filtro de
  // tono), no con la UI alrededor. mix-blend-multiply oscurece sobre
  // fondos claros; mix-blend-screen aclara sobre fondos oscuros.
  switch (tone) {
    case "sepia":
      // Papel cálido → tinta ámbar.
      return {
        background: "rgba(146, 64, 14, 0.22)",
        blendMode: "multiply",
      };
    case "dark":
      // Página invertida (fondo oscuro) → highlight cálido que
      // aclara la línea sin chillar.
      return {
        background: "rgba(253, 224, 71, 0.30)",
        blendMode: "screen",
      };
    default:
      // tono "día" → la página es blanca. Necesita una tinta con
      // suficiente cuerpo para ser perceptible en blanco puro pero
      // sin tapar el texto. En dark theme subimos un pelo más para
      // mantener el contraste contra el chrome oscuro.
      return {
        background: isDark
          ? "rgba(15, 23, 42, 0.22)"
          : "rgba(15, 23, 42, 0.18)",
        blendMode: "multiply",
      };
  }
}

/**
 * Overlay sutil que se monta encima del canvas del PDF y marca el
 * párrafo en reproducción. Diseñado para ser invisible cuando no
 * está activo y casi imperceptible cuando lo está — un highlighter,
 * no un letrero. Vive fuera del contenedor que aplica el filtro de
 * tono para que el color elegido se respete.
 */
export function ParagraphHighlight({
  rects,
  scale,
  tone,
  isDark,
}: ParagraphHighlightProps) {
  const style = useMemo(() => styleFor(tone, isDark), [tone, isDark]);

  if (rects.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {rects.map((rect, index) => {
        const left = rect.x * scale;
        const top = rect.y * scale;
        const width = rect.width * scale;
        const height = rect.height * scale;
        // Padding pequeño y proporcional para que el highlight
        // respire alrededor del texto sin agregar "caja".
        const padX = Math.max(1.5, height * 0.08);
        const padY = Math.max(1, height * 0.12);
        return (
          <motion.div
            key={`${index}-${left}-${top}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute rounded-[3px]"
            style={{
              left: left - padX,
              top: top - padY,
              width: width + padX * 2,
              height: height + padY * 2,
              background: style.background,
              mixBlendMode: style.blendMode,
            }}
          />
        );
      })}
    </div>
  );
}
