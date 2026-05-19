"""LaTeX → PDF compilation via Tectonic.

Why Tectonic instead of pdflatex:
- single static binary, no TeX Live install dance
- downloads missing CTAN packages on first use, caches them
- handles cross-references (TOC, refs) in a single invocation

The compile pipeline is intentionally synchronous and tied to its own
thread via FastAPI's ``run_in_threadpool``: tectonic blocks for a few
seconds on a cold cache (longer the first time it has to pull
packages), so we keep it off the event loop.

Each compile uses a fresh temp dir so two parallel projects can't
poison each other's auxiliary files. Assets referenced from the
document are downloaded into the same dir with their original
filenames so ``\\includegraphics{logo.png}`` resolves the way the user
expects.
"""

from __future__ import annotations

import hashlib
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

import httpx

# How long we let Tectonic chew before pulling the plug. First-run can
# be slow because it downloads CTAN bundles; subsequent compiles are
# usually well under 5s.
COMPILE_TIMEOUT_SECONDS = 90.0

# Per-asset download timeout. Uploadcare CDN is fast, but a misbehaving
# URL shouldn't hold up the whole compile.
ASSET_DOWNLOAD_TIMEOUT_SECONDS = 15.0

# Where compiled PDFs live on disk. We key by hash(latex_source +
# asset_signature) so repeat compiles of the same content reuse the
# cached file instead of paying the tectonic round-trip again.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_PDF_CACHE_DIR = _BACKEND_DIR / "workspace_pdf_cache"
_PDF_CACHE_DIR.mkdir(parents=True, exist_ok=True)
# Downloaded assets are cached by URL hash so a project's compile only
# pays the HTTP cost once per asset.
_ASSET_CACHE_DIR = _BACKEND_DIR / "workspace_asset_cache"
_ASSET_CACHE_DIR.mkdir(parents=True, exist_ok=True)


class TectonicMissingError(RuntimeError):
    """Raised when the ``tectonic`` binary cannot be located."""


class CompileError(RuntimeError):
    """Raised when tectonic ran but returned a non-zero exit. ``log``
    carries the captured stderr/stdout so the route can surface a
    truncated tail to the user."""

    def __init__(self, message: str, log: str) -> None:
        super().__init__(message)
        self.log = log


@dataclass
class AssetForCompile:
    file_name: str
    file_url: str


def _tectonic_path() -> str:
    path = shutil.which("tectonic")
    if not path:
        raise TectonicMissingError(
            "El binario 'tectonic' no está disponible en el PATH del backend. "
            "Instálalo con 'brew install tectonic'.",
        )
    return path


def _asset_cache_path(url: str, file_name: str) -> Path:
    """Stable on-disk path for an asset URL.

    We keep the original filename as a suffix so debugging the cache
    dir doesn't look like a pile of opaque hex blobs.
    """
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
    safe_name = file_name.replace("/", "_").replace("\\", "_")
    return _ASSET_CACHE_DIR / f"{digest}__{safe_name}"


def _download_asset(client: httpx.Client, asset: AssetForCompile) -> Path:
    cache_path = _asset_cache_path(asset.file_url, asset.file_name)
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return cache_path
    resp = client.get(asset.file_url, timeout=ASSET_DOWNLOAD_TIMEOUT_SECONDS)
    resp.raise_for_status()
    # Write atomically so a partial download from a previous run can't
    # be mistaken for a finished cache entry.
    tmp = cache_path.with_suffix(cache_path.suffix + ".part")
    tmp.write_bytes(resp.content)
    tmp.replace(cache_path)
    return cache_path


def _cache_key(latex_source: str, assets: list[AssetForCompile]) -> str:
    h = hashlib.sha256()
    h.update(latex_source.encode("utf-8"))
    # Asset names matter for \includegraphics lookup, URLs matter so a
    # CDN URL swap invalidates the cache.
    for a in sorted(assets, key=lambda x: x.file_name):
        h.update(b"\0")
        h.update(a.file_name.encode("utf-8"))
        h.update(b"\0")
        h.update(a.file_url.encode("utf-8"))
    return h.hexdigest()


def _run_tectonic(work_dir: Path, tex_path: Path) -> Path:
    """Invoke tectonic in ``work_dir`` and return the PDF path."""
    binary = _tectonic_path()
    # ``-X compile`` is the V2 single-file mode; ``--keep-logs`` lets
    # us tail the log on failure.
    try:
        proc = subprocess.run(
            [
                binary,
                "-X",
                "compile",
                "--keep-logs",
                str(tex_path),
            ],
            cwd=str(work_dir),
            capture_output=True,
            text=True,
            timeout=COMPILE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise CompileError(
            "La compilación excedió el tiempo límite.",
            log=str(exc.stderr or exc.stdout or ""),
        ) from exc

    pdf_path = tex_path.with_suffix(".pdf")
    if proc.returncode != 0 or not pdf_path.exists():
        # Tectonic puts the most useful info in stderr.
        log = (proc.stderr or "") + (proc.stdout or "")
        raise CompileError(
            "Tectonic falló al compilar el documento.",
            log=log,
        )
    return pdf_path


def compile_latex_to_pdf(
    *,
    latex_source: str,
    assets: list[AssetForCompile],
) -> bytes:
    """Compile ``latex_source`` into a PDF and return its bytes.

    Cache hits short-circuit the whole pipeline. On a cache miss we:

    1. Create a temp work dir.
    2. Download every asset (or pull it from the on-disk asset cache).
    3. Drop ``main.tex`` next to them.
    4. Run tectonic.
    5. Persist the resulting PDF into the cache and return its bytes.
    """
    if not latex_source.strip():
        raise CompileError(
            "El documento está vacío.",
            log="",
        )

    key = _cache_key(latex_source, assets)
    cached = _PDF_CACHE_DIR / f"{key}.pdf"
    if cached.exists() and cached.stat().st_size > 0:
        return cached.read_bytes()

    with tempfile.TemporaryDirectory(prefix="ws-tex-") as raw_dir:
        work_dir = Path(raw_dir)

        if assets:
            with httpx.Client(follow_redirects=True) as client:
                for asset in assets:
                    try:
                        cached_asset = _download_asset(client, asset)
                    except httpx.HTTPError:
                        # A failed asset shouldn't tank the entire
                        # compile. The document will just render a
                        # missing-image placeholder.
                        continue
                    shutil.copyfile(cached_asset, work_dir / asset.file_name)

        tex_path = work_dir / "main.tex"
        tex_path.write_text(latex_source, encoding="utf-8")

        pdf_path = _run_tectonic(work_dir, tex_path)
        data = pdf_path.read_bytes()

    cached.write_bytes(data)
    return data
