from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

ClipType = str


@dataclass(slots=True)
class StoredFile:
    name: str
    size: int
    mime: str
    path: Path


@dataclass(slots=True)
class Clip:
    id: str
    type: ClipType
    created_at: datetime
    expires_at: datetime
    max_downloads: int
    download_count: int
    access_code: Optional[str]
    access_token: Optional[str]
    environment_id: str
    text: Optional[str]
    stored_file: Optional[StoredFile]

    @property
    def is_expired(self) -> bool:
        return datetime.now(tz=timezone.utc) >= self.expires_at

    @property
    def reached_download_limit(self) -> bool:
        return self.download_count >= self.max_downloads

    @property
    def is_active(self) -> bool:
        return not self.is_expired and not self.reached_download_limit
