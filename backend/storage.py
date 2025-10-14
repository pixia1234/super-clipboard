import base64
import mimetypes
from datetime import datetime
from pathlib import Path
from typing import Tuple
from .config import settings
from .models import StoredFile


def _parse_data_url(data_url: str) -> Tuple[str, bytes]:
    if not data_url.startswith("data:"):
        raise ValueError("无效的文件数据 URL")
    header, encoded = data_url.split(",", 1)
    mime = header.split(";")[0][5:] or "application/octet-stream"
    try:
        payload = base64.b64decode(encoded)
    except Exception as exc:  # pragma: no cover - defensive path
        raise ValueError("文件数据解码失败") from exc
    return mime, payload


def store_data_url(filename: str, data_url: str) -> StoredFile:
    mime, data = _parse_data_url(data_url)
    safe_name = filename or "uploaded"
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    suffix = Path(safe_name).suffix
    guessed_suffix = mimetypes.guess_extension(mime) or ""
    final_suffix = suffix or guessed_suffix
    storage_name = f"{timestamp}{final_suffix}"
    destination = settings.file_storage_dir / storage_name
    destination.write_bytes(data)
    return StoredFile(name=safe_name, size=len(data), mime=mime, path=destination)
