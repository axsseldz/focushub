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


def ensure_database_schema() -> None:
    with engine.begin() as connection:
        inspector = inspect(connection)
        if "files" not in inspector.get_table_names():
            return

        columns = {column["name"] for column in inspector.get_columns("files")}
        if "thumbnail_url" not in columns:
            connection.execute(text("ALTER TABLE files ADD COLUMN thumbnail_url VARCHAR"))
