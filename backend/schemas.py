from datetime import datetime
from typing import Literal, Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from .models import Clip


class StoredFileInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    size: int = Field(ge=0)
    type: str = Field(default="", max_length=255)
    dataUrl: str = Field(min_length=1)

    @field_validator("dataUrl")
    @classmethod
    def ensure_data_url(cls, value: str) -> str:
        if not value.startswith("data:"):
            raise ValueError("file dataUrl must be a base64 data URI")
        return value


class ClipPayloadInput(BaseModel):
    text: Optional[str] = None
    file: Optional[StoredFileInput] = None

class ClipCreateRequest(BaseModel):
    type: Literal["text", "file"]
    expiresAt: int = Field(gt=0)
    maxDownloads: Optional[int] = Field(default=None, gt=0)
    accessCode: Optional[str] = Field(default=None, min_length=5, max_length=12)
    accessToken: Optional[str] = Field(default=None, min_length=7)
    environmentId: str = Field(min_length=1, max_length=64)
    payload: ClipPayloadInput

    @field_validator("accessCode")
    @classmethod
    def ensure_access_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            return None
        if not trimmed.isalnum():
            raise ValueError("直链码需由字母或数字组成")
        return trimmed

    @field_validator("accessToken")
    @classmethod
    def ensure_access_token(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return value.strip()

    @model_validator(mode="after")
    def validate_payload(self) -> "ClipCreateRequest":
        if self.type == "text":
            if not self.payload.text or not self.payload.text.strip():
                raise ValueError("文本片段需要 text 字段")
            if self.payload.file is not None:
                raise ValueError("文本片段不应包含文件数据")
        elif self.type == "file":
            if self.payload.file is None:
                raise ValueError("文件片段需要 file 数据")
            if self.payload.text is not None:
                raise ValueError("文件片段不应包含文本字段")
        if self.accessToken and not self.environmentId.strip():
            raise ValueError("持久 Token 校验失败，请重新保存")
        if not self.environmentId.strip():
            raise ValueError("environmentId 缺失")
        return self


class StoredFileResponse(BaseModel):
    name: str
    size: int
    type: str
    downloadUrl: str


class ClipPayloadResponse(BaseModel):
    text: Optional[str]
    file: Optional[StoredFileResponse]


class ClipResponse(BaseModel):
    id: UUID
    type: Literal["text", "file"]
    createdAt: int
    expiresAt: int
    maxDownloads: int
    downloadCount: int
    accessCode: Optional[str]
    accessToken: Optional[str]
    payload: ClipPayloadResponse
    directUrl: Optional[str]

    @staticmethod
    def from_clip(clip: Clip, base_url: str) -> "ClipResponse":
        file_payload = None
        if clip.stored_file:
            file_payload = StoredFileResponse(
                name=clip.stored_file.name,
                size=clip.stored_file.size,
                type=clip.stored_file.mime,
                downloadUrl=f"{base_url}/api/clips/{clip.id}/file?environmentId={clip.environment_id}"
            )
        direct_url = (
            f"{base_url}/{clip.access_code}" if clip.access_code else None
        )
        return ClipResponse(
            id=UUID(clip.id),
            type=clip.type,
            createdAt=int(clip.created_at.timestamp() * 1000),
            expiresAt=int(clip.expires_at.timestamp() * 1000),
            maxDownloads=clip.max_downloads,
            downloadCount=clip.download_count,
            accessCode=clip.access_code,
            accessToken=clip.access_token,
            payload=ClipPayloadResponse(text=clip.text, file=file_payload),
            directUrl=direct_url
        )


class ClipListResponse(BaseModel):
    items: list[ClipResponse]


class DeleteResponse(BaseModel):
    ok: bool


class IncrementResponse(BaseModel):
    clip: ClipResponse
    removed: bool


class TokenRegisterRequest(BaseModel):
    token: str = Field(min_length=7)
    environmentId: Optional[str] = Field(default=None, min_length=1, max_length=64)

    @field_validator("token")
    @classmethod
    def ensure_token(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("持久 Token 无效")
        return trimmed

    @field_validator("environmentId")
    @classmethod
    def ensure_owner(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        trimmed = value.strip()
        if not trimmed:
            return None
        return trimmed


class TokenRegisterResponse(BaseModel):
    token: str
    environmentId: str
    updatedAt: int
    lastUsedAt: Optional[int]
    expiresAt: int
