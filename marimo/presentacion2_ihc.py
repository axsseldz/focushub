import marimo

__generated_with = "0.23.1"
app = marimo.App(
    width="medium",
    layout_file="layouts/presentacion2_ihc.slides.json",
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
  --chip-ok-bg: #d1fae5;
  --chip-ok-fg: #065f46;
  --chip-info-bg: #dbeafe;
  --chip-info-fg: #1e40af;
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
.fh-grid-4 {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 0.85rem; margin-top: 1.5rem;
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
.fh-chip--ok    { background: var(--chip-ok-bg); color: var(--chip-ok-fg) !important; }
.fh-chip--info  { background: var(--chip-info-bg); color: var(--chip-info-fg) !important; }

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

.fh-swatch {
  display: inline-block; width: 18px; height: 18px;
  border-radius: 4px; vertical-align: middle;
  margin-right: 0.5rem; border: 1px solid var(--line);
}
.fh-palette {
  display: flex; gap: 0.5rem; align-items: center;
  margin-top: 0.5rem; flex-wrap: wrap;
}
.fh-palette-item {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.85rem; color: var(--muted);
}
</style>
"""
    return STYLES, mo


@app.cell
def _(STYLES, mo):
    mo.md(
        STYLES
        + r"""
<div class="fh-slide fh-cover">
  <div class="fh-eyebrow">Interaccion Humano Computadora</div>
  <div class="fh-title">Fundamentos de Diseno de Interfaces</div>
  <div class="fh-sub">Investigacion individual — Iteracion de prototipos</div>
  <hr class="fh-rule" />
  <div class="fh-authors">Axel Tadeo Diaz Flores</div>
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
    <li><span class="fh-num">1</span><span>Principios de diseno visual</span></li>
    <li><span class="fh-num">2</span><span>Color en interfaces</span></li>
    <li><span class="fh-num">3</span><span>Tipografia digital</span></li>
    <li><span class="fh-num">4</span><span>Consistencia visual</span></li>
    <li><span class="fh-num">5</span><span>Diseno centrado en el usuario</span></li>
    <li><span class="fh-num">6</span><span>Aplicacion y reflexion — FocusHub</span></li>
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
  <div class="fh-eyebrow">Seccion 1</div>
  <div class="fh-title">Principios de diseno visual</div>
  <div class="fh-subtitle">Cuatro leyes fundamentales que organizan la percepcion del usuario.</div>
  <div class="fh-grid-4">
    <div class="fh-card">
      <div class="fh-k">Jerarquia</div>
      <div class="fh-v">Guia la mirada del usuario hacia lo mas importante primero. Se logra con <strong>tamano, peso y posicion</strong>.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Contraste</div>
      <div class="fh-v">Diferencia elementos para que sean distinguibles. Aplica a <strong>color, tamano, forma y tipografia</strong>.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Alineacion</div>
      <div class="fh-v">Conecta visualmente los elementos con lineas invisibles. Genera <strong>orden y profesionalismo</strong>.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Proximidad</div>
      <div class="fh-v">Elementos cercanos se perciben como grupo. Reduce <strong>carga cognitiva</strong> al organizar informacion.</div>
    </div>
  </div>
  <div class="fh-note">Basado en las leyes Gestalt y los principios de Figma Learn Design.</div>
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
    <div class="fh-title">Jerarquia y Contraste</div>
    <span class="fh-chip fh-chip--info">Percepcion visual</span>
  </div>
  <div class="fh-subtitle">Dirigir la atencion y diferenciar elementos.</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Jerarquia</div>
      <div class="fh-v">El ojo humano escanea en patron <strong>F</strong> o <strong>Z</strong>. Los titulos grandes, el color prominente y la posicion superior-izquierda capturan la atencion primero. En interfaces, esto determina que el usuario ve <em>antes</em> de interactuar.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Contraste</div>
      <div class="fh-v">WCAG exige un ratio minimo de <strong>4.5:1</strong> para texto normal y <strong>3:1</strong> para texto grande. Un boton primario con alto contraste contra el fondo comunica que es la <em>accion principal</em>; uno secundario con menor contraste indica una alternativa.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Ejemplo</div>
      <div class="fh-v">Un boton <em>"Abrir libro"</em> en color solido vs. un enlace <em>"Cancelar"</em> en texto plano: la diferencia de peso visual establece la jerarquia de acciones.</div>
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
    <div class="fh-title">Alineacion y Proximidad</div>
    <span class="fh-chip fh-chip--info">Organizacion espacial</span>
  </div>
  <div class="fh-subtitle">Crear estructura y relaciones sin necesidad de bordes ni lineas.</div>
  <div class="fh-problem">
    <div class="fh-problem-row">
      <div class="fh-k">Alineacion</div>
      <div class="fh-v">Cada elemento debe tener una <strong>conexion visual</strong> con al menos otro elemento. Un grid de 4 u 8 columnas garantiza que formularios, tarjetas y listas se perciban como parte de un mismo sistema.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Proximidad</div>
      <div class="fh-v">La ley de proximidad de Gestalt: agrupamos automaticamente lo que esta cerca. Un <strong>margen de 8px</strong> entre etiqueta y campo indica relacion; <strong>24px</strong> entre secciones indica separacion.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Ejemplo</div>
      <div class="fh-v">En una biblioteca de libros, la portada, titulo y autor agrupados con poco espacio forman una unidad; el espacio mayor entre tarjetas marca la separacion entre libros distintos.</div>
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
  <div class="fh-eyebrow">Seccion 2</div>
  <div class="fh-title">Uso de color en interfaces</div>
  <div class="fh-subtitle">El color comunica significado, estado y jerarquia.</div>
  <div class="fh-grid-2">
    <div class="fh-card">
      <div class="fh-k">Sistema de color</div>
      <div class="fh-v">Material Design 3 propone roles de color: <strong>Primary</strong> para acciones clave, <strong>Surface</strong> para fondos, <strong>Error</strong> para estados criticos. Cada rol tiene variantes tonales que aseguran contraste.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Accesibilidad</div>
      <div class="fh-v"><strong>No depender solo del color</strong> para comunicar informacion. Combinar con iconos, texto o patrones. El 8% de los hombres tiene alguna forma de daltonismo.</div>
    </div>
  </div>
  <div class="fh-problem" style="margin-top: 1.25rem;">
    <div class="fh-problem-row">
      <div class="fh-k">Regla 60-30-10</div>
      <div class="fh-v"><strong>60%</strong> color dominante (fondo/superficie) · <strong>30%</strong> color secundario (contenedores, navegacion) · <strong>10%</strong> color de acento (botones primarios, indicadores activos).</div>
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
  <div class="fh-eyebrow">Seccion 3</div>
  <div class="fh-title">Tipografia en diseno digital</div>
  <div class="fh-subtitle">El texto es la interfaz. La tipografia define legibilidad, tono y estructura.</div>
  <div class="fh-grid-2">
    <div class="fh-card">
      <div class="fh-k">Escala tipografica</div>
      <div class="fh-v">Definir 4-5 tamanos con una <strong>razon consistente</strong> (ej. 1.25x). Titulos, subtitulos, cuerpo, captions. Mas tamanos genera ruido visual.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Familias tipograficas</div>
      <div class="fh-v"><strong>Sans-serif</strong> (Inter, Roboto) para interfaces digitales por su legibilidad en pantalla. Maximo <strong>2 familias</strong> por proyecto.</div>
    </div>
  </div>
  <div class="fh-problem" style="margin-top: 1.25rem;">
    <div class="fh-problem-row">
      <div class="fh-k">Altura de linea</div>
      <div class="fh-v">Texto de cuerpo: <strong>1.5</strong> para lectura comoda. Titulos: <strong>1.1-1.2</strong> para compacidad. Nunca menor a 1.0.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Longitud de linea</div>
      <div class="fh-v">Optimo de <strong>45-75 caracteres</strong> por linea. Lineas demasiado largas causan fatiga; demasiado cortas interrumpen la lectura.</div>
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
  <div class="fh-eyebrow">Seccion 4</div>
  <div class="fh-title">Consistencia visual</div>
  <div class="fh-subtitle">Un sistema predecible reduce la curva de aprendizaje y genera confianza.</div>
  <div class="fh-grid-2">
    <div class="fh-card">
      <div class="fh-k">Consistencia interna</div>
      <div class="fh-v">Mismos patrones dentro de la aplicacion: los botones siempre lucen igual, los espaciados siguen un <strong>sistema de 4px/8px</strong>, los iconos tienen el mismo estilo.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Consistencia externa</div>
      <div class="fh-v">Respetar convenciones que el usuario ya conoce: icono de lupa = buscar, X = cerrar, hamburguesa = menu. <strong>No reinventar patrones establecidos.</strong></div>
    </div>
  </div>
  <div class="fh-problem" style="margin-top: 1.25rem;">
    <div class="fh-problem-row">
      <div class="fh-k">Design tokens</div>
      <div class="fh-v">Variables reutilizables para colores, espaciados, radios de borde y sombras. Cambiar un token actualiza <strong>todo el sistema</strong> de forma coherente.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Componentes</div>
      <div class="fh-v">Construir con piezas reutilizables (botones, cards, inputs). Cada componente tiene <strong>estados definidos</strong>: default, hover, focus, disabled, error.</div>
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
  <div class="fh-eyebrow">Seccion 5</div>
  <div class="fh-title">Diseno centrado en el usuario</div>
  <div class="fh-subtitle">El usuario es el punto de partida y de llegada en cada decision de diseno.</div>
  <div class="fh-grid-2">
    <div class="fh-card">
      <div class="fh-k">Proceso iterativo</div>
      <div class="fh-v"><strong>Investigar → Disenar → Prototipar → Evaluar → Repetir.</strong> Cada ciclo incorpora feedback real del usuario para acercar la solucion a sus necesidades.</div>
    </div>
    <div class="fh-card">
      <div class="fh-k">Principios clave</div>
      <div class="fh-v">Entender el <strong>contexto de uso</strong>. Involucrar al usuario. Evaluar con datos, no suposiciones. Considerar la experiencia completa, no solo la pantalla.</div>
    </div>
  </div>
  <div class="fh-problem" style="margin-top: 1.25rem;">
    <div class="fh-problem-row">
      <div class="fh-k">Usabilidad</div>
      <div class="fh-v">Nielsen define 5 componentes: <strong>facilidad de aprendizaje, eficiencia, memorabilidad, errores y satisfaccion</strong>. Un diseno centrado en el usuario optimiza los cinco.</div>
    </div>
    <div class="fh-problem-row">
      <div class="fh-k">Accesibilidad</div>
      <div class="fh-v">Disenar para <strong>todos</strong> los usuarios, incluyendo quienes usan lectores de pantalla, navegacion por teclado, o tienen limitaciones visuales o motoras.</div>
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
  <div class="fh-eyebrow">Aplicacion en FocusHub</div>
  <div class="fh-title">Ejemplos concretos</div>
  <div class="fh-subtitle">Como se manifiestan estos principios en nuestro prototipo.</div>
  <ol class="fh-recs">
    <li>
      <span class="fh-num">1</span>
      <div class="fh-rec-body">
        <strong>Jerarquia en el Dashboard.</strong>
        <span>El panel de estadisticas (sesiones, tiempo, racha) usa tamanos y pesos distintos para guiar la lectura: numero grande, etiqueta pequena.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">2</span>
      <div class="fh-rec-body">
        <strong>Proximidad en la Biblioteca.</strong>
        <span>Portada, titulo y progreso agrupados en cada tarjeta; espacio mayor entre tarjetas para distinguir cada libro.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">3</span>
      <div class="fh-rec-body">
        <strong>Contraste en acciones primarias.</strong>
        <span>Botones como "Abrir libro" y "Iniciar sesion de enfoque" son solidos y oscuros; acciones secundarias son texto plano o contorno.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">4</span>
      <div class="fh-rec-body">
        <strong>Consistencia tipografica.</strong>
        <span>Toda la interfaz usa la misma familia sans-serif con una escala de 4 tamanos: titulo, subtitulo, cuerpo y caption.</span>
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
<div class="fh-slide">
  <div class="fh-eyebrow">Aplicacion en FocusHub</div>
  <div class="fh-title">Mas ejemplos</div>
  <ol class="fh-recs">
    <li>
      <span class="fh-num">5</span>
      <div class="fh-rec-body">
        <strong>Color con proposito.</strong>
        <span>Fondo blanco (60%) como superficie principal, gris claro (30%) para tarjetas y paneles, azul oscuro (10%) para botones de accion y estados activos.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">6</span>
      <div class="fh-rec-body">
        <strong>Alineacion con grid.</strong>
        <span>La biblioteca organiza las tarjetas de libros en un grid uniforme. El visor de PDF centra el contenido con margenes consistentes.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">7</span>
      <div class="fh-rec-body">
        <strong>DCU: gestos de mano.</strong>
        <span>La navegacion por gestos responde al contexto real de uso: el usuario tiene las manos ocupadas o esta lejos del teclado mientras lee.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">8</span>
      <div class="fh-rec-body">
        <strong>Consistencia externa.</strong>
        <span>Iconos reconocibles: ojo para visibilidad, camara para gestos, flecha para volver. No se inventan metaforas nuevas.</span>
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
<div class="fh-slide">
  <div class="fh-eyebrow">Reflexion</div>
  <div class="fh-title">Como mejorar FocusHub</div>
  <div class="fh-subtitle">Oportunidades identificadas a partir de esta investigacion.</div>
  <ol class="fh-recs">
    <li>
      <span class="fh-num">1</span>
      <div class="fh-rec-body">
        <strong>Reforzar jerarquia en el visor PDF.</strong>
        <span>Los controles de navegacion compiten visualmente con el contenido. Reducir su prominencia y usar opacidad progresiva al pasar el cursor.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">2</span>
      <div class="fh-rec-body">
        <strong>Implementar design tokens en Tailwind.</strong>
        <span>Centralizar colores, espaciados y radios como variables CSS para garantizar consistencia y facilitar cambios globales.</span>
      </div>
    </li>
    <li>
      <span class="fh-num">3</span>
      <div class="fh-rec-body">
        <strong>Mejorar accesibilidad del color.</strong>
        <span>Verificar que todos los textos cumplan WCAG AA (4.5:1). Agregar indicadores no-cromáticos para estados como "leyendo" o "en pausa".</span>
      </div>
    </li>
    <li>
      <span class="fh-num">4</span>
      <div class="fh-rec-body">
        <strong>Iterar con usuarios reales.</strong>
        <span>Aplicar el ciclo de DCU: incorporar los hallazgos de la evaluacion heuristica y el mini test para evolucionar el prototipo con evidencia.</span>
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
<div class="fh-slide">
  <div class="fh-eyebrow">Fuentes consultadas</div>
  <div class="fh-title">Referencias</div>
  <ul class="fh-tasks">
    <li><span class="fh-num">1</span><span>Figma — <em>Learn Design</em>: fundamentos de diseno visual, tipografia y color.</span></li>
    <li><span class="fh-num">2</span><span>Google — <em>Material Design 3</em>: sistema de color, tipografia y componentes.</span></li>
    <li><span class="fh-num">3</span><span>Nielsen Norman Group — Principios de usabilidad y diseno centrado en el usuario.</span></li>
    <li><span class="fh-num">4</span><span>WCAG 2.1 — Pautas de accesibilidad para contenido web.</span></li>
  </ul>
  <div class="fh-note">figma.com/resources/learn-design · m3.material.io · nngroup.com · w3.org/WAI/WCAG21</div>
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
  <div class="fh-title">Preguntas?</div>
  <div class="fh-note">Axel Tadeo Diaz Flores — UABC</div>
</div>
"""
    )
    return


if __name__ == "__main__":
    app.run()
