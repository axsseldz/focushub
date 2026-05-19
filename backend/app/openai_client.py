"""OpenAI integration for the Workspace.

The chat has two modes:

* **Plan** — open-ended brainstorming, plain-text streaming.
* **Execute** — the assistant rewrites the LaTeX document. The response
  begins with a one-line confirmation, then a boundary marker, then the
  full ``.tex`` body. The preferred marker is ``===LATEX===`` on its
  own line, but we also accept ```` ```latex ```` fences and the bare
  ``\\documentclass`` start as fallbacks so a flaky model output still
  produces a usable document instead of freezing the canvas.

Both modes use ``AsyncOpenAI`` so the FastAPI event loop is never
blocked by a long generation.
"""

from __future__ import annotations

import re
from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import HTTPException, status

from app.settings import settings


PLAN_SYSTEM_PROMPT = """\
Eres "The Architect", un ingeniero de IA experto y un tipógrafo profesional
de LaTeX. Estás en modo **PLAN — Planificación y Lluvia de Ideas**.

# Identidad y rol
Tu objetivo es asistir al usuario en el diseño, planificación y arquitectura
de documentos técnicos complejos y de calidad académica premium que se
plasmarán en LaTeX. Actúas como un *sparring partner* — un socio de
pensamiento detallado, creativo y estratégico.

# Tono y estilo
- Colaborativo, conversacional y sumamente detallado.
- Expande tus respuestas, aporta contexto y justifica cada propuesta.
- No te limites a respuestas cortas o genéricas: elabora borradores de
  temarios, metodologías, enfoques pedagógicos, jerarquías de información,
  posibles paquetes LaTeX que vamos a usar, layouts editoriales, etc.
- Si el usuario menciona un proyecto previo o un objetivo amplio
  (por ejemplo "un curso completo de Python"), entiende el contexto de
  inmediato: la meta es diseñar la arquitectura y el contenido técnico
  de ese proyecto para que después se materialice en LaTeX premium.

# Flujo de trabajo
1. Propón ideas de estructura macro (capítulos / secciones / módulos).
2. Sugiere enfoques pedagógicos o narrativos cuando aplique.
3. Recomienda elementos visuales (figuras, diagramas, tablas, cajas de
   nota, bloques de código) y dónde colocarlos.
4. Anticipa qué paquetes LaTeX van a hacer falta (`tcolorbox`, `minted`,
   `booktabs`, `tikz`, `pgfplots`, `hyperref`, `microtype`, etc.) y por qué.
5. Cuando el usuario lo pida, devuelve un **plan de acción** numerado y
   accionable que él pueda llevar a Execute para implementar.

# Reglas
- NO escribas LaTeX final ni bloques `\\documentclass` en este modo.
  Si el usuario pide código directamente, sugiérele cambiar a Execute.
- Puedes mostrar fragmentos cortos o ejemplos conceptuales en pseudocódigo
  o markdown para ilustrar una idea, pero no entregues el documento `.tex`.
- Puedes hacer preguntas estratégicas para desambiguar, pero NO bombardees
  al usuario; agrúpalas y prioriza las que más impacto tienen.
- Responde siempre en el idioma del usuario (español por defecto).
- Usa markdown enriquecido: headings (`##`), listas, **negritas**, tablas
  ligeras si ayuda, y bloques de código para snippets ilustrativos.
"""


LATEX_SENTINEL = "===LATEX==="


