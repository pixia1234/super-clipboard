import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Iterable, Optional
from uuid import uuid4
from .config import settings
from .models import Clip, StoredFile


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS clips (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    max_downloads INTEGER NOT NULL,
    download_count INTEGER NOT NULL,
    access_code TEXT UNIQUE,
    access_token TEXT,
    text_content TEXT,
    file_name TEXT,
    file_path TEXT,
    file_size INTEGER,
    file_mime TEXT
);
CREATE INDEX IF NOT EXISTS idx_clips_expires_at ON clips(expires_at);
CREATE INDEX IF NOT EXISTS idx_clips_access_code ON clips(access_code);
CREATE INDEX IF NOT EXISTS idx_clips_access_token ON clips(access_token);
"""


class ClipRepository:
    def __init__(self, database_path: Path):
        self._database_path = database_path
        self._lock = Lock()
        self._ensure_schema()

    @contextmanager
    def _connection(self) -> Iterable[sqlite3.Connection]:
        conn = sqlite3.connect(self._database_path, check_same_thread=False)
        try:
            conn.row_factory = sqlite3.Row
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _ensure_schema(self) -> None:
        with self._connection() as conn:
            conn.executescript(CREATE_TABLE_SQL)

    def _row_to_clip(self, row: sqlite3.Row) -> Clip:
        file_path = row["file_path"]
        stored_file = None
        if file_path:
            stored_file = StoredFile(
                name=row["file_name"],
                size=row["file_size"],
                mime=row["file_mime"],
                path=Path(file_path)
            )
        return Clip(
            id=row["id"],
            type=row["type"],
            created_at=datetime.fromtimestamp(row["created_at"], tz=timezone.utc),
            expires_at=datetime.fromtimestamp(row["expires_at"], tz=timezone.utc),
            max_downloads=row["max_downloads"],
            download_count=row["download_count"],
            access_code=row["access_code"],
            access_token=row["access_token"],
            text=row["text_content"],
            stored_file=stored_file
        )

    def sanitize_max_downloads(self, value: Optional[int]) -> int:
        if not isinstance(value, int):
            return settings.default_max_downloads
        normalized = max(1, value)
        return min(normalized, settings.max_allowed_downloads)

    def create_clip(
        self,
        clip_type: str,
        expires_at_ms: int,
        max_downloads: Optional[int],
        access_code: Optional[str],
        access_token: Optional[str],
        text: Optional[str],
        stored_file: Optional[StoredFile]
    ) -> Clip:
        expires_at = datetime.fromtimestamp(expires_at_ms / 1000, tz=timezone.utc)
        if expires_at <= datetime.now(tz=timezone.utc):
            raise ValueError("过期时间必须晚于当前时间")

        with self._lock, self._connection() as conn:
            if access_code:
                existing = conn.execute(
                    "SELECT id FROM clips WHERE access_code = ?",
                    (access_code,)
                ).fetchone()
                if existing:
                    raise ValueError("直链码已存在，请刷新后再试")

            clip_id = str(uuid4())
            created_at = datetime.now(tz=timezone.utc)
            conn.execute(
                """
                INSERT INTO clips (
                    id, type, created_at, expires_at, max_downloads,
                    download_count, access_code, access_token, text_content,
                    file_name, file_path, file_size, file_mime
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    clip_id,
                    clip_type,
                    int(created_at.timestamp()),
                    int(expires_at.timestamp()),
                    self.sanitize_max_downloads(max_downloads),
                    access_code,
                    access_token,
                    text,
                    stored_file.name if stored_file else None,
                    str(stored_file.path) if stored_file else None,
                    stored_file.size if stored_file else None,
                    stored_file.mime if stored_file else None
                )
            )
            row = conn.execute(
                "SELECT * FROM clips WHERE id = ?",
                (clip_id,)
            ).fetchone()
        return self._row_to_clip(row)

    def list_clips(self) -> list[Clip]:
        with self._connection() as conn:
            rows = conn.execute(
                "SELECT * FROM clips ORDER BY created_at DESC"
            ).fetchall()
        return [self._row_to_clip(row) for row in rows]

    def get_clip_by_code(self, access_code: str) -> Optional[Clip]:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM clips WHERE access_code = ?",
                (access_code,)
            ).fetchone()
        return self._row_to_clip(row) if row else None

    def get_clip(self, clip_id: str) -> Optional[Clip]:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM clips WHERE id = ?",
                (clip_id,)
            ).fetchone()
        return self._row_to_clip(row) if row else None

    def get_clip_by_token(self, access_token: str) -> Optional[Clip]:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM clips WHERE access_token = ? ORDER BY created_at DESC",
                (access_token,)
            ).fetchone()
        return self._row_to_clip(row) if row else None

    def delete_clip(self, clip_id: str) -> bool:
        with self._lock, self._connection() as conn:
            row = conn.execute(
                "SELECT file_path FROM clips WHERE id = ?",
                (clip_id,)
            ).fetchone()
            if not row:
                return False
            file_path = row["file_path"]
            conn.execute("DELETE FROM clips WHERE id = ?", (clip_id,))
        if file_path:
            Path(file_path).unlink(missing_ok=True)
        return True

    def increment_downloads(self, clip_id: str) -> tuple[Optional[Clip], bool]:
        with self._lock, self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM clips WHERE id = ?",
                (clip_id,)
            ).fetchone()
            if not row:
                return None, False
            clip = self._row_to_clip(row)
            new_count = clip.download_count + 1
            conn.execute(
                "UPDATE clips SET download_count = ? WHERE id = ?",
                (new_count, clip_id)
            )
            clip.download_count = new_count
            reached_limit = new_count >= clip.max_downloads
        return clip, reached_limit

    def purge_inactive(self) -> int:
        now_ts = int(datetime.now(tz=timezone.utc).timestamp())
        with self._lock, self._connection() as conn:
            rows = conn.execute(
                "SELECT id, file_path FROM clips WHERE expires_at <= ? OR download_count >= max_downloads",
                (now_ts,)
            ).fetchall()
            ids = [row["id"] for row in rows]
            conn.executemany("DELETE FROM clips WHERE id = ?", ((clip_id,) for clip_id in ids))
        for row in rows:
            file_path = row["file_path"]
            if file_path:
                Path(file_path).unlink(missing_ok=True)
        return len(rows)
