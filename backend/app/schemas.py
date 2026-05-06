from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FileCreate(BaseModel):
    file_url: str = Field(min_length=1, max_length=2048)
    file_name: str = Field(min_length=1, max_length=255)
    thumbnail_url: str | None = Field(default=None, max_length=5000000)


class FileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_url: str
    file_name: str
    display_name: str | None
    thumbnail_url: str | None
    created_at: datetime


class ReadingSessionCreate(BaseModel):
    book_id: int | None = Field(default=None, ge=1)
    started_at: datetime
    ended_at: datetime
    duration_seconds: int = Field(ge=1, le=24 * 60 * 60)
    pages_read: int | None = Field(default=None, ge=0, le=100_000)

    @model_validator(mode="after")
    def _validate_window(self) -> "ReadingSessionCreate":
        if self.ended_at < self.started_at:
            raise ValueError("ended_at must be greater than or equal to started_at")
        return self


class ReadingSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    book_id: int | None
    started_at: datetime
    ended_at: datetime
    duration_seconds: int
    pages_read: int | None
    created_at: datetime
