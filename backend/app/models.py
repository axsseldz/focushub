from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class File(Base):
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    file_url: Mapped[str] = mapped_column(String, nullable=False)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String, nullable=True)
    page_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class ReadingSession(Base):
    """One reading session = the user opening a book and reading for some
    amount of *active* time. The frontend tracker only counts seconds while
    the tab is visible and the user has been recently interactive, so the
    duration here reflects engaged time, not wall-clock time.

    The `book_id` is stored as a plain integer rather than a foreign key.
    The files DELETE route cleans up matching sessions explicitly so
    analytics stays consistent with the user's current library."""

    __tablename__ = "reading_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    book_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    ended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    pages_read: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_reading_sessions_started_at", "started_at"),
    )


class ReadingProgress(Base):
    """Per-user "auto-bookmark" para un libro: la última página leída y,
    cuando hay narración, el índice del último párrafo activo dentro de
    esa página. Un row por ``(user_id, book_id)`` — al actualizarse se
    sobreescribe en lugar de acumular historial.

    El frontend hace upsert con debounce a medida que el usuario navega
    o el narrador avanza de párrafo, así que el row representa siempre
    el "último punto conocido" donde quedó la lectura."""

    __tablename__ = "reading_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    book_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    last_page: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_paragraph_index: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "book_id",
            name="uq_reading_progress_user_book",
        ),
    )


class WorkspaceProject(Base):
    """A user-owned LaTeX project edited inside the Workspace.

    The whole document lives in ``latex_source`` as a single .tex blob. A
    project may also have a chat history (``WorkspaceMessage``) and uploaded
    assets (``WorkspaceAsset``) that the AI can reference by filename."""

    __tablename__ = "workspace_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    latex_source: Mapped[str] = mapped_column(Text, nullable=False, default="")
    last_exported_file_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class WorkspaceAsset(Base):
    """An image / document the user uploaded to a project. The AI receives
    the list of filenames so it can drop ``\\includegraphics{logo.png}``
    without first asking the user what's available."""

    __tablename__ = "workspace_assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("workspace_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String, nullable=False)
    file_url: Mapped[str] = mapped_column(String, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String, nullable=True)
    # Pre-extracted text content (e.g. from a PDF). Populated on upload
    # so the chat can feed it back as context without re-downloading the
    # file on every turn. ``None`` means either extraction failed or the
    # asset is binary (image, video, etc.).
    text_excerpt: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class WorkspaceMessage(Base):
    """One turn of the project's chat history. ``role`` is ``user`` or
    ``assistant``; ``mode`` is the active switch when the message was sent
    (``plan`` / ``execute``) so the timeline keeps that context visible."""

    __tablename__ = "workspace_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("workspace_projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_workspace_messages_project_created", "project_id", "created_at"),
    )


class WorkspaceSession(Base):
    """One workspace session = the user actively working on a LaTeX
    project (typing in the chat or editor, scrolling the PDF, uploading
    assets, compiling). The frontend tracker mirrors ``ReadingSession``:
    only seconds where the tab is visible and the user has been recently
    interactive count.

    ``project_id`` is a plain integer (not a foreign key) so we can keep
    historical analytics intact if a project is later deleted. The
    workspace project DELETE route clears matching rows explicitly to
    keep the per-project sessions list consistent with the user's
    workspace."""

    __tablename__ = "workspace_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    project_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    ended_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_workspace_sessions_started_at", "started_at"),
    )


class AudioCache(Base):
    """Persistent cache of ElevenLabs-generated narration.

    The primary key is a SHA-256 of (text + voice_id), so the same
    paragraph synthesised with two different voices yields two rows.
    Cache hits skip the ElevenLabs round-trip entirely and serve the
    on-disk MP3 directly — that's the entire point of this table."""

    __tablename__ = "audio_cache"

    text_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    voice_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
