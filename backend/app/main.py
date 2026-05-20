from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine, ensure_database_schema
from app.routes.audio import router as audio_router
from app.routes.files import router as files_router
from app.routes.sessions import router as sessions_router
from app.routes.workspace import router as workspace_router
from app.routes.workspace_sessions import router as workspace_sessions_router
from app.settings import settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_database_schema()
    yield


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(files_router)
app.include_router(sessions_router)
app.include_router(audio_router)
app.include_router(workspace_router)
app.include_router(workspace_sessions_router)

# Sirve los MP3 cacheados directamente. Permite reproducir audios ya
# generados sin pasar por el endpoint de streaming (útil para repetir
# o pre-cargar un párrafo).
app.mount(
    "/audio-cache",
    StaticFiles(directory=settings.audio_cache_dir),
    name="audio-cache",
)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Backend running..."}
