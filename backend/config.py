from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_path: Path = Path("backend/storage/clipboard.db")
    file_storage_dir: Path = Path("backend/storage/files")
    app_host: str = "0.0.0.0"
    app_port: int = 5173
    default_max_downloads: int = 10
    max_allowed_downloads: int = 500
    cleanup_interval_seconds: int = 300
    max_file_size_bytes: int = 50 * 1024 * 1024
    static_root: Path = Path("dist")

    model_config = SettingsConfigDict(
        env_prefix="SUPER_CLIPBOARD_",
        env_file=".env",
        env_file_encoding="utf-8"
    )


settings = Settings()
settings.file_storage_dir.mkdir(parents=True, exist_ok=True)
settings.database_path.parent.mkdir(parents=True, exist_ok=True)
