"""Workspace — LaTeX projects authored with help from "The Architect".

Each project belongs to a user, has a single ``.tex`` blob as its body,
plus a list of uploaded assets (images / docs) and a chat history. The
chat history is fed back to OpenAI on every turn so the assistant has
memory across Plan and Execute switches.

The ``Sync to Library`` endpoint converts the current LaTeX into a PDF
entry in the existing ``files`` table so the document shows up next to
the user's books in ``/lectura``.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import require_user_id
from app.database import SessionLocal, get_db
from app.latex_compile import (
    AssetForCompile,
    CompileError,
    TectonicMissingError,
    compile_latex_to_pdf,
)
from app.models import File, WorkspaceAsset, WorkspaceMessage, WorkspaceProject
from app.openai_client import (
    AssetInfo,
    ChatTurn,
    StreamedResult,
    stream_chat_turn,
)
from app.pdf_extract import extract_pdf_text_from_url
from app.schemas import (
    WorkspaceAssetCreate,
    WorkspaceAssetResponse,
    WorkspaceChatRequest,
    WorkspaceMessageResponse,
    WorkspaceProjectCreate,
    WorkspaceProjectDetail,
    WorkspaceProjectResponse,
    WorkspaceProjectUpdate,
    WorkspaceSyncRequest,
    WorkspaceSyncResponse,
)

router = APIRouter(prefix="/workspace", tags=["workspace"])


DEFAULT_LATEX_TEMPLATE = """\
\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}

