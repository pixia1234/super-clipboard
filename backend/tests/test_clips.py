import base64
import os
import sys
from datetime import datetime, timedelta, timezone
from importlib import import_module

from fastapi.testclient import TestClient


def build_client(tmp_path):
    db_path = tmp_path / "clips.db"
    files_dir = tmp_path / "files"
    static_dir = tmp_path / "static"
    os.environ["SUPER_CLIPBOARD_DATABASE_PATH"] = str(db_path)
    os.environ["SUPER_CLIPBOARD_FILE_STORAGE_DIR"] = str(files_dir)
    os.environ["SUPER_CLIPBOARD_STATIC_ROOT"] = str(static_dir)

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
        response = client.post(
            "/api/clips",
            json={
                "type": "text",
                "expiresAt": future_timestamp(),
                "maxDownloads": 2,
                "accessCode": "54321",
                "payload": {"text": "hello fastapi"},
            },
        )
        assert response.status_code == 201
        clip = response.json()
        assert clip["type"] == "text"
        assert clip["maxDownloads"] == 2
        assert clip["payload"]["text"] == "hello fastapi"

        list_response = client.get("/api/clips")
        assert list_response.status_code == 200
        items = list_response.json()["items"]
        assert len(items) == 1
        assert items[0]["id"] == clip["id"]

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
        response = client.post(
            "/api/clips",
            json={
                "type": "file",
                "expiresAt": future_timestamp(),
                "maxDownloads": 1,
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

        download = client.get(f"/api/clips/{clip['id']}/file")
        assert download.status_code == 200
        assert download.content == file_content

        # second attempt should fail because maxDownloads is 1
        second_download = client.get(f"/api/clips/{clip['id']}/file")
        assert second_download.status_code in {404, 410}
