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
    owner_id TEXT NOT NULL,
    text_content TEXT,
    file_name TEXT,
    file_path TEXT,
    file_size INTEGER,
    file_mime TEXT
);
CREATE INDEX IF NOT EXISTS idx_clips_expires_at ON clips(expires_at);
CREATE INDEX IF NOT EXISTS idx_clips_access_code ON clips(access_code);
CREATE INDEX IF NOT EXISTS idx_clips_access_token ON clips(access_token);
CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    last_used_at INTEGER,
    expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at);
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
            columns = {row["name"] for row in conn.execute("PRAGMA table_info(clips)")}
            if "owner_id" not in columns:
                conn.execute("ALTER TABLE clips ADD COLUMN owner_id TEXT DEFAULT ''")
                conn.execute("UPDATE clips SET owner_id = '' WHERE owner_id IS NULL")

    def _token_ttl_seconds(self) -> int:
        return max(1, settings.token_expiry_hours) * 60 * 60

    def register_token(self, token: str, environment_id: Optional[str]) -> dict[str, object]:
        trimmed = token.strip()
        if not trimmed:
            raise ValueError("持久 Token 无效")
        now = int(datetime.now(tz=timezone.utc).timestamp())
        ttl_seconds = self._token_ttl_seconds()
        expires_at = now + ttl_seconds
        last_used_at_value: Optional[int] = None
        with self._lock, self._connection() as conn:
            row = conn.execute(
                "SELECT owner_id, updated_at, last_used_at, expires_at FROM tokens WHERE token = ?",
                (trimmed,)
            ).fetchone()
            if row:
                if row["expires_at"] <= now:
                    assigned_owner = environment_id if environment_id and environment_id == row["owner_id"] else str(uuid4())
                    conn.execute(
                        "UPDATE tokens SET owner_id = ?, updated_at = ?, last_used_at = NULL, expires_at = ? WHERE token = ?",
                        (assigned_owner, now, expires_at, trimmed)
                    )
                    last_used_at_value = None
                else:
                    existing_owner = row["owner_id"]
                    if environment_id and environment_id == existing_owner:
                        conn.execute(
                            "UPDATE tokens SET updated_at = ?, expires_at = ? WHERE token = ?",
                            (now, expires_at, trimmed)
                        )
                        assigned_owner = existing_owner
                        last_used_at_value = row["last_used_at"]
                    else:
                        raise ValueError("持久 Token 已被其他设备占用，请稍后重试")
            else:
                assigned_owner = environment_id if environment_id else str(uuid4())
                conn.execute(
                    "INSERT INTO tokens (token, owner_id, updated_at, last_used_at, expires_at) VALUES (?, ?, ?, NULL, ?)",
                    (trimmed, assigned_owner, now, expires_at)
                )
                last_used_at_value = None
        return {
            "token": trimmed,
            "environment_id": assigned_owner,
            "updated_at": now,
            "last_used_at": last_used_at_value,
            "expires_at": expires_at,
        }

    def ensure_token_owner(self, token: str, environment_id: str) -> dict[str, object]:
        trimmed = token.strip()
        if not trimmed:
            raise ValueError("持久 Token 无效")
        normalized_env = environment_id.strip()
        if not normalized_env:
            raise ValueError("Token 校验失败")
        now = int(datetime.now(tz=timezone.utc).timestamp())
        ttl_seconds = self._token_ttl_seconds()
        new_expires = now + ttl_seconds
        with self._lock, self._connection() as conn:
            row = conn.execute(
                "SELECT owner_id, updated_at, last_used_at, expires_at FROM tokens WHERE token = ?",
                (trimmed,)
            ).fetchone()
            if not row:
                raise ValueError("持久 Token 未注册，请重新保存")
            if row["expires_at"] <= now:
                conn.execute("DELETE FROM tokens WHERE token = ?", (trimmed,))
                raise ValueError("持久 Token 已过期，请重新生成")
            if row["owner_id"] != normalized_env:
                raise ValueError("持久 Token 已被其他设备占用，请稍后重试")
            conn.execute(
                "UPDATE tokens SET last_used_at = ?, expires_at = ? WHERE token = ?",
                (now, new_expires, trimmed)
            )
        return {
            "token": trimmed,
            "environment_id": normalized_env,
            "updated_at": row["updated_at"],
            "last_used_at": now,
            "expires_at": new_expires,
        }

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
        owner_id = row["owner_id"] if "owner_id" in row.keys() else ""
        return Clip(
            id=row["id"],
            type=row["type"],
            created_at=datetime.fromtimestamp(row["created_at"], tz=timezone.utc),
            expires_at=datetime.fromtimestamp(row["expires_at"], tz=timezone.utc),
            max_downloads=row["max_downloads"],
            download_count=row["download_count"],
            access_code=row["access_code"],
            access_token=row["access_token"],
            environment_id=owner_id,
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
        environment_id: str,
        text: Optional[str],
        stored_file: Optional[StoredFile]
    ) -> Clip:
        expires_at = datetime.fromtimestamp(expires_at_ms / 1000, tz=timezone.utc)
        if expires_at <= datetime.now(tz=timezone.utc):
            raise ValueError("过期时间必须晚于当前时间")

        environment_id_value = environment_id.strip()
        if not environment_id_value:
            raise ValueError("剪贴板所属标识缺失")
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
                    download_count, access_code, access_token, owner_id, text_content,
                    file_name, file_path, file_size, file_mime
                ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    clip_id,
                    clip_type,
                    int(created_at.timestamp()),
                    int(expires_at.timestamp()),
                    self.sanitize_max_downloads(max_downloads),
                    access_code,
                    access_token,
                    environment_id_value,
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

    def list_clips(self, environment_id: str) -> list[Clip]:
        with self._connection() as conn:
            rows = conn.execute(
                "SELECT * FROM clips WHERE owner_id = ? ORDER BY created_at DESC",
                (environment_id,)
            ).fetchall()
        return [self._row_to_clip(row) for row in rows]

    def get_clip_by_code(self, access_code: str) -> Optional[Clip]:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM clips WHERE access_code = ?",
                (access_code,)
            ).fetchone()
        return self._row_to_clip(row) if row else None

    def get_clip_by_code_and_owner(self, access_code: str, environment_id: str) -> Optional[Clip]:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM clips WHERE access_code = ? AND owner_id = ?",
                (access_code, environment_id)
            ).fetchone()
        return self._row_to_clip(row) if row else None

    def get_clip(self, clip_id: str) -> Optional[Clip]:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM clips WHERE id = ?",
                (clip_id,)
            ).fetchone()
        return self._row_to_clip(row) if row else None

    def get_clip_by_token(self, access_token: str, environment_id: Optional[str] = None) -> Optional[Clip]:
        with self._connection() as conn:
            if environment_id:
                row = conn.execute(
                    "SELECT * FROM clips WHERE access_token = ? AND owner_id = ? ORDER BY created_at DESC",
                    (access_token, environment_id)
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT * FROM clips WHERE access_token = ? ORDER BY created_at DESC",
                    (access_token,)
                ).fetchone()
        return self._row_to_clip(row) if row else None

    def delete_clip(self, clip_id: str, environment_id: str) -> bool:
        normalized_env = environment_id.strip()
        if not normalized_env:
            return False
        with self._lock, self._connection() as conn:
            row = conn.execute(
                "SELECT file_path, owner_id FROM clips WHERE id = ?",
                (clip_id,)
            ).fetchone()
            if not row or row["owner_id"] != normalized_env:
                return False
            file_path = row["file_path"]
            conn.execute("DELETE FROM clips WHERE id = ?", (clip_id,))
        if file_path:
            Path(file_path).unlink(missing_ok=True)
        return True

    def increment_downloads(self, clip_id: str, environment_id: str) -> tuple[Optional[Clip], bool]:
        normalized_env = environment_id.strip()
        if not normalized_env:
            return None, False
        with self._lock, self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM clips WHERE id = ?",
                (clip_id,)
            ).fetchone()
            if not row:
                return None, False
            clip = self._row_to_clip(row)
            if clip.environment_id != normalized_env:
                return None, False
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
