from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import require_user_id
from app.database import get_db
from app.models import File, ReadingProgress, ReadingSession
from app.schemas import (
    FileCreate,
    FileResponse,
    FileUpdate,
    ReadingProgressResponse,
    ReadingProgressUpsert,
)

router = APIRouter(prefix="/files", tags=["files"])


@router.get("", response_model=list[FileResponse])
def list_files(
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> list[File]:
    statement = (
        select(File)
        .where(File.user_id == user_id)
        .order_by(File.created_at.desc(), File.id.desc())
    )
    return list(db.scalars(statement).all())


@router.post("", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
def create_file(
    file_in: FileCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> File:
    db_file = File(
        user_id=user_id,
        file_url=file_in.file_url,
        file_name=file_in.file_name,
        thumbnail_url=file_in.thumbnail_url,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file


@router.patch("/{file_id}", response_model=FileResponse)
def update_file(
    file_id: int,
    file_in: FileUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> File:
    db_file = db.get(File, file_id)

    if db_file is None or db_file.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado.",
        )

    # Rename updates the user-facing display name only. The original
    # `file_name` is preserved so the library filter (which trusts the
    # original extension) keeps working after a rename.
    if file_in.display_name is not None:
        db_file.display_name = file_in.display_name.strip() or None
    if file_in.page_count is not None:
        db_file.page_count = file_in.page_count
    db.commit()
    db.refresh(db_file)
    return db_file


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> Response:
    db_file = db.get(File, file_id)

    if db_file is None or db_file.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado.",
        )

    # Cascade: remove the reading sessions that reference this book so the
    # analytics dashboard doesn't keep counting time against a book the user
    # has removed from their library.
    db.execute(
        delete(ReadingSession).where(
            ReadingSession.user_id == user_id,
            ReadingSession.book_id == file_id,
        ),
    )
    # Cascade: del progress (auto-bookmark) del libro. Si el usuario vuelve
    # a subir el mismo PDF más adelante, arranca limpio.
    db.execute(
        delete(ReadingProgress).where(
            ReadingProgress.user_id == user_id,
            ReadingProgress.book_id == file_id,
        ),
    )
    db.delete(db_file)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Reading progress — auto-bookmark per (user, book).
#
# Vive bajo el recurso del libro porque conceptualmente *es* metadata de
# ese libro para el usuario actual. El frontend hace PUT con debounce a
# medida que el usuario navega o el narrador avanza de párrafo; el GET
# se llama al abrir el libro para resumir desde el último punto.
# ---------------------------------------------------------------------------


@router.get(
    "/{file_id}/progress",
    response_model=ReadingProgressResponse | None,
)
def get_progress(
    file_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> ReadingProgress | None:
    db_file = db.get(File, file_id)
    if db_file is None or db_file.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado.",
        )
    statement = select(ReadingProgress).where(
        ReadingProgress.user_id == user_id,
        ReadingProgress.book_id == file_id,
    )
    return db.scalars(statement).first()


@router.put(
    "/{file_id}/progress",
    response_model=ReadingProgressResponse,
)
def upsert_progress(
    file_id: int,
    payload: ReadingProgressUpsert,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_user_id),
) -> ReadingProgress:
    db_file = db.get(File, file_id)
    if db_file is None or db_file.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo no encontrado.",
        )

    statement = select(ReadingProgress).where(
        ReadingProgress.user_id == user_id,
        ReadingProgress.book_id == file_id,
    )
    progress = db.scalars(statement).first()
    if progress is None:
        progress = ReadingProgress(
            user_id=user_id,
            book_id=file_id,
            last_page=payload.last_page,
            last_paragraph_index=payload.last_paragraph_index,
        )
        db.add(progress)
    else:
        progress.last_page = payload.last_page
        progress.last_paragraph_index = payload.last_paragraph_index
    db.commit()
    db.refresh(progress)
    return progress
