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
Eres "The Architect", un ingeniero senior que asiste a escribir documentos
LaTeX de calidad profesional. Estás en modo **Plan / Brainstorming**.

Reglas:
- Piensa estratégicamente: estructura, secciones, qué figuras incluir,
  qué tablas conviene, en qué orden.
- Puedes proponer alternativas y hacer preguntas concisas si ayuda a
  desambiguar. No bombardees al usuario con preguntas.
- NO escribas LaTeX final en este modo. Si el usuario pide código, dile
  que cambie a Execute.
- Responde en el idioma del usuario (español por defecto).
- Si el usuario pide "plan de acción", devuelve una lista numerada y
  breve de los pasos técnicos que harías al cambiar a Execute.
"""


LATEX_SENTINEL = "===LATEX==="


EXECUTE_SYSTEM_PROMPT = f"""\
Eres "The Architect", un ingeniero senior que escribe LaTeX. Estás en
modo **Execute**. El servidor compila tu salida con Tectonic, así que
el `.tex` DEBE compilar sin errores.

Formato de respuesta OBLIGATORIO (texto plano, sin markdown ni JSON):

  <una sola oración corta de confirmación, en español>
  {LATEX_SENTINEL}
  <documento .tex COMPLETO actualizado>

Reglas estrictas:
- La PRIMERA línea es la confirmación (una sola frase).
- La SEGUNDA línea es EXACTAMENTE `{LATEX_SENTINEL}`.
- A partir de la TERCERA línea: el documento `.tex` COMPLETO.
- Empieza siempre con `\\documentclass{{article}}` (u otra clase
  estándar como `report`/`book`) e incluye los paquetes que uses.
- Para imágenes usa `\\usepackage{{graphicx}}`. Para esquinas/posición
  libre usa `\\usepackage[absolute,overlay]{{textpos}}` (Tectonic ya lo
  trae). Para idioma español acentos UTF-8 funciona directo —
  `\\usepackage[utf8]{{inputenc}}` opcional.
- Referencia los assets por nombre EXACTO (sensible a mayúsculas)
  con `\\includegraphics[...]{{nombre.ext}}`. Solo usa nombres que
  aparecen en la lista de assets que recibirás como contexto.
- Para reporte con portada: usa `\\newpage` entre la portada y el
  contenido. Para imágenes en esquinas usa `textpos`:

    \\begin{{textblock*}}{{4cm}}(1cm,1cm)\\includegraphics[width=4cm]{{uabc.png}}\\end{{textblock*}}

- NO envuelvas el documento en bloques ``` ni ningún delimitador.
- Si la instrucción es ambigua, haz tu mejor interpretación y aplica
  el cambio; menciona el supuesto en la confirmación.
- IMPORTANTE: evita paquetes exóticos o que requieran shell-escape.
  Tectonic NO ejecuta shell-escape.
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

    if not latex_text:
        yield (
            "error",
            "OpenAI no devolvió el documento. Intenta de nuevo o usa Plan.",
        )
        return

    yield (
        "final",
        StreamedResult(
            reply=reply_text or "Documento actualizado.",
            latex_source=latex_text,
        ),
    )
