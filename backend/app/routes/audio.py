"""Narración con ElevenLabs.

POST /audio/narrate -> stream MP3.

Estrategia de caché:

1. Calculamos sha256(text + "|" + voice_id) y lo buscamos en ``audio_cache``.
2. Si existe y el MP3 sigue en disco lo servimos directamente (cache hit).
3. Si no, abrimos el stream de ElevenLabs y reenviamos cada chunk al
   cliente *mientras* lo escribimos a un archivo temporal en
   ``backend/audio_cache``. Cuando el stream termina sin errores,
   movemos el archivo a su nombre definitivo y registramos la fila en
   la DB. Si el cliente cancela (``AbortController``) el archivo
   temporal se elimina y la fila no se crea, así que la próxima vez se
   reintenta en lugar de servir un MP3 incompleto.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import uuid
from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.auth import require_user_id
from app.database import get_db
from app.models import AudioCache
from app.settings import settings

router = APIRouter(prefix="/audio", tags=["audio"])


class NarrateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    # Logical voice key (``"rous"`` / ``"diego"``) or a raw ElevenLabs
    # voice ID. Logical keys are resolved against env vars; anything
    # else is forwarded verbatim so power users can pick another voice
    # without an env change.
    voice: str = Field(min_length=1, max_length=64)


def _resolve_voice_id(voice: str) -> str:
    resolved = settings.voice_id_for(voice.lower())
    if resolved:
        return resolved
    return voice


def _hash_for(text: str, voice_id: str) -> str:
    return hashlib.sha256(f"{text}|{voice_id}".encode("utf-8")).hexdigest()


async def _stream_cached_file(path: Path) -> AsyncIterator[bytes]:
    # Async file IO via run_in_executor so we don't block the event loop
    # on disk reads for large MP3s.
    loop = asyncio.get_running_loop()
    with path.open("rb") as fh:
        while True:
            chunk = await loop.run_in_executor(None, fh.read, 64 * 1024)
            if not chunk:
                return
            yield chunk


def _open_elevenlabs_stream(text: str, voice_id: str):
    """Open the ElevenLabs streaming generator. Imported lazily so the
    backend can boot without the SDK installed (useful in CI / tests)."""
    from elevenlabs.client import ElevenLabs

    if not settings.elevenlabs_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ELEVENLABS_API_KEY no configurada en el servidor.",
        )

    client = ElevenLabs(api_key=settings.elevenlabs_api_key)
    return client.text_to_speech.stream(
        text=text,
        voice_id=voice_id,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
        voice_settings={
            "stability": 0.5,
            "similarity_boost": 0.75,
        },
    )


async def _open_and_prime(
    text: str, voice_id: str,
) -> tuple[object, bytes | None]:
    """Open the ElevenLabs stream and pull the first chunk so any
    provider-level error (401 / 402 / 429 / etc.) surfaces *before*
    we commit to a 200 ``StreamingResponse``."""
    loop = asyncio.get_running_loop()
    sync_iter = await loop.run_in_executor(
        None, _open_elevenlabs_stream, text, voice_id,
    )

    def _first():
        try:
            return next(sync_iter)
        except StopIteration:
            return None

    first_chunk = await loop.run_in_executor(None, _first)
    return sync_iter, first_chunk


async def _stream_and_cache(
    sync_iter,
    first_chunk: bytes | None,
    text_hash: str,
    voice_id: str,
    final_path: Path,
    db_session_factory,
) -> AsyncIterator[bytes]:
    """Fan out ElevenLabs chunks to (a) the HTTP response and (b) a
    temp file. The first chunk is passed in pre-fetched so provider
    errors don't end up masquerading as a successful empty 200."""

    tmp_path = final_path.with_name(f".{final_path.name}.{uuid.uuid4().hex}.part")
    loop = asyncio.get_running_loop()
    completed = False

    def _open_tmp():
        return tmp_path.open("wb")

    def _write(fh, data: bytes) -> None:
        fh.write(data)

    def _close(fh) -> None:
        fh.close()

    def _unlink_tmp() -> None:
        try:
            tmp_path.unlink()
        except FileNotFoundError:
            pass

    fh = await loop.run_in_executor(None, _open_tmp)
    try:
        def _next_chunk():
            try:
                return next(sync_iter)
            except StopIteration:
                return None

        if first_chunk is None:
            # Empty body — treat as success but record nothing.
            completed = True
            return

        await loop.run_in_executor(None, _write, fh, first_chunk)
        yield first_chunk

        while True:
            chunk = await loop.run_in_executor(None, _next_chunk)
            if chunk is None:
                completed = True
                break
            if not chunk:
                continue
            await loop.run_in_executor(None, _write, fh, chunk)
            yield chunk
    finally:
        await loop.run_in_executor(None, _close, fh)
        if completed:
            try:
                os.replace(tmp_path, final_path)
            except OSError:
                # Filesystem error: drop the temp file. Next call retries.
                await loop.run_in_executor(None, _unlink_tmp)
            else:
                # Record the cache row in a fresh short-lived session so
                # the request's session lifecycle stays predictable.
                def _persist():
                    with db_session_factory() as db:
                        existing = db.get(AudioCache, text_hash)
                        if existing is None:
                            db.add(
                                AudioCache(
                                    text_hash=text_hash,
                                    voice_id=voice_id,
                                    file_path=str(final_path),
                                ),
                            )
                            db.commit()

                await loop.run_in_executor(None, _persist)
        else:
            await loop.run_in_executor(None, _unlink_tmp)