\\begin{document}
\\thispagestyle{empty}
\\mbox{}
\\end{document}
"""


def _get_owned_project(
    db: Session, project_id: int, user_id: str,
) -> WorkspaceProject:
    project = db.get(WorkspaceProject, project_id)
    if project is None or project.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proyecto no encontrado.",
        )
    return project


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@router.get("/projects", response_model=list[WorkspaceProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> list[WorkspaceProject]:
    statement = (
        select(WorkspaceProject)
        .where(WorkspaceProject.user_id == user_id)
        .order_by(WorkspaceProject.updated_at.desc(), WorkspaceProject.id.desc())
    )
    return list(db.scalars(statement).all())


@router.post(
    "/projects",
    response_model=WorkspaceProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: WorkspaceProjectCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> WorkspaceProject:
    project = WorkspaceProject(
        user_id=user_id,
        title=payload.title.strip(),
        latex_source=(payload.latex_source or DEFAULT_LATEX_TEMPLATE),
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=WorkspaceProjectDetail)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> WorkspaceProjectDetail:
    project = _get_owned_project(db, project_id, user_id)
    assets = list(
        db.scalars(
            select(WorkspaceAsset)
            .where(WorkspaceAsset.project_id == project.id)
            .order_by(WorkspaceAsset.created_at.asc(), WorkspaceAsset.id.asc()),
        ).all(),
    )
    messages = list(
        db.scalars(
            select(WorkspaceMessage)
            .where(WorkspaceMessage.project_id == project.id)
            .order_by(WorkspaceMessage.created_at.asc(), WorkspaceMessage.id.asc()),
        ).all(),
    )
    return WorkspaceProjectDetail(
        id=project.id,
        title=project.title,
        latex_source=project.latex_source,
        last_exported_file_id=project.last_exported_file_id,
        created_at=project.created_at,
        updated_at=project.updated_at,
        assets=[WorkspaceAssetResponse.model_validate(a) for a in assets],
        messages=[WorkspaceMessageResponse.model_validate(m) for m in messages],
    )


@router.patch("/projects/{project_id}", response_model=WorkspaceProjectResponse)
def update_project(
    project_id: int,
    payload: WorkspaceProjectUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> WorkspaceProject:
    project = _get_owned_project(db, project_id, user_id)
    if payload.title is not None:
        project.title = payload.title.strip()
    if payload.latex_source is not None:
        project.latex_source = payload.latex_source
    db.commit()
    db.refresh(project)
    return project


@router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> Response:
    """Delete a project and every row that referenced it.

    SQLite needs ``PRAGMA foreign_keys = ON`` for the CASCADE on
    ``WorkspaceAsset`` / ``WorkspaceMessage`` to actually fire (we set
    that pragma on every connection now). Doing the deletes explicitly
    here in addition is defense in depth — keeps the route correct even
    if that pragma is ever inadvertently disabled on a future engine.
    """
    project = _get_owned_project(db, project_id, user_id)
    db.execute(
        delete(WorkspaceMessage).where(WorkspaceMessage.project_id == project.id),
    )
    db.execute(
        delete(WorkspaceAsset).where(WorkspaceAsset.project_id == project.id),
    )
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------


@router.post(
    "/projects/{project_id}/assets",
    response_model=WorkspaceAssetResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_asset(
    project_id: int,
    payload: WorkspaceAssetCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> WorkspaceAsset:
    project = _get_owned_project(db, project_id, user_id)
    file_name = payload.file_name.strip()
    mime_type = payload.mime_type
    # For PDFs, pre-extract the text once so subsequent chat turns can
    # include the body as context without re-downloading. Failures are
    # tolerated — the file stays usable with just its name + URL.
    text_excerpt: str | None = None
    is_pdf = (mime_type == "application/pdf") or file_name.lower().endswith(".pdf")
    if is_pdf:
        text_excerpt = extract_pdf_text_from_url(payload.file_url)
    asset = WorkspaceAsset(
        project_id=project.id,
        user_id=user_id,
        file_name=file_name,
        file_url=payload.file_url,
        mime_type=mime_type,
        text_excerpt=text_excerpt,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete(
    "/projects/{project_id}/assets/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_asset(
    project_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> Response:
    _get_owned_project(db, project_id, user_id)
    asset = db.get(WorkspaceAsset, asset_id)
    if asset is None or asset.project_id != project_id or asset.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Asset no encontrado.",
        )
    db.delete(asset)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------


def _sse(event: dict) -> str:
    """Format a Server-Sent Event payload.

    Each event is a single ``data:`` line with a JSON-encoded body. We
    keep events to one line to dodge SSE's awkward multi-line parsing.
    """
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.post("/projects/{project_id}/chat")
async def post_chat_message(
    project_id: int,
    payload: WorkspaceChatRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> StreamingResponse:
    """Stream the assistant's reply as Server-Sent Events.

    The endpoint persists the user turn immediately, then opens an SSE
    stream that emits:

    * ``{"type":"user_message", "message": <WorkspaceMessageResponse>}``
      so the client can replace its optimistic temp row with the real id.
    * ``{"type":"delta", "content": "<token>"}`` while OpenAI streams.
    * ``{"type":"done", "message": <...>, "latex_source": <str|None>}``
      once the assistant turn is saved.
    * ``{"type":"error", "message": "<reason>"}`` on failure. The user
      message stays in the DB so the client can retry.
    """
    project = _get_owned_project(db, project_id, user_id)

    user_msg = WorkspaceMessage(
        project_id=project.id,
        user_id=user_id,
        role="user",
        mode=payload.mode,
        content=payload.message,
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)
    user_msg_id = user_msg.id

    history_rows = list(
        db.scalars(
            select(WorkspaceMessage)
            .where(WorkspaceMessage.project_id == project.id)
            .where(WorkspaceMessage.id < user_msg_id)
            .order_by(WorkspaceMessage.created_at.asc(), WorkspaceMessage.id.asc()),
        ).all(),
    )
    history = [
        ChatTurn(role=row.role, content=row.content) for row in history_rows
    ]
    asset_rows = list(
        db.scalars(
            select(WorkspaceAsset)
            .where(WorkspaceAsset.project_id == project.id)
            .order_by(WorkspaceAsset.created_at.asc(), WorkspaceAsset.id.asc()),
        ).all(),
    )
    assets_info = [
        AssetInfo(
            file_name=a.file_name,
            file_url=a.file_url,
            mime_type=a.mime_type,
            text_excerpt=a.text_excerpt,
        )
        for a in asset_rows
    ]

    # Snapshot what we need before closing the request-scoped session.
    # The streaming generator opens its own short-lived session for the
    # final commit so we don't hold a connection during the OpenAI call.
    project_id_local = project.id
    mode = payload.mode
    user_message_text = payload.message
    latex_source = project.latex_source
    user_message_response = WorkspaceMessageResponse.model_validate(user_msg)

    async def event_stream():
        # First event: the persisted user message (so the client can
        # reconcile its optimistic temp row with the real id).
        yield _sse(
            {
                "type": "user_message",
                "message": json.loads(user_message_response.model_dump_json()),
            },
        )

        final_result: StreamedResult | None = None
        try:
            async for kind, value in stream_chat_turn(
                mode=mode,
                user_message=user_message_text,
                history=history,
                latex_source=latex_source,
                assets=assets_info,
            ):
                if kind == "reply":
                    yield _sse({"type": "reply", "content": value})
                elif kind == "latex":
                    yield _sse({"type": "latex", "content": value})
                elif kind == "phase":
                    yield _sse({"type": "phase", "phase": str(value)})
                elif kind == "final":
                    final_result = value  # type: ignore[assignment]
                elif kind == "error":
                    yield _sse({"type": "error", "message": str(value)})
                    return
        except Exception as exc:  # noqa: BLE001
            yield _sse({"type": "error", "message": str(exc)})
            return

        if final_result is None:
            yield _sse(
                {"type": "error", "message": "Sin respuesta del modelo."},
            )
            return

        # Persist the assistant turn in a fresh session — the request's
        # original db has long been closed by FastAPI.
        with SessionLocal() as db_final:
            project_final = db_final.get(WorkspaceProject, project_id_local)
            if project_final is None:
                yield _sse(
                    {"type": "error", "message": "El proyecto ya no existe."},
                )
                return
            if final_result.latex_source is not None:
                project_final.latex_source = final_result.latex_source
            assistant = WorkspaceMessage(
                project_id=project_final.id,
                user_id=project_final.user_id,
                role="assistant",
                mode=mode,
                content=final_result.reply,
            )
            db_final.add(assistant)
            db_final.commit()
            db_final.refresh(assistant)
            assistant_response = WorkspaceMessageResponse.model_validate(
                assistant,
            )

        yield _sse(
            {
                "type": "done",
                "message": json.loads(assistant_response.model_dump_json()),
                "latex_source": final_result.latex_source,
            },
        )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            # Disable proxy buffering so tokens reach the client
            # immediately even behind nginx-style reverse proxies.
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# Compile to PDF (Tectonic)
# ---------------------------------------------------------------------------


@router.get("/projects/{project_id}/pdf")
def compile_project_pdf(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> Response:
    """Compile the project's current LaTeX source and stream the PDF.

    The frontend hits this once GPT finishes a turn (and on first
    open) to swap in a freshly rendered PDF on the canvas. The result
    is cached by content hash, so repeat calls with unchanged source
    are effectively free.
    """
    project = _get_owned_project(db, project_id, user_id)
    asset_rows = list(
        db.scalars(
            select(WorkspaceAsset)
            .where(WorkspaceAsset.project_id == project.id)
            .order_by(WorkspaceAsset.created_at.asc(), WorkspaceAsset.id.asc()),
        ).all(),
    )
    compile_assets = [
        AssetForCompile(file_name=a.file_name, file_url=a.file_url)
        for a in asset_rows
    ]
    latex_source = project.latex_source

    try:
        # ``def`` endpoints already run inside FastAPI's threadpool, so
        # the blocking subprocess.run inside tectonic doesn't stall the
        # event loop here.
        pdf_bytes = compile_latex_to_pdf(
            latex_source=latex_source,
            assets=compile_assets,
        )
    except TectonicMissingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except CompileError as exc:
        # Tail the tectonic log so the user sees the actual TeX error
        # without paging through 100s of lines.
        tail = (exc.log or "").splitlines()[-25:]
        detail = "\n".join([str(exc), *tail])
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail,
        ) from exc

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            # Cache-Control is conservative: the frontend revalidates by
            # re-fetching after each Execute turn anyway, and the URL
            # itself is per-project rather than per-content-hash.
            "Cache-Control": "no-store",
            "Content-Disposition": "inline",
        },
    )


# ---------------------------------------------------------------------------
# Sync to Library
# ---------------------------------------------------------------------------


@router.post(
    "/projects/{project_id}/sync-to-library",
    response_model=WorkspaceSyncResponse,
)
def sync_to_library(
    project_id: int,
    payload: WorkspaceSyncRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> WorkspaceSyncResponse:
    """Compile the project's LaTeX to PDF and add it to the user's library.

    The library at ``/lectura`` filters to ``.pdf`` files only, so we
    must compile the .tex into a real PDF here (Tectonic, same path
    used by ``GET /pdf``). The compiled bytes are embedded as a base64
    ``data:application/pdf`` URL so the export is fully self-contained
    and survives without an extra storage backend.
    """
    project = _get_owned_project(db, project_id, user_id)
    display_name = (payload.display_name or project.title).strip()
    file_name = f"{display_name}.pdf"

    asset_rows = list(
        db.scalars(
            select(WorkspaceAsset)
            .where(WorkspaceAsset.project_id == project.id)
            .order_by(WorkspaceAsset.created_at.asc(), WorkspaceAsset.id.asc()),
        ).all(),
    )
    compile_assets = [
        AssetForCompile(file_name=a.file_name, file_url=a.file_url)
        for a in asset_rows
    ]

    try:
        pdf_bytes = compile_latex_to_pdf(
            latex_source=project.latex_source,
            assets=compile_assets,
        )
    except TectonicMissingError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except CompileError as exc:
        tail = (exc.log or "").splitlines()[-25:]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="\n".join([str(exc), *tail]),
        ) from exc

    import base64

    encoded = base64.b64encode(pdf_bytes).decode("ascii")
    data_url = f"data:application/pdf;base64,{encoded}"

    existing: File | None = None
    if project.last_exported_file_id is not None:
        existing = db.get(File, project.last_exported_file_id)
        if existing is not None and existing.user_id != user_id:
            existing = None

    if existing is None:
        new_file = File(
            user_id=user_id,
            file_url=data_url,
            file_name=file_name,
            display_name=display_name,
        )
        db.add(new_file)
        db.commit()
        db.refresh(new_file)
        project.last_exported_file_id = new_file.id
        db.commit()
        return WorkspaceSyncResponse(
            file_id=new_file.id,
            file_url=new_file.file_url,
            file_name=new_file.file_name,
        )

    existing.file_url = data_url
    existing.file_name = file_name
    existing.display_name = display_name
    db.commit()
    db.refresh(existing)
    return WorkspaceSyncResponse(
        file_id=existing.id,
        file_url=existing.file_url,
        file_name=existing.file_name,
    )