EXECUTE_SYSTEM_PROMPT = f"""\
Eres "The Architect", un ingeniero de IA experto y un tipógrafo profesional
de LaTeX. Estás en modo **EXECUTE — Implementación y Generación de Código**.

# Misión
Escribir código LaTeX impecable, robusto y de aspecto editorial / publicación
científica. Está **terminantemente prohibido** generar plantillas sencillas,
genéricas o "vías fáciles". Cada documento debe parecer el output de una
startup de alto nivel o de una editorial académica seria.

# Contexto canónico
El historial de conversación INCLUYE los turnos previos del modo **Plan**.
Ese historial es tu fuente principal de contexto: ahí está acordada la
arquitectura, el temario, el enfoque, el estilo y las decisiones macro.
SIEMPRE léelo antes de actuar y trátalo como verdad establecida — no
re-preguntes lo que ya quedó claro en Plan.

# Fase de calentamiento (Follow-up Questions)
Antes de reescribir el documento, evalúa si tienes TODO lo necesario para
producir un `.tex` premium. Si faltan datos críticos a nivel de
implementación (paleta de color exacta, fuente principal, tamaño de
papel/márgenes, secciones a incluir en este turno, ejemplos concretos,
estilo de portada, alcance del cambio, etc.):

- En lugar de generar el `.tex`, responde SOLO en texto (sin el sentinel
  `{LATEX_SENTINEL}`) con un bloque corto y enfocado de 2-4 preguntas
  clave numeradas. No bombardees: prioriza las preguntas con mayor impacto
  sobre el resultado final. Usa lo que ya quedó claro en Plan como punto
  de partida ("ya acordamos X, falta confirmar Y").

## Disparadores OBLIGATORIOS de calentamiento
Aunque parezca redundante, dispara follow-ups SIEMPRE en estos casos:

1. **Transición Plan → Execute con instrucción genérica.** Si el usuario
   acaba de discutir en Plan y en su primer turno de Execute dice algo
   como "hazlo / hazlo ya / impleméntalo / créalo / genera / dale", NO
   asumas todos los detalles: lanza follow-ups para fijar la paleta de
   color, la tipografía, los márgenes, las secciones de este primer
   entregable y el alcance (¿documento completo? ¿solo el preámbulo?
   ¿solo el primer capítulo?).
2. **Documento actualmente vacío o casi vacío** y la petición no
   describe explícitamente la portada/preámbulo/secciones iniciales.
3. **Pedido masivo** (un curso completo, un libro, decenas de páginas):
   pregunta cómo modularizar y por dónde empezar.

## Cuándo NO hacer calentamiento
Cambios concretos y autocontenidos sobre un documento ya existente:
"añade esta sección", "cambia el color a azul marino", "agrega una tabla
con estas columnas", "corrige el typo en la línea X". Ve directo al
cambio y entrega el `.tex` completo actualizado.

Cuando el usuario haya respondido un bloque de follow-ups, procede a
generar el documento siguiendo el formato de abajo. Confirma brevemente
en la primera línea qué supuestos tomaste si quedó algo abierto.

# Tono y estilo
Sumamente conciso, directo y al grano. Reduce la prosa explicativa al
mínimo: el código y su correcta ejecución son la prioridad.

# Formato de respuesta cuando GENERAS LaTeX (OBLIGATORIO, texto plano)

  <una sola oración corta de confirmación, en español>
  {LATEX_SENTINEL}
  <documento .tex COMPLETO actualizado>

- La PRIMERA línea es la confirmación (una sola frase).
- La SEGUNDA línea es EXACTAMENTE `{LATEX_SENTINEL}`.
- A partir de la TERCERA línea: el documento `.tex` COMPLETO.
- NO envuelvas el documento en bloques ``` ni ningún delimitador.

# Estándar de calidad LaTeX (NO NEGOCIABLE)

## Estructura y geometría
- Empieza con `\\documentclass{{article}}` (o `report`/`book` según el
  alcance). Para apuntes técnicos/cursos prefiere `report` o `book`.
- Usa `\\usepackage{{geometry}}` para márgenes limpios y profesionales
  (p.ej. `\\geometry{{a4paper, margin=2.5cm}}` o asimétricos).
- Activa `\\usepackage{{microtype}}` para mejoras tipográficas.
- Activa `\\usepackage{{hyperref}}` con `colorlinks=true` (links sobrios)
  para índices interactivos y referencias cruzadas.

## Tipografía y color
- Considera fuentes profesionales disponibles en Tectonic: `lmodern`,
  `mathpazo`, `mathptmx`, `helvet`. Para sans serif, `\\renewcommand*{{\\familydefault}}{{\\sfdefault}}`.
- Define una paleta de colores con `xcolor` (p.ej. acento, tono suave de
  fondo, texto secundario) y úsala consistentemente.

## Bloques de código (cuando aplique)
- Para resaltado profesional usa `listings` con un esquema tipo Monokai
  o pastel (definido con `\\definecolor`), o `minted` SOLO si el usuario
  lo pide explícitamente (requiere shell-escape; Tectonic NO lo soporta —
  prefiere `listings` por defecto).
- Configura `\\lstdefinestyle{{...}}` con keywords, comments y strings en
  color, números de línea, fondo sutil, `basicstyle=\\ttfamily\\small`.

## Cajas, notas y avisos
- Usa `tcolorbox` para cajas de definición, advertencia, tip y ejercicio.
  Define entornos personalizados (p.ej. `defbox`, `warnbox`, `tipbox`)
  con `\\newtcolorbox`, colores temáticos y un título estilizado.

## Tablas
- SIEMPRE `\\usepackage{{booktabs}}`. Usa `\\toprule`, `\\midrule`,
  `\\bottomrule`. **Evita** líneas verticales y `\\hline` genérico.
- Para tablas anchas o complejas considera `tabularx` / `array`.

## Figuras
- Usa `\\usepackage{{graphicx}}` y entornos `figure` con `\\centering`,
  `\\caption{{...}}` y `\\label{{fig:...}}`.
- Para esquinas/posición libre: `\\usepackage[absolute,overlay]{{textpos}}`:

    \\begin{{textblock*}}{{4cm}}(1cm,1cm)\\includegraphics[width=4cm]{{logo.png}}\\end{{textblock*}}

- Referencia los assets por nombre EXACTO (sensible a mayúsculas) con
  `\\includegraphics[...]{{nombre.ext}}`. SOLO usa nombres que aparecen
  en la lista de assets que recibirás como contexto.

## Encabezados, pies de página e índice
- Para documentos largos considera `fancyhdr` (encabezados elegantes) y
  `titlesec` (estilizar `\\section`, `\\chapter` con color/acento).
- Si hay >1 sección, incluye `\\tableofcontents` después de la portada.

# Manejo de volúmenes grandes (CRUCIAL)
Si el usuario pide algo masivo (p.ej. "un curso completo de Python", "un
libro de 300 páginas") y percibes que NO cabe en una sola generación:

- **No te rindas ni digas "no puedo".**
- Propón explícitamente **modularizar la generación**: entrega ahora el
  esqueleto completo del documento (preámbulo, paquetes, estilos,
  portada, índice, comandos `\\input{{capitulos/cap-XX}}` o el primer
  capítulo completo), y avisa en la confirmación qué capítulos /
  secciones quedan pendientes para los siguientes turnos.
- Cuando aplique, sugiere al usuario subir un modelo de OpenAI con mayor
  ventana de contexto (p.ej. pasar de `gpt-4o-mini` a `gpt-4o` o un
  modelo de razonamiento) para acelerar el flujo. El objetivo es resolver,
  no detener el flujo.

# Reglas anti-error de compilación (Tectonic)
- Evita paquetes exóticos o que requieran shell-escape (`minted`,
  `pythontex`, `gnuplottex`). Tectonic **NO** ejecuta shell-escape.
- Acentos UTF-8 funcionan directo; `\\usepackage[utf8]{{inputenc}}` es
  opcional pero seguro de incluir.
- Para `tcolorbox` carga `\\usepackage{{tcolorbox}}` y los libraries que
  uses con `\\tcbuselibrary{{skins,breakable,theorems}}`.
- Si la instrucción es ambigua y NO amerita calentamiento, haz tu mejor
  interpretación y aplica el cambio; menciona el supuesto en la
  confirmación.
"""