@router.post("/narrate")
async def narrate(
    payload: NarrateRequest,
    db: Session = Depends(get_db),
    _user_id: str = Depends(require_user_id),
) -> StreamingResponse:
    voice_id = _resolve_voice_id(payload.voice)
    text_hash = _hash_for(payload.text, voice_id)

    cached = db.get(AudioCache, text_hash)
    if cached is not None:
        cached_path = Path(cached.file_path)
        if cached_path.exists():
            return StreamingResponse(
                _stream_cached_file(cached_path),
                media_type="audio/mpeg",
                headers={
                    "Cache-Control": "public, max-age=31536000, immutable",
                    "X-Audio-Cache": "hit",
                },
            )
        # Row exists but the file is gone — clean up so we re-synthesise.
        db.delete(cached)
        db.commit()

    final_path = settings.audio_cache_dir / f"{text_hash}.mp3"

    # Capture the sessionmaker via closure so the streaming generator
    # can open its own session after the request's db is gone.
    from app.database import SessionLocal

    # Pre-fetch the first chunk so provider errors (402 paid voice,
    # 401 bad key, 429 quota, …) come back as a real HTTP error
    # instead of a 200 with an empty body that the browser would
    # report as "se interrumpió la reproducción".
    try:
        sync_iter, first_chunk = await _open_and_prime(payload.text, voice_id)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001 - we want to surface anything
        message = _format_provider_error(exc)
        status_code = _provider_status(exc)
        return JSONResponse(
            status_code=status_code,
            content={"detail": message},
        )

    return StreamingResponse(
        _stream_and_cache(
            sync_iter=sync_iter,
            first_chunk=first_chunk,
            text_hash=text_hash,
            voice_id=voice_id,
            final_path=final_path,
            db_session_factory=SessionLocal,
        ),
        media_type="audio/mpeg",
        headers={"X-Audio-Cache": "miss"},
    )


def _format_provider_error(exc: Exception) -> str:
    """Best-effort human-readable message from an ElevenLabs ``ApiError``.
    Falls back to ``str(exc)`` for anything we don't recognise."""
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        detail = body.get("detail")
        if isinstance(detail, dict):
            msg = detail.get("message")
            if msg:
                return str(msg)
        if isinstance(detail, str):
            return detail
    return str(exc) or "ElevenLabs no pudo generar el audio."


def _provider_status(exc: Exception) -> int:
    code = getattr(exc, "status_code", None)
    if isinstance(code, int) and 400 <= code < 600:
        # Surface 4xx as-is so the frontend can react (e.g. show the
        # 402 paid-voice message). Map everything else to 502.
        return code if code < 500 else status.HTTP_502_BAD_GATEWAY
    return status.HTTP_502_BAD_GATEWAY
