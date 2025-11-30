from pathlib import Path
from pydantic import field_validator
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
    token_expiry_hours: int = 720
    static_root: Path = Path("dist")
    captcha_provider: str | None = None
    captcha_secret: str | None = None
    captcha_timeout_seconds: float = 6.0
    captcha_bypass_token: str | None = None
    captcha_site_key: str | None = None

    @field_validator("captcha_provider")
    @classmethod
    def normalize_provider(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {"turnstile", "recaptcha"}:
            raise ValueError("captcha_provider must be turnstile or recaptcha")
        return normalized

    @field_validator("captcha_secret", "captcha_bypass_token")
    @classmethod
    def trim_optional(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    @field_validator("captcha_site_key")
    @classmethod
    def trim_site_key(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None

    model_config = SettingsConfigDict(
        env_prefix="SUPER_CLIPBOARD_",
        env_file=".env",
        env_file_encoding="utf-8"
    )


settings = Settings()
settings.file_storage_dir.mkdir(parents=True, exist_ok=True)
settings.database_path.parent.mkdir(parents=True, exist_ok=True)