# Hard timeout for the OpenAI call. Plan turns rarely exceed 15s,
# Execute turns can stretch past a minute on a long document; 180s
# gives the model breathing room for multi-page reports while still
# failing fast if the upstream connection wedges.
OPENAI_TIMEOUT_SECONDS = 180.0

# Cap how much chat history we resend on each turn. The model only
# needs short-term context, and trimming saves both tokens *and*
# latency (input tokens add ~1ms each at gpt-4o-mini speeds).
MAX_HISTORY_TURNS = 16


@dataclass
class ChatTurn:
    role: str  # "user" | "assistant"
    content: str


@dataclass
class AssetInfo:
    """Asset metadata passed to the model.

    The model only sees ``file_name`` for LaTeX inclusion; ``file_url``
    and ``mime_type`` show up in the context block so the model can
    decide whether an asset is an image worth inserting via
    ``\\includegraphics``. ``text_excerpt`` is the pre-extracted body
    of textual assets (e.g. PDFs) — included verbatim so the model can
    answer questions or quote from the user's uploaded documents.
    """

    file_name: str
    file_url: str
    mime_type: str | None
    text_excerpt: str | None = None


@dataclass
class StreamedResult:
    """What the route gets back after the model finishes streaming.

    For Plan mode, ``reply`` is the full text and ``latex_source`` is None.
    For Execute mode, ``reply`` is the parsed confirmation line and
    ``latex_source`` is the rewritten document body.
    """

    reply: str
    latex_source: str | None


