from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FileCreate(BaseModel):
    file_url: str = Field(min_length=1, max_length=2048)
    file_name: str = Field(min_length=1, max_length=255)
    thumbnail_url: str | None = Field(default=None, max_length=5000000)


class FileUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    page_count: int | None = Field(default=None, ge=1, le=100_000)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "FileUpdate":
        if self.display_name is None and self.page_count is None:
            raise ValueError("Debe enviarse al menos un campo a actualizar.")
        return self


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_url: str
    file_name: str
    display_name: str | None
    thumbnail_url: str | None
    page_count: int | None
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


class ReadingProgressUpsert(BaseModel):
    last_page: int = Field(ge=1, le=100_000)
    last_paragraph_index: int | None = Field(default=None, ge=0, le=100_000)


class ReadingProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    book_id: int
    last_page: int
    last_paragraph_index: int | None
    updated_at: datetime


# ---------------------------------------------------------------------------
# Workspace — LaTeX projects, chat, and assets.
# ---------------------------------------------------------------------------


class WorkspaceProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    latex_source: str | None = Field(default=None, max_length=500_000)


class WorkspaceProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    latex_source: str | None = Field(default=None, max_length=500_000)

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "WorkspaceProjectUpdate":
        if self.title is None and self.latex_source is None:
            raise ValueError("Debe enviarse al menos un campo a actualizar.")
        return self


class WorkspaceAssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_name: str
    file_url: str
    mime_type: str | None
    created_at: datetime


class WorkspaceAssetCreate(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    file_url: str = Field(min_length=1, max_length=2048)
    mime_type: str | None = Field(default=None, max_length=128)


class WorkspaceMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    mode: str
    content: str
    created_at: datetime


class WorkspaceProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    latex_source: str
    last_exported_file_id: int | None
    created_at: datetime
    updated_at: datetime


class WorkspaceProjectDetail(WorkspaceProjectResponse):
    assets: list[WorkspaceAssetResponse]
    messages: list[WorkspaceMessageResponse]


class WorkspaceChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)
    mode: str = Field(pattern="^(plan|execute)$")


class WorkspaceChatResponse(BaseModel):
    assistant_message: WorkspaceMessageResponse
    # When the assistant rewrites the document (Execute mode), the new
    # source is returned here so the client can swap it into the canvas
    # without an extra GET roundtrip.
    latex_source: str | None = None


class WorkspaceSyncRequest(BaseModel):
    # Optional override — when not provided the project's title is used.
    display_name: str | None = Field(default=None, min_length=1, max_length=255)


class WorkspaceSyncResponse(BaseModel):
    file_id: int
    file_url: str
    file_name: str
