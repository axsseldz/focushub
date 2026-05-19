"""Best-effort PDF text extraction for workspace assets.

We pull the bytes from the asset URL (typically the Uploadcare CDN, but
any HTTP URL works), run ``pypdf`` over it, and return a truncated text
excerpt suitable for prompting. Failures are swallowed and yield
``None`` — the chat keeps working with just the file name + URL when
extraction is not possible (scanned PDFs, oddly-encoded ones, network
hiccups).
"""

from __future__ import annotations

import io
import logging

import httpx

logger = logging.getLogger(__name__)

# Cap each PDF excerpt so a single big paper can't blow up the prompt.
# 12k chars is roughly 3-4k tokens — enough for the model to skim
# methodology / abstracts of a typical research PDF.
_MAX_CHARS_PER_PDF = 12_000

# Hard ceiling on the download itself. Uploadcare lets users push much
# bigger PDFs but we don't want to OOM the backend or stall on slow
# transfers — drop anything past this and try to parse what we got.
_MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024  # 25 MB

_HTTP_TIMEOUT = 20.0  # seconds


def extract_pdf_text_from_url(url: str) -> str | None:
    """Download the PDF at ``url`` and return up to ``_MAX_CHARS_PER_PDF``
    characters of extracted text. Returns ``None`` if anything goes wrong
    (network error, not a parseable PDF, etc.).
    """
    try:
        with httpx.Client(follow_redirects=True, timeout=_HTTP_TIMEOUT) as client:
            with client.stream("GET", url) as response:
                response.raise_for_status()
                buf = bytearray()
                for chunk in response.iter_bytes():
                    buf.extend(chunk)
                    if len(buf) >= _MAX_DOWNLOAD_BYTES:
                        break
    except (httpx.HTTPError, OSError) as exc:
        logger.warning("PDF download failed for %s: %s", url, exc)
        return None

    if not buf:
        return None

    # Defer the import — pypdf isn't tiny and we don't want to pay the
    # cost for processes that never touch workspace assets.
    try:
        from pypdf import PdfReader
        from pypdf.errors import PdfReadError
    except ImportError:
        logger.warning("pypdf not installed; skipping PDF text extraction.")
        return None

    try:
        reader = PdfReader(io.BytesIO(buf))
    except (PdfReadError, OSError, ValueError) as exc:
        logger.warning("PdfReader failed for %s: %s", url, exc)
        return None

    parts: list[str] = []
    total = 0
    for page in reader.pages:
        try:
            page_text = page.extract_text() or ""
        except Exception as exc:  # noqa: BLE001 — pypdf can raise broadly
            logger.warning("extract_text failed for %s: %s", url, exc)
            continue
        page_text = page_text.strip()
        if not page_text:
            continue
        parts.append(page_text)
        total += len(page_text)
        if total >= _MAX_CHARS_PER_PDF:
            break

    if not parts:
        return None

    joined = "\n\n".join(parts).strip()
    if len(joined) > _MAX_CHARS_PER_PDF:
        joined = joined[:_MAX_CHARS_PER_PDF].rstrip() + "\n[…truncado…]"
    return joined
