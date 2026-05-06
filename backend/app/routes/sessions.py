from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ReadingSession
from app.schemas import ReadingSessionCreate, ReadingSessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=list[ReadingSessionResponse])
def list_sessions(
    since: datetime | None = Query(
        default=None,
        description="Optional ISO-8601 datetime; only sessions ending at or "
        "after this instant are returned. Useful for limiting the heatmap "
        "window to e.g. the last 365 days.",
    ),
    db: Session = Depends(get_db),
) -> list[ReadingSession]:
    statement = select(ReadingSession)
    if since is not None:
        statement = statement.where(ReadingSession.ended_at >= since)
    statement = statement.order_by(
        ReadingSession.started_at.desc(),
        ReadingSession.id.desc(),
    )
    return list(db.scalars(statement).all())


@router.post(
    "",
    response_model=ReadingSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: ReadingSessionCreate,
    db: Session = Depends(get_db),
) -> ReadingSession:
    session = ReadingSession(
        book_id=payload.book_id,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        duration_seconds=payload.duration_seconds,
        pages_read=payload.pages_read,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session
