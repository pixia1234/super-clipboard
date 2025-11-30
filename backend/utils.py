from datetime import datetime
from typing import Optional
import httpx
from fastapi import HTTPException, Request


def build_text_clip_html(content: str, created_at: datetime, download_count: int, code: str | None) -> str:
    escaped = (
        content.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    created = created_at.astimezone().strftime("%Y-%m-%d %H:%M:%S")
    title_code = code or ""
    return f"""<!doctype html>
<html lang=\"zh-CN\">
  <head>
    <meta charset=\"utf-8\" />
    <title>Super Clipboard 直链 {title_code}</title>
    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
    <style>
      body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 32px; color: #0f172a; background: #f8fafc; }}
      pre {{ white-space: pre-wrap; word-break: break-word; padding: 24px; background: #fff; border-radius: 16px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12); }}
      footer {{ margin-top: 24px; font-size: 0.875rem; color: #64748b; }}
    </style>
  </head>
  <body>
    <h1>直链文本</h1>
    <pre>{escaped}</pre>
    <footer>创建于 {created}, 下载次数 {download_count}</footer>
  </body>
</html>"""


def build_base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


async def verify_captcha_token(
    token: Optional[str],
    provider: Optional[str],
    secret: Optional[str],
    remote_ip: Optional[str] = None,
    *,
    timeout_seconds: float = 6.0,
    bypass_token: Optional[str] = None,
) -> None:
    if provider is None or not secret:
        return
    if not token:
        raise HTTPException(status_code=400, detail="缺少验证码，请重新验证后再试")
    if bypass_token and token == bypass_token:
        return

    endpoint = {
        "turnstile": "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        "recaptcha": "https://www.google.com/recaptcha/api/siteverify",
    }.get(provider)
    if not endpoint:
        raise HTTPException(status_code=400, detail="验证码服务未配置")

    payload: dict[str, str] = {"secret": secret, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(endpoint, data=payload)
    try:
        data = response.json()
    except Exception as error:  # pragma: no cover - defensive
        raise HTTPException(status_code=400, detail="验证码校验失败") from error

    success = bool(data.get("success"))
    if not success:
        codes = ", ".join(data.get("error-codes", []) or [])
        detail = "验证码校验失败" + (f"（{codes}）" if codes else "")
        raise HTTPException(status_code=400, detail=detail)
