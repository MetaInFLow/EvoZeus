import json
from pathlib import Path

import pytest

from evozeus_runtime.ledger.paths import RuntimePaths
from evozeus_runtime.ledger.repository import LedgerRepository
from evozeus_runtime.use_cases.generate_project_insights import generate_project_insights, generate_project_insights_site
from evozeus_runtime.use_cases.generate_report import generate_report
from evozeus_runtime.use_cases.generate_ledger_browser import generate_ledger_browser
from evozeus_runtime.use_cases.run_factors import run_factors
from evozeus_runtime.use_cases.scan_sessions import scan_sessions


def test_scan_sessions_uses_default_codex_dirs_when_source_is_omitted(monkeypatch, tmp_path):
    home = tmp_path / "home"
    source = home / ".codex" / "sessions"
    source.mkdir(parents=True)
    fixture = Path("tests/fixtures/codex_sessions/session-minimal.jsonl")
    (source / "session-minimal.jsonl").write_text(fixture.read_text(encoding="utf-8"), encoding="utf-8")
    monkeypatch.setenv("HOME", str(home))

    scan_result = scan_sessions(
        workspace_root=tmp_path / "workspace",
        provider="codex",
        source_dir=None,
    )

    assert scan_result.session_count == 1


def test_scan_sessions_records_message_ids_without_content(tmp_path):
    scan_sessions(
        workspace_root=tmp_path,
        provider="codex",
        source_dir=Path("tests/fixtures/codex_sessions"),
    )

    ledger = LedgerRepository(RuntimePaths.for_workspace(tmp_path).ensure())
    events = ledger.list_session_events(session_id="session-minimal")

    assert [event.event_id for event in events] == ["event_0002", "event_0004"]
    assert [event.role for event in events] == ["user", "task_complete"]
    assert [event.tool_name for event in events] == ["", ""]
    assert all(event.content == "" for event in events)
    assert all(event.tool_result_preview == "" for event in events)


def test_scan_sessions_rejects_duplicate_embedded_session_ids_before_persistence(tmp_path):
    source = tmp_path / "approved-codex-history"
    source.mkdir()
    fixture = Path("tests/fixtures/codex_sessions/session-minimal.jsonl").read_text(encoding="utf-8")
    (source / "first.jsonl").write_text(fixture, encoding="utf-8")
    (source / "second.jsonl").write_text(
        fixture.replace("请扫描这个 session", "DUPLICATE SOURCE MUST NOT BE COMBINED"),
        encoding="utf-8",
    )
    workspace = tmp_path / "workspace"

    with pytest.raises(ValueError, match="duplicate embedded session ID 'session-minimal'"):
        scan_sessions(workspace_root=workspace, provider="codex", source_dir=source)

    assert not RuntimePaths.for_workspace(workspace).result_index_db.exists()


def test_scan_run_report_flow_writes_local_artifacts(tmp_path):
    scan_result = scan_sessions(
        workspace_root=tmp_path,
        provider="codex",
        source_dir=Path("tests/fixtures/codex_sessions"),
    )

    assert scan_result.session_count == 1
    assert scan_result.session_ids == ("session-minimal",)
    assert scan_result.ledger_path.exists()

    run_result = run_factors(
        workspace_root=tmp_path,
        session_id="session-minimal",
        factor_ids=["default.tool_failure"],
        pack_root=Path("tests/fixtures/factor_packs"),
    )

    assert run_result.result_count == 1
    assert run_result.error_count == 0

    ledger = LedgerRepository(RuntimePaths.for_workspace(tmp_path).ensure())
    events = ledger.list_session_events(session_id="session-minimal")
    assert [event.event_id for event in events] == ["event_0002", "event_0003", "event_0004"]
    assert events[1].role == "tool"
    assert events[1].tool_name == "exec_command"
    assert "Traceback" in events[1].content

    report_result = generate_report(
        workspace_root=tmp_path,
        session_id="session-minimal",
        formats=["markdown", "json", "html"],
    )

    assert report_result.markdown_path.exists()
    assert report_result.json_path.exists()
    assert report_result.html_path.exists()
    assert "default.tool_failure" in report_result.markdown_path.read_text(encoding="utf-8")


def test_generate_ledger_browser_writes_provider_project_session_chat_html(tmp_path):
    scan_sessions(
        workspace_root=tmp_path,
        provider="codex",
        source_dir=Path("tests/fixtures/codex_sessions"),
    )

    result = generate_ledger_browser(workspace_root=tmp_path)

    html = result.html_path.read_text(encoding="utf-8")
    assert result.html_path.exists()
    assert result.ledger_path == RuntimePaths.for_workspace(tmp_path).result_index_db
    assert "EvoZeus SQLite Visualizer" in html
    assert "codex" in html
    assert "session-minimal" in html
    assert "event_0002" in html
    assert "results.sqlite3" in html