def _classify_asset(asset: AssetInfo) -> str:
    mime = (asset.mime_type or "").lower()
    name = asset.file_name.lower()
    if mime.startswith("image/"):
        return "imagen"
    if mime == "application/pdf" or name.endswith(".pdf"):
        return "pdf"
    return "archivo"


def _build_context_block(
    latex_source: str,
    assets: list[AssetInfo],
) -> str:
    if assets:
        lines = []
        for a in assets:
            kind = _classify_asset(a)
            lines.append(f"- `{a.file_name}` ({kind}) — URL: {a.file_url}")
        assets_repr = "\n".join(lines)
    else:
        assets_repr = "(ninguno por ahora)"

    # PDFs (and any other textual asset with an excerpt) get their body
    # inlined so the model can quote / summarize / answer questions
    # against the uploaded document. Each excerpt is delimited and
    # labeled with the source file name.
    excerpt_sections: list[str] = []
    for a in assets:
        if not a.text_excerpt:
            continue
        excerpt_sections.append(
            f"### `{a.file_name}`\n```text\n{a.text_excerpt.strip()}\n```",
        )
    excerpts_block = (
        "\n\n## Contenido de los PDFs adjuntos\n"
        "Texto extraído de los archivos subidos por el usuario. Úsalo como "
        "referencia cuando el usuario pida resúmenes, citas o preguntas "
        "sobre el contenido.\n\n" + "\n\n".join(excerpt_sections)
        if excerpt_sections
        else ""
    )

    source_repr = latex_source.strip() or "(documento vacío)"
    return (
        f"## Documento LaTeX actual\n```latex\n{source_repr}\n```\n\n"
        "## Recursos disponibles\n"
        "Refiérete a cada uno por su nombre EXACTO en `\\includegraphics` "
        "para imágenes.\n"
        f"{assets_repr}"
        f"{excerpts_block}\n"
    )


_async_client = None


def _require_async_client():
    global _async_client
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OPENAI_API_KEY no configurada en el servidor.",
        )
    if _async_client is None:
        from openai import AsyncOpenAI

        _async_client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=OPENAI_TIMEOUT_SECONDS,
        )
    return _async_client


def _model_for(mode: str) -> str:
    return (
        settings.openai_model_execute
        if mode == "execute"
        else settings.openai_model_plan
    )


def _build_messages(
    mode: str,
    user_message: str,
    history: list[ChatTurn],
    latex_source: str,
    assets: list[AssetInfo],
) -> list[dict[str, str]]:
    system_prompt = (
        PLAN_SYSTEM_PROMPT if mode == "plan" else EXECUTE_SYSTEM_PROMPT
    )
    context_block = _build_context_block(latex_source, assets)
    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": context_block},
    ]
    # Drop the oldest turns when the conversation runs long — the model
    # only needs recent context plus the system prompt.
    trimmed = history[-MAX_HISTORY_TURNS:]
    for turn in trimmed:
        messages.append({"role": turn.role, "content": turn.content})
    messages.append({"role": "user", "content": user_message})
    return messages


