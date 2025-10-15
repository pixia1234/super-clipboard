import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.routing import APIRouter
from fastapi.staticfiles import StaticFiles
from .config import settings
from .models import Clip
from .repository import ClipRepository
from .schemas import (
    ClipCreateRequest,
    ClipListResponse,
    ClipResponse,
    DeleteResponse,
    IncrementResponse,
    TokenRegisterRequest,
    TokenRegisterResponse,
)
from .storage import store_data_url
from .utils import build_base_url, build_text_clip_html

repository = ClipRepository(settings.database_path)
api_router = APIRouter(prefix="/api")
app = FastAPI(title="Super Clipboard Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
if settings.static_root.exists():
    app.mount("/static", StaticFiles(directory=settings.static_root), name="static")
    assets_dir = settings.static_root / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
_cleanup_task: Optional[asyncio.Task] = None


async def cleanup_worker() -> None:
    while True:
        await asyncio.sleep(settings.cleanup_interval_seconds)
        repository.purge_inactive()


@app.on_event("startup")
async def on_startup() -> None:
    repository.purge_inactive()
    global _cleanup_task
    _cleanup_task = asyncio.create_task(cleanup_worker())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if _cleanup_task:
        _cleanup_task.cancel()
        try:
            await _cleanup_task
        except asyncio.CancelledError:
            pass


@app.get("/healthz")
async def healthcheck() -> dict[str, object]:
    return {"ok": True, "timestamp": int(datetime.now(tz=timezone.utc).timestamp() * 1000)}


@app.get("/")
async def index():
    index_file = settings.static_root / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return JSONResponse({"name": "Super Clipboard API", "ok": True})


@api_router.get("/clips", response_model=ClipListResponse)
async def list_clips(request: Request, environmentId: str) -> ClipListResponse:
    repository.purge_inactive()
    base_url = build_base_url(request)
    normalized_env = environmentId.strip()
    if not normalized_env:
        raise HTTPException(status_code=400, detail="environmentId 缺失")
    clips = [
        ClipResponse.from_clip(clip, base_url)
        for clip in repository.list_clips(normalized_env)
    ]
    return ClipListResponse(items=clips)


@api_router.post("/tokens/register", response_model=TokenRegisterResponse)
async def register_persistent_token(body: TokenRegisterRequest) -> TokenRegisterResponse:
    try:
        record = repository.register_token(body.token, body.environmentId)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))
    return TokenRegisterResponse(
        token=record["token"],
        environmentId=record["environment_id"],
        updatedAt=record["updated_at"] * 1000,
        lastUsedAt=(record["last_used_at"] * 1000) if record["last_used_at"] else None,
        expiresAt=record["expires_at"] * 1000,
    )


@api_router.get("/clips/{clip_id}", response_model=ClipResponse)
async def get_clip(clip_id: str, request: Request, environmentId: str) -> ClipResponse:
    clip = repository.get_clip(clip_id)
    if not clip or clip.environment_id != environmentId:
        raise HTTPException(status_code=404, detail="片段未找到")
    if not clip.is_active:
        repository.delete_clip(clip_id, environmentId)
        raise HTTPException(status_code=404, detail="片段已过期或达到下载次数")
    return ClipResponse.from_clip(clip, build_base_url(request))


@api_router.get("/clips/code/{access_code}", response_model=ClipResponse)
async def get_clip_by_code(access_code: str, request: Request) -> ClipResponse:
    clip = repository.get_clip_by_code(access_code)
    if not clip:
        raise HTTPException(status_code=404, detail="直链不存在或已过期")
    if not clip.is_active:
        repository.delete_clip(clip.id, clip.environment_id)
        raise HTTPException(status代码=404, detail="直链不存在或已过期")
    return ClipResponse.from_clip(clip, build_base_url(request))


def _resolve_text_payload(body: ClipCreateRequest) -> str:
    return body.payload.text or ""


def _resolve_file(body: ClipCreateRequest):
    if not body.payload.file:
        raise HTTPException(status_code=400, detail="文件数据缺失")
    stored_file = store_data_url(body.payload.file.name, body.payload.file.dataUrl)
    if stored_file.size > settings.max_file_size_bytes:
        stored_file.path.unlink(missing_ok=True)  # type: ignore[attr-defined]
        raise HTTPException(status_code=400, detail="文件体积超过限制")
    return stored_file


@api_router.post("/clips", response_model=ClipResponse, status_code=201)
async def create_clip(body: ClipCreateRequest, request: Request) -> ClipResponse:
    environment_id_value = body.environmentId.strip()
    if not environment_id_value:
        raise HTTPException(status_code=400, detail="缺少 environmentId")

    if body.accessToken:
        try:
            repository.ensure_token_owner(body.accessToken, environment_id_value)
        except ValueError as error:
            message = str(error)
            if "未注册" in message or "未找到" in message:
                repository.register_token(body.accessToken, environment_id_value)
            else:
                raise HTTPException(status_code=409, detail=message)

    stored_file = None
    try:
        if body.type == "file":
            stored_file = _resolve_file(body)
        clip = repository.create_clip(
            clip_type=body.type,
            expires_at_ms=body.expiresAt,
            max_downloads=body.maxDownloads,
            access_code=body.accessCode,
            access_token=body.accessToken,
            environment_id=environment_id_value,
            text=_resolve_text_payload(body) if body.type == "text" else None,
            stored_file=stored_file,
        )
    except ValueError as error:
        if stored_file:
            stored_file.path.unlink(missing_ok=True)  # type: ignore[attr-defined]
        message = str(error)
        status = 409 if any(keyword in message for keyword in ("已存在", "Token")) else 400
        raise HTTPException(status_code=status, detail=message)
    return ClipResponse.from_clip(clip, build_base_url(request))


