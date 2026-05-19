from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'database.db'}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


# SQLite ships with foreign key enforcement OFF by default — so even
# columns declared with ``ON DELETE CASCADE`` (e.g. ``WorkspaceAsset
# .project_id``) get silently ignored on delete. We turn it on for
# every connection the engine hands out so deleting a project does the
# right thing and we never accumulate orphaned messages/assets again.
@event.listens_for(Engine, "connect")
def _sqlite_enable_foreign_keys(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
    # Bail for non-SQLite dialects (the listener is global but the
    # PRAGMA is a no-op everywhere else).
    if not hasattr(dbapi_connection, "cursor"):
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys = ON")
    finally:
        cursor.close()
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


# Pre-Clerk rows belong to no specific user. We tag them with this sentinel
# so the column can be NOT NULL going forward; legacy rows remain visible only
# under this owner string (effectively orphaned from the multi-user app).
_LEGACY_USER_ID = "legacy"


def ensure_database_schema() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        tables = set(inspector.get_table_names())

        # One-time cleanup: prior versions of the app didn't enable
        # SQLite FK enforcement, so deleting a workspace project left
        # behind orphan rows. Sweep them at startup so the workspace
        # never serves messages or assets whose parent project is gone.
        if "workspace_messages" in tables and "workspace_projects" in tables:
            connection.execute(
                text(
                    "DELETE FROM workspace_messages "
                    "WHERE project_id NOT IN (SELECT id FROM workspace_projects)",
                ),
            )
        if "workspace_assets" in tables and "workspace_projects" in tables:
            connection.execute(
                text(
                    "DELETE FROM workspace_assets "
                    "WHERE project_id NOT IN (SELECT id FROM workspace_projects)",
                ),
            )

        if "files" in tables:
            columns = {column["name"] for column in inspector.get_columns("files")}
            if "thumbnail_url" not in columns:
                connection.execute(
                    text("ALTER TABLE files ADD COLUMN thumbnail_url VARCHAR"),
                )
            if "page_count" not in columns:
                connection.execute(
                    text("ALTER TABLE files ADD COLUMN page_count INTEGER"),
                )
            if "display_name" not in columns:
                connection.execute(
                    text("ALTER TABLE files ADD COLUMN display_name VARCHAR"),
                )

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

            if "user_id" not in columns:
                connection.execute(
                    text("ALTER TABLE files ADD COLUMN user_id VARCHAR"),
                )
                connection.execute(
                    text(
                        "UPDATE files SET user_id = :uid WHERE user_id IS NULL",
                    ),
                    {"uid": _LEGACY_USER_ID},
                )
                connection.execute(
                    text("CREATE INDEX IF NOT EXISTS ix_files_user_id ON files(user_id)"),
                )

        if "workspace_assets" in tables:
            columns = {
                column["name"]
                for column in inspector.get_columns("workspace_assets")
            }
            if "text_excerpt" not in columns:
                connection.execute(
                    text("ALTER TABLE workspace_assets ADD COLUMN text_excerpt VARCHAR"),
                )

        if "reading_sessions" in tables:
            columns = {
                column["name"]
                for column in inspector.get_columns("reading_sessions")
            }
            if "user_id" not in columns:
                connection.execute(
                    text("ALTER TABLE reading_sessions ADD COLUMN user_id VARCHAR"),
                )
                connection.execute(
                    text(
                        "UPDATE reading_sessions SET user_id = :uid "
                        "WHERE user_id IS NULL",
                    ),
                    {"uid": _LEGACY_USER_ID},
                )
                connection.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_reading_sessions_user_id "
                        "ON reading_sessions(user_id)",
                    ),
                )
