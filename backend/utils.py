from datetime import datetime
from fastapi import Request


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