@api_router.delete("/clips/{clip_id}", response_model=DeleteResponse)
async def delete_clip(clip_id: str, environmentId: str) -> DeleteResponse:
    normalized_env = environmentId.strip()
    removed = repository.delete_clip(clip_id, normalized_env)
    if not removed:
        raise HTTPException(status_code=404, detail="片段未找到")
    return DeleteResponse(ok=True)


@api_router.post("/clips/{clip_id}/download", response_model=IncrementResponse)
async def track_download(clip_id: str, request: Request, environmentId: str) -> IncrementResponse:
    normalized_env = environmentId.strip()
    clip, reached = repository.increment_downloads(clip_id, normalized_env)
    if not clip:
        raise HTTPException(status_code=404, detail="片段未找到")
    if not clip.is_active and reached:
        repository.delete_clip(clip_id, normalized_env)
        raise HTTPException(status_code=410, detail="片段已过期或销毁")
    return IncrementResponse(
        clip=ClipResponse.from_clip(clip, build_base_url(request)),
        removed=reached,
    )


@api_router.get("/clips/{clip_id}/file")
async def download_file(
    clip_id: str,
    background: BackgroundTasks,
    environmentId: str,
) -> FileResponse:
    normalized_env = environmentId.strip()
    clip = repository.get_clip(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="片段未找到")
    if clip.environment_id != normalized_env:
        raise HTTPException(status_code=404, detail="片段未找到")
    if not clip.stored_file:
        repository.delete_clip(clip_id, normalized_env)
        raise HTTPException(status_code=410, detail="文件已丢失")
    if not clip.is_active:
        repository.delete_clip(clip_id, normalized_env)
        raise HTTPException(status_code=410, detail="文件已过期或销毁")
    file_path = clip.stored_file.path
    if not file_path.exists():
        repository.delete_clip(clip_id, normalized_env)
        raise HTTPException(status_code=410, detail="文件已丢失")
    clip, reached = repository.increment_downloads(clip_id, normalized_env)
    if not clip:
        raise HTTPException(status_code=404, detail="片段未找到")
    if reached:
        background.add_task(repository.delete_clip, clip_id, normalized_env)
    return FileResponse(
        path=file_path,
        media_type=clip.stored_file.mime if clip.stored_file else "application/octet-stream",
        filename=clip.stored_file.name if clip.stored_file else "clip",
        background=background,
    )


app.include_router(api_router)


def _parse_identifier(identifier: str) -> tuple[Optional[str], str]:
    if "." in identifier:
        owner_part, remainder = identifier.split(".", 1)
        return owner_part.strip() or None, remainder.strip()
    return None, identifier.strip()


def _get_active_clip(identifier: str) -> Clip:
    trimmed = identifier.strip()
    if not trimmed:
        raise HTTPException(status_code=404, detail="直链不存在或已过期")
    clip: Optional[Clip] = repository.get_clip_by_code(trimmed)
    owner_hint: Optional[str] = None
    remainder = trimmed
    if not clip:
        owner_hint, remainder = _parse_identifier(trimmed)
        if owner_hint and remainder:
            if remainder.isdigit() and len(remainder) == 5:
                clip = repository.get_clip_by_code_and_owner(remainder, owner_hint)
            if not clip:
                clip = repository.get_clip_by_token(remainder, owner_hint)
    if not clip:
        clip = repository.get_clip_by_token(trimmed)
    if not clip:
        raise HTTPException(status_code=404, detail="直链不存在或已过期")
    if not clip.is_active:
        repository.delete_clip(clip.id, clip.environment_id)
        raise HTTPException(status_code=404, detail="直链不存在或已过期")
    return clip


def _increment_clip_downloads(clip: Clip) -> tuple[Clip, bool]:
    updated_clip, reached = repository.increment_downloads(clip.id, clip.environment_id)
    if not updated_clip:
        raise HTTPException(status_code=404, detail="直链不存在或已过期")
    return updated_clip, reached


def _dispatch_clip_response(
    clip: Clip,
    reached: bool,
    background: BackgroundTasks,
    raw: bool,
):
    if clip.type == "text":
        if reached:
            background.add_task(repository.delete_clip, clip.id, clip.environment_id)
        if raw:
            return PlainTextResponse(content=clip.text or "")
        html = build_text_clip_html(
            clip.text or "",
            clip.created_at,
            clip.download_count,
            clip.access_code,
        )
        return HTMLResponse(content=html)
    if clip.stored_file:
        if reached:
            background.add_task(repository.delete_clip, clip.id, clip.environment_id)
        file_path = clip.stored_file.path
        if not file_path.exists():
            repository.delete_clip(clip.id, clip.environment_id)
            raise HTTPException(status_code=410, detail="文件已丢失")
        return FileResponse(
            path=file_path,
            media_type=clip.stored_file.mime,
            filename=clip.stored_file.name,
            background=background,
        )
    repository.delete_clip(clip.id, clip.environment_id)
    raise HTTPException(status_code=410, detail="文件数据缺失")


@app.get("/{access_code}/raw")
async def resolve_code_raw(access_code: str, background: BackgroundTasks):
    clip = _get_active_clip(access_code)
    clip, reached = _increment_clip_downloads(clip)
    return _dispatch_clip_response(clip, reached, background, raw=True)


@app.get("/{access_code}")
async def resolve_code(access_code: str, background: BackgroundTasks):
    clip = _get_active_clip(access_code)
    clip, reached = _increment_clip_downloads(clip)
    return _dispatch_clip_response(clip, reached, background, raw=False)
