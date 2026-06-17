from __future__ import annotations

import json
import os
import re
import sqlite3
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = PROJECT_ROOT / "__infra__" / "scripts"
TESTDATA = PROJECT_ROOT / "__infra__" / "testdata"
PACK_ROOT = PROJECT_ROOT / "__infra__" / "factor_packs"
BRIDGED_CODEX_SOURCE_ID = "rollout-2026-06-14T14-55-35-019ec4ea-0f23-77b1-a2e0-92b897167191"
BRIDGED_CODEX_SESSION_ID = "019ec4ea-0f23-77b1-a2e0-92b897167191"
BRIDGED_CODEX_EVENT_COUNT = 80


def run_script(name: str, *args: str, env_overrides: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(PROJECT_ROOT / "__infra__" / "src")
    if env_overrides:
        env.update(env_overrides)
    return subprocess.run(
        [sys.executable, str(SCRIPTS / name), *args],
        check=False,
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        env=env,
    )


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


def test_scan_sessions_script_finds_session_with_enough_information(tmp_path: Path):
    fake_home = tmp_path / "home"
    _write_fake_codex_source(fake_home)
    result = run_script(
        "scan_sessions_smoke.py",
        "--source",
        str(TESTDATA / "codex_sessions"),
        "--min-sessions",
        "5",
        env_overrides={"HOME": str(fake_home)},
    )

    assert result.returncode == 0, result.stderr
    assert "scan sessions ok" in result.stdout
    assert "sessions=5" in result.stdout
    total_events = re.search(r"total_events=(\d+)", result.stdout)
    assert total_events is not None
    assert int(total_events.group(1)) >= BRIDGED_CODEX_EVENT_COUNT
    assert "has_tool_result=True" in result.stdout


def test_scan_factors_script_reports_factor_pack_count():
    result = run_script("scan_factors_smoke.py", "--pack-root", str(PACK_ROOT))

    assert result.returncode == 0, result.stderr
    assert "scan factors ok" in result.stdout
    assert "count=8" in result.stdout
    assert "intro_count=8" in result.stdout
    assert "default.tool_failure" in result.stdout


def test_run_factor_script_runs_specified_factor():
    result = run_script(
        "run_factor_smoke.py",
        "default.tool_failure",
        "--pack-root",
        str(PACK_ROOT),
        "--source",
        str(TESTDATA / "codex_sessions"),
    )

    assert result.returncode == 0, result.stderr
    assert "run factor ok" in result.stdout
    assert "factor_id=default.tool_failure" in result.stdout
    assert "verdict=Fix Environment" in result.stdout


def test_result_report_script_writes_markdown_report_without_json_result_file():
    result = run_script("result_report_smoke.py")

    assert result.returncode == 0, result.stderr
    assert "result report ok" in result.stdout
    assert "factor-results.md" in result.stdout
    assert "factor-results.html" in result.stdout
    assert "json_result_file=False" in result.stdout


def test_run_session_report_script_writes_html_for_selected_factors(tmp_path: Path):
    fake_home = tmp_path / "home"
    _write_fake_codex_source(fake_home)
    result = run_script(
        "run_session_report.py",
        "--source",
        str(TESTDATA / "codex_sessions"),
        "--pack-root",
        str(PACK_ROOT),
        "--workspace",
        str(tmp_path),
        "--factor",
        "default.tool_failure",
        "--factor",
        "default.open_loop",
        env_overrides={"HOME": str(fake_home)},
    )

    report_path = tmp_path / ".evozeus" / "sessions" / "session-alpha" / "factor-results.html"
    db_path = tmp_path / ".evozeus" / "runtime" / "index" / "results.sqlite3"
    assert result.returncode == 0, result.stderr
    assert "session report ok" in result.stdout
    assert "session_id=session-alpha" in result.stdout
    assert "results=2" in result.stdout
    assert "factor-results.html" in result.stdout
    assert "results.sqlite3" in result.stdout
    html = report_path.read_text(encoding="utf-8")
    assert 'data-component="word_cloud"' in html
    assert "session-beta" in html
    assert BRIDGED_CODEX_SESSION_ID in html
    assert "这个 factor 结果不对，没改到默认输出" in html
    assert "我会运行指定 factor。" in html
    assert "first_user_source_line" in html
    assert '"session_events"' in html
    assert 'data-component": "session_conversation"' in html
    assert "event_tag_strip" in html
    assert "fatal: network timeout" in html
    assert "tool_failure" in html
    assert "pending_factor_count" in html
    assert "default.tool_failure" in html
    assert "default.open_loop" in html
    assert db_path.exists()
    with sqlite3.connect(db_path) as conn:
        session_count = conn.execute("SELECT count(*) FROM sessions").fetchone()[0]
        result_count = conn.execute("SELECT count(*) FROM factor_results").fetchone()[0]
        run_index_count = conn.execute("SELECT count(*) FROM factor_run_index").fetchone()[0]
        event_tag_count = conn.execute("SELECT count(*) FROM event_factor_tags").fetchone()[0]
        loaded_event_count = conn.execute("SELECT count(*) FROM session_events").fetchone()[0]
    assert session_count == 5
    assert result_count == 2
    assert run_index_count == 2
    assert event_tag_count >= 1
    assert loaded_event_count >= BRIDGED_CODEX_EVENT_COUNT
