import marimo

__generated_with = "0.23.1"
app = marimo.App(
    width="medium",
    layout_file="layouts/presentacion_ihc.slides.json",
)


@app.cell
def _():
    import marimo as mo

    STYLES = """
<style>
:root {
  --ink: #0b0f19;
  --muted: #6b7280;
  --line: #e5e7eb;
  --bg: #ffffff;
  --chip-grave-bg: #fee2e2;
  --chip-grave-fg: #991b1b;
  --chip-mod-bg: #fef3c7;
  --chip-mod-fg: #92400e;
}
.fh-slide, .fh-slide * {
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif !important;
  color: var(--ink);
  line-height: 1.5;
  box-sizing: border-box;
}
.fh-slide { padding: 3.5rem 4rem; max-width: 980px; margin: 0 auto; }
.fh-slide p { margin: 0; }

.fh-title {
  font-size: 2.4rem !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em;
  margin: 0 0 1.25rem 0 !important;
  color: var(--ink);
}
.fh-subtitle {
  font-size: 1.2rem !important;
  font-weight: 500;
  color: var(--muted) !important;
  margin: 0 0 1.25rem 0 !important;
  letter-spacing: -0.01em;
}
.fh-eyebrow {
  font-size: 0.72rem !important;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted) !important;
  margin: 0 0 1.25rem 0 !important;
}

.fh-cover { text-align: center; padding: 6rem 3rem; }
.fh-cover .fh-title {
  font-size: 3rem !important;
  text-align: center !important;
  margin: 0.25rem 0 0.5rem 0 !important;
}
.fh-cover .fh-eyebrow { text-align: center !important; }
.fh-cover .fh-sub {
  color: var(--muted); font-size: 1.2rem;
  margin: 0 0 2.5rem 0; text-align: center;
}
.fh-cover .fh-rule {
  width: 48px; height: 2px; background: var(--ink);
  margin: 2rem auto; border: 0;
}
.fh-cover .fh-authors { font-size: 1rem; margin: 0 0 0.35rem 0; }
.fh-cover .fh-meta { color: var(--muted); font-size: 0.9rem; margin: 0; }

.fh-center { text-align: center; padding: 5rem 2rem; }
.fh-center .fh-title { text-align: center !important; }
.fh-lead { font-size: 1.5rem; font-weight: 500; letter-spacing: -0.01em; margin: 0; }
.fh-note { color: var(--muted); font-size: 0.95rem; margin: 1rem 0 0 0; }

.fh-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 999px;
  background: var(--ink); color: #fff !important;
  font-size: 0.85rem; font-weight: 600;
  margin-right: 0.9rem; flex-shrink: 0;
}
.fh-agenda { list-style: none; padding: 0; margin: 0; }
.fh-agenda li {
  padding: 1rem 0; border-bottom: 1px solid var(--line);
  font-size: 1.2rem; display: flex; align-items: center;
}
.fh-agenda li:last-child { border-bottom: 0; }

.fh-grid-2 {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 1rem; margin-top: 1.5rem;
}
.fh-card {
  border: 1px solid var(--line); border-radius: 12px;
  padding: 1.25rem 1.4rem; background: #fafafa;
}
.fh-card .fh-k {
  font-size: 0.72rem; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--muted);
  margin: 0 0 0.4rem 0;
}
.fh-card .fh-v { font-size: 1rem; margin: 0; }

.fh-chip {
  display: inline-block; padding: 0.25rem 0.7rem;
  border-radius: 999px; font-size: 0.75rem;
  font-weight: 600; letter-spacing: 0.04em;
}
.fh-chip--grave { background: var(--chip-grave-bg); color: var(--chip-grave-fg) !important; }
.fh-chip--mod   { background: var(--chip-mod-bg); color: var(--chip-mod-fg) !important; }

.fh-row {
  display: flex; align-items: center; gap: 0.85rem;
  margin-bottom: 0.75rem; flex-wrap: wrap;
}
.fh-row .fh-title { margin: 0 !important; }

.fh-problem { display: flex; flex-direction: column; margin-top: 1.25rem; }
.fh-problem-row {
  display: grid; grid-template-columns: 140px 1fr;
  gap: 1.5rem; align-items: baseline;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}
.fh-problem-row:last-child { border-bottom: 0; }
.fh-problem-row .fh-k {
  color: var(--muted); font-size: 0.72rem;
  letter-spacing: 0.16em; text-transform: uppercase;
  margin: 0; line-height: 1.4;
}
.fh-problem-row .fh-v {
  font-size: 1rem; margin: 0; line-height: 1.55;
}

.fh-quote {
  border-left: 3px solid var(--ink);
  padding: 0.4rem 0 0.4rem 1.1rem;
  font-style: italic;
  margin: 1.5rem 0 0 0;
}
.fh-quote .fh-quote-note {
  display: block; font-style: normal;
  color: var(--muted); margin-top: 0.4rem;
  font-size: 0.85rem;
}

.fh-tasks { list-style: none; padding: 0; margin: 1rem 0 0 0; }
.fh-tasks li {
  display: flex; align-items: center;
  padding: 0.8rem 0; border-bottom: 1px solid var(--line);
  font-size: 1rem;
}
.fh-tasks li:last-child { border-bottom: 0; }

.fh-recs { list-style: none; padding: 0; margin: 0.5rem 0 0 0; }
.fh-recs li {
  display: flex; align-items: flex-start; gap: 1rem;
  padding: 0.9rem 0; border-bottom: 1px solid var(--line);
}
.fh-recs li:last-child { border-bottom: 0; }
.fh-recs .fh-rec-body { display: flex; flex-direction: column; }
.fh-recs .fh-rec-body strong { font-size: 1rem; margin-bottom: 0.15rem; }
.fh-recs .fh-rec-body span { color: var(--muted); font-size: 0.9rem; }

.fh-thanks .fh-title { font-size: 4rem !important; }
</style>
"""
    return STYLES, mo


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide fh-cover">
  <div class="fh-eyebrow">Interacción Humano Computadora</div>
  <div class="fh-title">Evaluación de usabilidad</div>
  <div class="fh-sub">Prototipos iniciales — FocusHub</div>
  <hr class="fh-rule" />
  <div class="fh-authors">Axel Tadeo Díaz Flores · Alan Villalobos Aranda</div>
  <div class="fh-meta">Mtra. Maria Victoria Meza Kubo · Facultad de Ciencias · UABC</div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Contenido</div>
  <div class="fh-title">Agenda</div>
  <ul class="fh-agenda">
    <li><span class="fh-num">1</span><span>FocusHub — sistema evaluado</span></li>
    <li><span class="fh-num">2</span><span>Evaluación heurística</span></li>
    <li><span class="fh-num">3</span><span>Mini test de usabilidad</span></li>
    <li><span class="fh-num">4</span><span>Recomendaciones</span></li>
  </ul>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Sistema evaluado</div>
  <div class="fh-title">FocusHub</div>
  <div class="fh-subtitle">Aplicación web de productividad para trabajo cognitivo profundo.</div>
  <div class="fh-grid-2">
    <div class="fh-card">
      <div class="fh-k">Modo Lectura</div>
      <div class="fh-v">Biblioteca de PDFs, visor de pantalla completa y navegación por <strong>gestos de mano</strong>.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Modo Escritura</div>
      <div class="fh-v">En desarrollo.</div>
    </div>
  </div>
  <div class="fh-note">1 dedo → siguiente página · 2 dedos → página anterior &nbsp;·&nbsp; MediaPipe HandLandmarker</div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Actividad 1</div>
  <div class="fh-title">Evaluación heurística</div>
  <div class="fh-subtitle">Inspección del prototipo contra principios establecidos.</div>
  <div class="fh-grid-2">
    <div class="fh-card">
      <div class="fh-k">Referencias</div>
      <div class="fh-v">10 heurísticas de Nielsen Norman Group · Principios de Diseño Universal</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Pantallas</div>
      <div class="fh-v">Inicio · Dashboard · Biblioteca · Visor PDF</div>
    </div>
  </div>
  <div class="fh-note">Severidad: 0 no es problema · 1 leve · 2 moderado · 3 grave · 4 crítico</div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-row">
    <div class="fh-title">Problema 1</div>
    <span class="fh-chip fh-chip--grave">Severidad 3 · Grave</span>
  </div>
  <div class="fh-subtitle">Sin retroalimentación al cargar un PDF.</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Qué pasa</div>
      <div class="fh-v">El botón <em>“Seleccionar libro”</em> no cambia al hacer clic. El usuario duda y hace clics repetidos.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Heurística</div>
      <div class="fh-v">H1 — Visibilidad del estado del sistema</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Mejora</div>
      <div class="fh-v">Spinner o texto <em>“Cargando…”</em> inmediato, más barra de progreso al generar miniatura.</div>
    </div>
  </div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-row">
    <div class="fh-title">Problema 2</div>
    <span class="fh-chip fh-chip--grave">Severidad 3 · Grave</span>
  </div>
  <div class="fh-subtitle">Gestos sin guía visual previa.</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Qué pasa</div>
      <div class="fh-v">La cámara inicia sin comunicar qué gestos reconoce. El usuario los descubre por ensayo y error.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Heurística</div>
      <div class="fh-v">H1 — Visibilidad del estado · H10 — Ayuda y documentación</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Mejora</div>
      <div class="fh-v">Tarjeta al activar: <em>“1 dedo → siguiente · 2 dedos → anterior · mantén quieto”</em>.</div>
    </div>
  </div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-row">
    <div class="fh-title">Problema 3</div>
    <span class="fh-chip fh-chip--mod">Severidad 2 · Moderado</span>
  </div>
  <div class="fh-subtitle">Sin persistencia de posición de lectura.</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Qué pasa</div>
      <div class="fh-v">Al reabrir un libro, siempre comienza en la página 1.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Heurística</div>
      <div class="fh-v">H3 — Control y libertad del usuario · Uso flexible y eficiente</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Mejora</div>
      <div class="fh-v">Guardar la última página por libro y preguntar <em>“Continuar desde la página 47”</em>.</div>
    </div>
  </div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-row">
    <div class="fh-title">Problema 4</div>
    <span class="fh-chip fh-chip--mod">Severidad 2 · Moderado</span>
  </div>
  <div class="fh-subtitle">Libros identificados por nombre de archivo.</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Qué pasa</div>
      <div class="fh-v">Los PDFs se muestran con nombres crudos como <code>capitulo_3_v2_final.pdf</code>.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Heurística</div>
      <div class="fh-v">H6 — Reconocimiento antes que recuerdo · H8 — Diseño minimalista</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Mejora</div>
      <div class="fh-v">Título editable o extracción automática del metadato <code>Title</code>.</div>
    </div>
  </div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Actividad 2</div>
  <div class="fh-title">Mini test de usabilidad</div>
  <div class="fh-subtitle">Think-Aloud con una usuaria representativa.</div>
  <div class="fh-grid-2">
    <div class="fh-card">
      <div class="fh-k">Método</div>
      <div class="fh-v">La usuaria ejecuta tareas reales y verbaliza lo que piensa, siente e intenta hacer.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Roles del equipo</div>
      <div class="fh-v">Usuaria · Observador · Registrador</div>
    </div>
  </div>
  <div class="fh-note">Sin intervenir ni ayudar. Se registran frases textuales.</div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Preparación</div>
  <div class="fh-title">Perfil y tareas</div>
  <div class="fh-grid-2">
    <div class="fh-card">
      <div class="fh-k">Usuaria</div>
      <div class="fh-v">Estudiante universitaria, 21 años. Habituada a Foxit y Adobe. <strong>Sin experiencia con interfaces por gestos.</strong></div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Contexto</div>
      <div class="fh-v">Lectura de material de clase. Toma notas a mano en paralelo.</div>
    </div>
  </div>
  <ul class="fh-tasks">
    <li><span class="fh-num">1</span><span>Subir un PDF y abrirlo en el visor.</span></li>
    <li><span class="fh-num">2</span><span>Activar gestos y navegar 3 páginas adelante.</span></li>
    <li><span class="fh-num">3</span><span>Ocultar la cámara manteniendo los gestos activos.</span></li>
  </ul>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Tarea 1 · Subir y abrir un PDF</div>
  <div class="fh-title">Doble clic por falta de feedback</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Observación</div>
      <div class="fh-v">Hizo clic dos veces antes de que se abriera el explorador de archivos.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Impacto</div>
      <div class="fh-v">Duda sobre si la acción fue registrada; pérdida de confianza.</div>
    </div>
  </div>
  <div class="fh-quote">
    “¿Le di? No sé si me hizo caso… ah, ya apareció.”
    <span class="fh-quote-note">~2 segundos de pausa entre el primer y el segundo clic.</span>
  </div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Tarea 2 · Activar gestos</div>
  <div class="fh-title">45 s de exploración ciega</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Observación</div>
      <div class="fh-v">Agitó la mano, abrió la palma, movió el índice. Descubrió el gesto por accidente.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Impacto</div>
      <div class="fh-v">Alta carga cognitiva; sensación de que el sistema no funciona.</div>
    </div>
  </div>
  <div class="fh-quote">
    “¿Qué tengo que hacer con la mano? ¿Así? ¿Así?… Ah, hay que quedarse quieta con el dedo. No lo dice en ningún lado.”
  </div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Tarea 3 · Ocultar la cámara</div>
  <div class="fh-title">20 s buscando un ícono invisible</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Observación</div>
      <div class="fh-v">El ícono de ojo es pequeño y se superpone al video con bajo contraste.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Impacto</div>
      <div class="fh-v">Consideró <strong>desactivar los gestos por completo</strong> en lugar de solo ocultar la cámara.</div>
    </div>
  </div>
  <div class="fh-quote">
    “Hay un ojito aquí, ¿no? Espera… ¿este? Ah sí, ya se quitó.”
  </div>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide">
  <div class="fh-eyebrow">Síntesis</div>
  <div class="fh-title">Recomendaciones</div>
  <ol class="fh-recs">
    <li>
      <span class="fh-num">1</span>
      <div class="fh-rec-body">
        <strong>Guía de gestos al activar la cámara.</strong>
        <span>De 45 s de descubrimiento a casi cero.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">2</span>
      <div class="fh-rec-body">
        <strong>Botón de ocultar cámara visible.</strong>
        <span>Ícono más grande, con etiqueta y fuera del video.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">3</span>
      <div class="fh-rec-body">
        <strong>Feedback inmediato al cargar PDF.</strong>
        <span>Spinner o texto “Cargando…” al hacer clic.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">4</span>
      <div class="fh-rec-body">
        <strong>Persistencia de página.</strong>
        <span>Retomar la lectura sin esfuerzo.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">5</span>
      <div class="fh-rec-body">
        <strong>Títulos editables.</strong>
        <span>Nombre legible o metadato del PDF.</span>
      </div>
    </li>
  </ol>
</div>
"""
    )
    return


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide fh-center fh-thanks">
  <div class="fh-eyebrow">Gracias</div>
  <div class="fh-title">¿Preguntas?</div>
  <div class="fh-note">Axel Tadeo Díaz Flores · Alan Villalobos Aranda — UABC</div>
</div>
"""
    )
    return


if __name__ == "__main__":
    app.run()