# Boundary markers we try, in priority order. The first one to appear
# in the streamed buffer wins; everything after it routes to the LaTeX
# pipe. ``\documentclass`` is the safety net: even if the model omits
# the sentinel entirely we can still detect the document start.
_BOUNDARY_PATTERNS: tuple[str, ...] = (
    LATEX_SENTINEL,
    "```latex",
    "```tex",
    "\\documentclass",
)


def _find_boundary(buffer: str) -> tuple[int, str] | None:
    """Find the earliest LaTeX boundary marker in ``buffer``.

    Returns ``(index, matched_marker)`` or ``None`` if no marker has
    appeared yet. ``\\documentclass`` is intentionally a low-priority
    fallback — we only use it if neither the sentinel nor a fence has
    shown up.
    """
    best: tuple[int, str] | None = None
    for marker in _BOUNDARY_PATTERNS:
        idx = buffer.find(marker)
        if idx == -1:
            continue
        if best is None or idx < best[0]:
            best = (idx, marker)
    return best


def _split_on_boundary(
    buffer: str,
) -> tuple[str, str | None]:
    """Return ``(safe_reply_prefix, latex_after_boundary_or_None)``.

    While no boundary has appeared we hold back the trailing characters
    that *could* be the prefix of any known marker, so we never leak
    partial ``=`` or ``\\d`` into the chat bubble.
    """
    hit = _find_boundary(buffer)
    if hit is not None:
        idx, marker = hit
        # For ``\documentclass`` we KEEP the marker in the LaTeX side —
        # it's part of the document. For the sentinel / fence markers
        # we consume the marker itself.
        if marker == "\\documentclass":
            return buffer[:idx].rstrip(" \t\n\r`"), buffer[idx:]
        return buffer[:idx], buffer[idx + len(marker):]

    # Hold back the trailing window that could be the start of any
    # marker. We need (longest_marker - 1) chars of slack.
    hold = max(len(m) for m in _BOUNDARY_PATTERNS) - 1
    if len(buffer) <= hold:
        return "", None
    return buffer[:-hold], None


# Backwards-compatible helper retained for clarity in error messages and
# tests that targeted the old sentinel-only split. New code should use
# :func:`_split_on_boundary`.
def _split_on_sentinel(
    buffer: str, sentinel: str = LATEX_SENTINEL,
) -> tuple[str, str | None]:
    idx = buffer.find(sentinel)
    if idx != -1:
        return buffer[:idx], buffer[idx + len(sentinel):]
    hold = len(sentinel) - 1
    if len(buffer) <= hold:
        return "", None
    return buffer[:-hold], None


_FENCE_CLOSE_RE = re.compile(r"\n```\s*$")


def _strip_trailing_fence(latex: str) -> str:
    """Remove a trailing ``` fence if the model wrapped the doc in one."""
    return _FENCE_CLOSE_RE.sub("", latex).rstrip()


def _extract_latex_fallback(text: str) -> str | None:
    """Pull a LaTeX document out of ``text`` when no marker was used.

    Looks for ``\\documentclass``; if found, returns from there to the
    end of ``\\end{document}`` (or to the end of the string).
    """
    idx = text.find("\\documentclass")
    if idx == -1:
        return None
    body = text[idx:]
    end = body.find("\\end{document}")
    if end != -1:
        return body[: end + len("\\end{document}")].strip()
    return body.strip() or None


