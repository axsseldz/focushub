"""Per-user workspace activity sessions.

Mirrors :mod:`app.routes.sessions` (reading sessions) but for time spent
inside the Workspace editor. Stored as a separate table so analytics can
display reading vs. writing side by side without conflating them.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_user_id
from app.database import get_db
from app.models import WorkspaceSession
from app.schemas import WorkspaceSessionCreate, WorkspaceSessionResponse

router = APIRouter(prefix="/workspace-sessions", tags=["workspace-sessions"])


@router.get("", response_model=list[WorkspaceSessionResponse])
def list_sessions(
    since: datetime | None = Query(
        default=None,
        description="Optional ISO-8601 datetime; only sessions ending at or "
        "after this instant are returned.",
    ),
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> list[WorkspaceSession]:
    statement = select(WorkspaceSession).where(WorkspaceSession.user_id == user_id)
    if since is not None:
        statement = statement.where(WorkspaceSession.ended_at >= since)
    statement = statement.order_by(
        WorkspaceSession.started_at.desc(),
        WorkspaceSession.id.desc(),
    )
    return list(db.scalars(statement).all())


@router.post(
    "",
    response_model=WorkspaceSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: WorkspaceSessionCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> WorkspaceSession:
    session = WorkspaceSession(
        user_id=user_id,
        project_id=payload.project_id,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_seconds=payload.duration_seconds,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
