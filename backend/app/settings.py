"""Backend settings sourced from environment variables.

Secrets for ElevenLabs live in ``frontend/.env.local`` (the user keeps a
single env file for the whole project). We load that file at import time
so any module can read the values via :data:`settings`.

``backend/.env`` — if present — wins over the frontend file. This lets a
developer override a value locally without touching the frontend env.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = _BACKEND_DIR.parent
_FRONTEND_ENV = _REPO_ROOT / "frontend" / ".env.local"
_BACKEND_ENV = _BACKEND_DIR / ".env"

# Load order: frontend/.env.local first, then backend/.env which can
# override. ``override=True`` on the second call makes that explicit.
if _FRONTEND_ENV.exists():
    load_dotenv(_FRONTEND_ENV, override=False)
if _BACKEND_ENV.exists():
    load_dotenv(_BACKEND_ENV, override=True)


@dataclass(frozen=True)
class Settings:
    elevenlabs_api_key: str | None
    voice_id_rous: str | None
    voice_id_diego: str | None
    audio_cache_dir: Path
    openai_api_key: str | None
    openai_model_plan: str
    openai_model_execute: str

    def voice_id_for(self, key: str) -> str | None:
        """Resolve a logical voice key (``"rous"`` / ``"diego"``) to the
        ElevenLabs voice ID configured in env, or ``None`` if missing."""
        if key == "rous":
            return self.voice_id_rous
        if key == "diego":
            return self.voice_id_diego
        return None


_AUDIO_CACHE_DIR = _BACKEND_DIR / "audio_cache"
_AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

settings = Settings(
    elevenlabs_api_key=os.getenv("ELEVENLABS_API_KEY"),
    voice_id_rous=os.getenv("ELEVENLABS_VOICE_ID_ROUS"),
    voice_id_diego=os.getenv("ELEVENLABS_VOICE_ID_DIEGO"),
    audio_cache_dir=_AUDIO_CACHE_DIR,
    openai_api_key=os.getenv("OPENAI_API_KEY"),
    # gpt-4o-mini is ~3-4x faster than gpt-4o and quality is more than
    # enough for LaTeX scaffolding + chat. The user can override per
    # mode if a turn needs deeper reasoning.
    openai_model_plan=os.getenv(
        "OPENAI_MODEL_PLAN",
        os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    ),
    openai_model_execute=os.getenv(
        "OPENAI_MODEL_EXECUTE",
        os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
    ),
)
