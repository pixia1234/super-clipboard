import base64
import os
import sys
from datetime import datetime, timedelta, timezone
from importlib import import_module

from fastapi.testclient import TestClient


def build_client(tmp_path, extra_env: dict[str, str] | None = None):
    db_path = tmp_path / "clips.db"
    files_dir = tmp_path / "files"
    static_dir = tmp_path / "static"
    os.environ["SUPER_CLIPBOARD_DATABASE_PATH"] = str(db_path)
    os.environ["SUPER_CLIPBOARD_FILE_STORAGE_DIR"] = str(files_dir)
    os.environ["SUPER_CLIPBOARD_STATIC_ROOT"] = str(static_dir)
    for key, value in (extra_env or {}).items():
        os.environ[key] = value

    for module in list(sys.modules):
        if module.startswith("backend."):
            del sys.modules[module]

    backend_main = import_module("backend.main")
    app = backend_main.app
    return TestClient(app)


def future_timestamp(hours: int = 1) -> int:
    return int((datetime.now(tz=timezone.utc) + timedelta(hours=hours)).timestamp() * 1000)


def test_create_and_fetch_text_clip(tmp_path):
    with build_client(tmp_path) as client:
        environment_id = "owner-12345"
        response = client.post(
            "/api/clips",
            json={
                "type": "text",
                "expiresAt": future_timestamp(),
                "maxDownloads": 2,
                "accessCode": "54321",
                "environmentId": environment_id,
                "payload": {"text": "hello fastapi"},
            },
        )
        assert response.status_code == 201
        clip = response.json()
        assert clip["type"] == "text"
        assert clip["maxDownloads"] == 2
        assert clip["payload"]["text"] == "hello fastapi"

        list_response = client.get("/api/clips", params={"environmentId": environment_id})
        assert list_response.status_code == 200
        items = list_response.json()["items"]
        assert len(items) == 1
        assert items[0]["id"] == clip["id"]

        other_list = client.get("/api/clips", params={"environmentId": "another"})
        assert other_list.status_code == 200
        assert other_list.json()["items"] == []

        direct = client.get(f"/{clip['accessCode']}")
        assert direct.status_code == 200
        assert "hello fastapi" in direct.text

        second_direct = client.get(f"/{clip['accessCode']}")
        assert second_direct.status_code == 200

        exhausted = client.get(f"/{clip['accessCode']}")
        assert exhausted.status_code == 404


def test_file_clip_download_limit(tmp_path):
    file_content = b"sample file"
    data_url = "data:text/plain;base64," + base64.b64encode(file_content).decode("ascii")

    with build_client(tmp_path) as client:
        environment_id = "owner-file"
        response = client.post(
            "/api/clips",
            json={
                "type": "file",
                "expiresAt": future_timestamp(),
                "maxDownloads": 1,
                "environmentId": environment_id,
                "payload": {
                    "file": {
                        "name": "sample.txt",
                        "size": len(file_content),
                        "type": "text/plain",
                        "dataUrl": data_url,
                    }
                },
            },
        )
        assert response.status_code == 201
        clip = response.json()

        download = client.get(f"/api/clips/{clip['id']}/file", params={"environmentId": environment_id})
        assert download.status_code == 200
        assert download.content == file_content

        # second attempt should fail because maxDownloads is 1
        second_download = client.get(
            f"/api/clips/{clip['id']}/file",
            params={"environmentId": environment_id}
        )
        assert second_download.status_code in {404, 410}


def test_token_direct_access(tmp_path):
    with build_client(tmp_path) as client:
        register = client.post(
            "/api/tokens/register",
            json={"token": "pixia1234"}
        )
        assert register.status_code == 200
        environment_id = register.json()["environmentId"]

        response = client.post(
            "/api/clips",
            json={
                "type": "text",
                "expiresAt": future_timestamp(),
                "maxDownloads": 3,
                "accessToken": "pixia1234",
                "environmentId": environment_id,
                "payload": {"text": "hello from token"},
            },
        )
        assert response.status_code == 201
        clip = response.json()
        assert clip["accessToken"] == "pixia1234"
        assert clip["accessCode"] is None

        direct = client.get("/pixia1234")
        assert direct.status_code == 200
        assert "hello from token" in direct.text

        raw = client.get("/pixia1234/raw")
        assert raw.status_code == 200
        assert raw.text == "hello from token"


def test_token_register_conflict(tmp_path):
    with build_client(tmp_path) as client:
        first = client.post(
            "/api/tokens/register",
            json={"token": "repeat123"}
        )
        assert first.status_code == 200
        environment_id = first.json()["environmentId"]

        # registering with the same owner should succeed and refresh metadata
        repeat_same = client.post(
            "/api/tokens/register",
            json={"token": "repeat123", "environmentId": environment_id}
        )
        assert repeat_same.status_code == 200

        conflict = client.post(
            "/api/tokens/register",
            json={"token": "repeat123"}
        )
        assert conflict.status_code == 409
        assert "被其他设备占用" in conflict.json()["detail"]


def test_captcha_required_when_enabled(tmp_path):
    extra_env = {
        "SUPER_CLIPBOARD_CAPTCHA_PROVIDER": "turnstile",
        "SUPER_CLIPBOARD_CAPTCHA_SECRET": "dummy-secret",
        "SUPER_CLIPBOARD_CAPTCHA_BYPASS_TOKEN": "pass-me",
    }
    with build_client(tmp_path, extra_env=extra_env) as client:
        environment_id = "captcha-owner"

        missing = client.post(
            "/api/clips",
            json={
                "type": "text",
                "expiresAt": future_timestamp(),
                "maxDownloads": 1,
                "environmentId": environment_id,
                "payload": {"text": "captcha needed"},
            },
        )
        assert missing.status_code == 400
        assert "验证码" in missing.json()["detail"]

        mismatch = client.post(
            "/api/clips",
            json={
                "type": "text",
                "expiresAt": future_timestamp(),
                "maxDownloads": 1,
                "environmentId": environment_id,
                "payload": {"text": "captcha mismatch"},
                "captchaToken": "pass-me",
                "captchaProvider": "recaptcha",
            },
        )
        assert mismatch.status_code == 400
        assert "验证码配置不匹配" in mismatch.json()["detail"]

        ok = client.post(
            "/api/clips",
            json={
                "type": "text",
                "expiresAt": future_timestamp(),
                "maxDownloads": 1,
                "environmentId": environment_id,
                "payload": {"text": "captcha ok"},
                "captchaToken": "pass-me",
                "captchaProvider": "turnstile",
            },
        )
        assert ok.status_code == 201
        assert ok.json()["payload"]["text"] == "captcha ok"
