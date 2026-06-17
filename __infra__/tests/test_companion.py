import json
from pathlib import Path

from fastapi.testclient import TestClient

from evozeus.companion.app import create_app
from evozeus.companion.tokens import create_one_time_token
from evozeus.runtime.paths import RuntimePaths
from evozeus.scanners.base import SessionRef
from evozeus.storage.sqlite_result_store import SQLiteResultStore

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TESTDATA = PROJECT_ROOT / "__infra__" / "testdata"
BRIDGED_CODEX_SOURCE_ID = "rollout-2026-06-14T14-55-35-019ec4ea-0f23-77b1-a2e0-92b897167191"
BRIDGED_CODEX_SESSION_ID = "019ec4ea-0f23-77b1-a2e0-92b897167191"
BRIDGED_CODEX_EVENT_COUNT = 80


def _write_fake_codex_source(home: Path) -> Path:
    source_path = home / ".codex" / "sessions" / "2026" / "06" / "14" / f"{BRIDGED_CODEX_SOURCE_ID}.jsonl"
    source_path.parent.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, object]] = [{"type": "session_meta", "payload": {"id": BRIDGED_CODEX_SESSION_ID}}]
    for index in range(BRIDGED_CODEX_EVENT_COUNT):
        records.append(
            {
                "type": "response_item",
                "payload": {
                    "id": f"bridge-event-{index:03d}",
                    "role": "user" if index % 2 == 0 else "assistant",
                    "content": f"桥接生成事件 {index:03d}",
                },
            }
        )
    source_path.write_text("\n".join(json.dumps(record, ensure_ascii=False) for record in records) + "\n", encoding="utf-8")
    return source_path


def test_create_one_time_token_returns_non_empty_token():
    assert create_one_time_token()


def test_companion_rejects_missing_token():
    client = TestClient(create_app(token="secret"))

    response = client.get("/")

    assert response.status_code == 403


def test_companion_accepts_valid_token():
    client = TestClient(create_app(token="secret"))

    response = client.get("/?token=secret")

    assert response.status_code == 200
    assert "EvoZeus Companion" in response.text


def test_companion_bootstrap_status_and_factor_routes(tmp_path):
    client = TestClient(create_app(token="secret", workspace_root=tmp_path))

    status = client.get("/api/bootstrap/status?token=secret")
    assert status.status_code == 200
    assert status.json()["initialized"] is False

    bootstrap = client.post("/api/bootstrap?token=secret")
    assert bootstrap.status_code == 200
    assert bootstrap.json()["initialized"] is True

    factors = client.get("/api/factors?token=secret")
    routes = client.get("/api/routes?token=secret")
    assert factors.status_code == 200
    assert routes.status_code == 200
    assert len(factors.json()["factors"]) >= 8
    assert any(factor["factor_id"] == "default.tool_failure" for factor in factors.json()["factors"])
    assert any(route["route_area"] == "dashboard" for route in routes.json()["routes"])


def test_companion_lists_sessions_from_sqlite(tmp_path):
    paths = RuntimePaths.for_workspace(tmp_path).ensure()
    store = SQLiteResultStore(paths)
    store.record_session_refs(
        [
            SessionRef(
                provider="codex",
                session_id="session-alpha",
                source_path=tmp_path / "session-alpha.jsonl",
            )
        ]
    )
    client = TestClient(create_app(token="secret", workspace_root=tmp_path))

    response = client.get("/api/sessions?token=secret&factor_id=default.open_loop")

    assert response.status_code == 200
    sessions = response.json()["sessions"]
    assert sessions[0]["session_id"] == "session-alpha"
    assert sessions[0]["provider"] == "codex"
    assert sessions[0]["pending_factor_count"] == 1


def test_companion_scans_and_analyzes_session(tmp_path, monkeypatch):
    fake_home = tmp_path / "home"
    bridged_source_path = _write_fake_codex_source(fake_home)
    monkeypatch.setenv("HOME", str(fake_home))
    client = TestClient(create_app(token="secret", workspace_root=tmp_path))
    client.post("/api/bootstrap?token=secret")

    scan = client.post(f"/api/scan?token=secret&source={TESTDATA / 'codex_sessions'}")
    assert scan.status_code == 200
    assert scan.json()["session_count"] == 5

    analyze = client.post("/api/analyze/session-alpha?token=secret&factor_id=default.tool_failure")
    assert analyze.status_code == 200
    assert analyze.json()["session_id"] == "session-alpha"
    assert analyze.json()["result_count"] == 1
    assert analyze.json()["html_path"].endswith("factor-results.html")

    sessions = client.get("/api/sessions?token=secret&factor_id=default.tool_failure").json()["sessions"]
    by_id = {session["session_id"]: session for session in sessions}
    assert by_id["session-alpha"]["pending_factor_count"] == 0
    assert by_id["session-alpha"]["analyzed_factor_count"] == 1
    assert by_id["session-beta"]["event_count"] == 3
    assert by_id["session-beta"]["first_user_preview"] == "这个 factor 结果不对，没改到默认输出"
    assert by_id["session-beta"]["first_user_source_line"] == 1
    assert by_id["session-beta"]["last_assistant_preview"] == "我会运行指定 factor。"
    assert by_id[BRIDGED_CODEX_SESSION_ID]["event_count"] == BRIDGED_CODEX_EVENT_COUNT
    assert by_id[BRIDGED_CODEX_SESSION_ID]["source_ref"] == str(bridged_source_path)
