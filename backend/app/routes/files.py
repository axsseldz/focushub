from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import require_user_id
from app.database import get_db
from app.models import File, ReadingSession
from app.schemas import FileCreate, FileResponse, FileUpdate

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
    db_file.display_name = file_in.display_name.strip() or None
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
    db.delete(db_file)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