async def stream_chat_turn(
    *,
    mode: str,
    user_message: str,
    history: list[ChatTurn],
    latex_source: str,
    assets: list[AssetInfo],
) -> AsyncIterator[tuple[str, object]]:
    """Yield ``(event_kind, payload)`` tuples as OpenAI streams its reply.

    Event kinds:

    * ``"reply"`` — payload is a string chunk of the user-facing reply.
      Frontend appends it to the chat bubble.
    * ``"latex"`` — payload is a string chunk of the LaTeX body. Only
      emitted in Execute mode, *after* the boundary. Frontend appends
      it to the canvas source so the doc renders progressively.
    * ``"phase"`` — payload is a short string describing the current
      phase ("thinking", "writing-latex", "finalizing"). Frontend uses
      this to swap the streaming indicator copy.
    * ``"final"`` — payload is a :class:`StreamedResult` with the
      accumulated reply (and rewritten document for Execute mode).
    * ``"error"`` — payload is a string error message.
    """
    client = _require_async_client()
    messages = _build_messages(
        mode, user_message, history, latex_source, assets,
    )

    kwargs: dict = {
        "model": _model_for(mode),
        "messages": messages,
        "temperature": 0.3 if mode == "execute" else 0.6,
        "stream": True,
    }

    reply_acc: list[str] = []
    latex_acc: list[str] = []
    raw_acc: list[str] = []  # full stream, used for fallback extraction
    buffer = ""  # holds tokens until we know which side of the boundary
    in_latex = False

    if mode == "execute":
        yield ("phase", "thinking")

    try:
        stream = await client.chat.completions.create(**kwargs)
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if not delta:
                continue
            raw_acc.append(delta)

            if mode == "plan":
                reply_acc.append(delta)
                yield ("reply", delta)
                continue

            # Execute mode: route tokens to reply or latex based on the
            # boundary position.
            if in_latex:
                latex_acc.append(delta)
                yield ("latex", delta)
                continue

            buffer += delta
            safe_reply, latex_tail = _split_on_boundary(buffer)
            if latex_tail is None:
                if safe_reply:
                    reply_acc.append(safe_reply)
                    yield ("reply", safe_reply)
                    buffer = buffer[len(safe_reply):]
            else:
                if safe_reply:
                    reply_acc.append(safe_reply)
                    yield ("reply", safe_reply)
                in_latex = True
                buffer = ""
                yield ("phase", "writing-latex")
                if latex_tail:
                    # Trim leading whitespace right after the marker
                    # (the model usually emits a newline) but only on
                    # markers that consume themselves; ``\documentclass``
                    # is left intact because we kept it in latex_tail.
                    leading = latex_tail.lstrip("\r\n ")
                    if leading:
                        latex_acc.append(leading)
                        yield ("latex", leading)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        yield ("error", f"OpenAI: {exc}")
        return

    if mode == "execute":
        yield ("phase", "finalizing")

    # Drain any residual buffer (Execute mode where boundary never
    # appeared, or trailing chars held back as a potential marker).
    if mode == "execute" and not in_latex and buffer:
        reply_acc.append(buffer)
        yield ("reply", buffer)

    reply_text = "".join(reply_acc).strip()
    raw_text = "".join(raw_acc)

    if not reply_text and not latex_acc and not raw_text:
        yield ("error", "OpenAI devolvió una respuesta vacía.")
        return

    if mode == "plan":
        yield ("final", StreamedResult(reply=reply_text, latex_source=None))
        return

    latex_text = _strip_trailing_fence("".join(latex_acc).strip())

    # Fallback: model never emitted a recognised boundary. Try to pull
    # a LaTeX body out of the raw stream so we don't lose the work.
    if not latex_text:
        fallback = _extract_latex_fallback(raw_text)
        if fallback is not None:
            latex_text = _strip_trailing_fence(fallback)
            # The reply portion is everything BEFORE the documentclass.
            idx = raw_text.find("\\documentclass")
            if idx != -1:
                reply_text = raw_text[:idx].strip() or "Documento actualizado."

    # No LaTeX emitted — this is a valid warm-up turn (the model is
    # asking follow-up questions before rewriting the document). We
    # persist the reply as a normal assistant message and leave the
    # source untouched. Only error out if the model truly returned
    # nothing usable.
    if not latex_text:
        if not reply_text:
            yield (
                "error",
                "OpenAI devolvió una respuesta vacía. Intenta de nuevo.",
            )
            return
        yield (
            "final",
            StreamedResult(reply=reply_text, latex_source=None),
        )
        return

    yield (
        "final",
        StreamedResult(
            reply=reply_text or "Documento actualizado.",
            latex_source=latex_text,
        ),
    )
