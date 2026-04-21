from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'database.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_KNOWN_EXTENSIONS = (
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".heic",
    ".heif",
    ".mp4",
    ".mov",
    ".webm",
)


def ensure_database_schema() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "files" not in inspector.get_table_names():
            return

        columns = {column["name"] for column in inspector.get_columns("files")}
        if "thumbnail_url" not in columns:
            connection.execute(text("ALTER TABLE files ADD COLUMN thumbnail_url VARCHAR"))
        if "display_name" not in columns:
            connection.execute(text("ALTER TABLE files ADD COLUMN display_name VARCHAR"))

            # Rescue rows whose file_name was mutated by the pre-display_name
            # rename flow: if a row's file_name has no recognizable extension
            # it is almost certainly a renamed PDF that got filtered out of
            # the library. Preserve the rename in display_name and restore a
            # .pdf suffix so the row re-appears.
            rows = connection.execute(
                text("SELECT id, file_name FROM files"),
            ).fetchall()
            for row in rows:
                name = (row.file_name or "").strip()
                if not name:
                    continue
                if name.lower().endswith(_KNOWN_EXTENSIONS):
                    continue
                connection.execute(
                    text(
                        "UPDATE files SET display_name = :dn, file_name = :fn "
                        "WHERE id = :id",
                    ),
                    {"dn": name, "fn": f"{name}.pdf", "id": row.id},
                )
