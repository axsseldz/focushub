from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FileCreate(BaseModel):
    file_url: str = Field(min_length=1, max_length=2048)
    file_name: str = Field(min_length=1, max_length=255)
    thumbnail_url: str | None = Field(default=None, max_length=5000000)


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_url: str
    file_name: str
    thumbnail_url: str | None
    created_at: datetime