def test_generate_project_insights_groups_user_phrases_by_project(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    (source / "session-daxing-1.jsonl").write_text(
        "\n".join(
            [
                '{"type":"session_meta","payload":{"id":"session-daxing-1","cwd":"/tmp/daxing"}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"只做只读分析，不修改文件\\n拉起来看下\\n\\\"name\\\": \\\"预计毛利\\\""}]}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"不要重复修改文件"}]}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"不要重复修改文件"}]}}',
                '{"type":"event_msg","payload":{"type":"task_complete","completed_at":"2026-06-19T00:00:00Z","duration_ms":10}}',
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (source / "session-daxing-2.jsonl").write_text(
        "\n".join(
            [
                '{"type":"session_meta","payload":{"id":"session-daxing-2","cwd":"/tmp/daxing"}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"只做只读分析，不修改文件\\n先写design doc 放在docs里"}]}}',
                '{"type":"event_msg","payload":{"type":"task_complete","completed_at":"2026-06-19T00:00:00Z","duration_ms":10}}',
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    (source / "session-daxing-subagent.jsonl").write_text(
        "\n".join(
            [
                '{"type":"session_meta","payload":{"id":"session-daxing-subagent","cwd":"/tmp/daxing"}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"你是大兴二期只读审查 agent。请只读检查仓库，不修改文件。\\n输出格式：中文结论"}]}}',
                '{"type":"event_msg","payload":{"type":"task_complete","completed_at":"2026-06-19T00:00:00Z","duration_ms":10}}',
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    scan_sessions(workspace_root=tmp_path, provider="codex", source_dir=source)
    for session_id in ["session-daxing-1", "session-daxing-2", "session-daxing-subagent"]:
        run_factors(
            workspace_root=tmp_path,
            session_id=session_id,
            factor_ids=["default.tool_failure"],
            pack_root=Path("tests/fixtures/factor_packs"),
        )

    result = generate_project_insights(
        workspace_root=tmp_path,
        project="daxing",
        formats=["markdown", "json", "html"],
        top_n=10,
    )

    markdown = result.markdown_path.read_text(encoding="utf-8")
    data = result.json_path.read_text(encoding="utf-8")
    html = result.html_path.read_text(encoding="utf-8")
    payload = json.loads(data)
    assert result.session_count == 3
    assert "Project Insight Report: daxing" in markdown
    assert "EvoZeus Insight" in html
    assert "跨 Session 高频原话" in html
    assert "单 Session 内重复强调" in html
    assert "只做只读分析，不修改文件" in html
    assert "只做只读分析，不修改文件" in markdown
    assert "先写 design doc" in markdown
    assert "委派任务模板" in markdown
    assert '"delegated_task": 1' in data
    assert '"direct_session_count": 2' in data
    assert payload["project_key"] == "daxing"
    assert payload["project_label"] == "daxing"
    assert payload["source_sessions"] == 3
    assert payload["project_evidence"]
    repeated_item = next(item for item in payload["exact_phrases"] if item["text"] == "只做只读分析，不修改文件")
    assert repeated_item["occurrence_count"] == 2
    assert repeated_item["count"] == 2
    assert len(repeated_item["evidence"]) == 2
    assert repeated_item["evidence"][0]["context"]
    assert all(item["speaker"] == "user" for item in repeated_item["evidence"])
    assert all(item["speaker"] == "user" for item in repeated_item["occurrences"])
    assert all(item["context_ref"].startswith("report://contexts/") for item in repeated_item["occurrences"])
    product_item = next(item for item in payload["user_repeated_phrases"] if item["text"] == "只做只读分析，不修改文件")
    assert product_item["occurrences"] == repeated_item["occurrences"]
    local_repeat = next(item for item in payload["session_local_repeats"] if item["text"] == "不要重复修改文件")
    assert local_repeat["occurrence_count"] == 2
    assert local_repeat["session_count"] == 1
    assert len(local_repeat["evidence"]) == 2
    assert {item["session_id"] for item in local_repeat["occurrences"]} == {"session-daxing-1"}
    product_local_repeat = next(
        item for item in payload["single_session_repeated_phrases"] if item["text"] == "不要重复修改文件"
    )
    assert product_local_repeat["session_count"] == 1
    assert all(item["text"] != "不要重复修改文件" for item in payload["exact_phrases"])
    assert any(item["text"] == '"name": "预计毛利"' for item in payload["quoted_material_phrases"])
    assert all(item["text"] != '"name": "预计毛利"' for item in payload["exact_phrases"])
    assert result.json_path.exists()
    assert result.html_path.exists()
    assert (result.html_path.parent / "assets" / "evozeus-gold-512.png").exists()
    assert (result.html_path.parent / "assets" / "evozeus-zeus-hero.png").exists()

    site_result = generate_project_insights_site(
        workspace_root=tmp_path,
        formats=["markdown", "json", "html"],
        min_sessions=1,
        top_n=10,
    )
    site_html = site_result.html_path.read_text(encoding="utf-8")
    site_payload = json.loads(site_result.json_path.read_text(encoding="utf-8"))
    assert site_result.project_count == 1
    assert site_result.session_count == 3
    assert site_result.html_path.name == "project-analysis-zh.html"
    assert "把真实会话变成可复用的工作方法" in site_html
    assert "daxing" in site_html
    assert "只做只读分析，不修改文件" in site_html
    assert "不要重复修改文件" in site_html
    assert "contexts-session-daxing-1" in site_html
    assert "evozeus-zeus-hero.png" in site_html
    assert site_payload["analysis_contract"]["id"] == "evozeus.project_insights_report.v1"
    assert "user_repeated_phrases" in site_payload["analysis_contract"]["minimum_report_fields"]
    assert site_payload["projects"][0]["project"] == "daxing"
    assert site_payload["reports"][0]["project"] == "daxing"
