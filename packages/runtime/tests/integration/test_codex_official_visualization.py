import importlib
import os
from pathlib import Path
from types import SimpleNamespace

import pytest

from evozeus_runtime.use_cases.run_codex_official_visualization import run_codex_official_visualization

visualization_use_case = importlib.import_module("evozeus_runtime.use_cases.run_codex_official_visualization")


def test_run_codex_official_visualization_scans_runs_and_renders_html(monkeypatch, tmp_path):
    home = tmp_path / "home"
    source = home / ".codex" / "sessions"
    outside_source = home / ".codex" / "archived_sessions"
    source.mkdir(parents=True)
    outside_source.mkdir(parents=True)
    fixture = Path("tests/fixtures/codex_sessions/session-minimal.jsonl")
    (source / "session-minimal.jsonl").write_text(fixture.read_text(encoding="utf-8"), encoding="utf-8")
    (outside_source / "outside-session.jsonl").write_text(
        fixture.read_text(encoding="utf-8").replace("session-minimal", "outside-session"),
        encoding="utf-8",
    )
    monkeypatch.setenv("HOME", str(home))
    workspace = tmp_path / "workspace"
    scan_sessions = visualization_use_case.scan_sessions
    scan_sessions(workspace_root=workspace, provider="codex", source_dir=outside_source)

    result = run_codex_official_visualization(
        workspace_root=workspace,
        source_dir=source,
        official_repo_root=_official_repo_root(),
        force=True,
        project_min_sessions=1,
    )

    assert result.session_count == 1
    assert result.factor_count == _expected_official_factor_count()
    assert result.ran_count == _expected_official_factor_count()
    assert result.error_count == 0
    assert result.html_path.exists()
    assert result.project_insights_html_path.exists()
    assert result.usage_profile_html_path.exists()
    assert result.project_insights_project_count == 1
    assert result.project_insights_session_count == 1
    html = result.html_path.read_text(encoding="utf-8")
    assert "Global Canvas" in html
    assert "session-minimal" in html
    assert "outside-session" not in html
    assert "official.tool-failure-frequency" in html
    project_html = result.project_insights_html_path.read_text(encoding="utf-8")
    assert "把真实会话变成可复用的工作方法" in project_html
    assert "evozeus-fixture" in project_html
    assert "outside-session" not in project_html
    usage_profile_html = result.usage_profile_html_path.read_text(encoding="utf-8")
    assert "AI 使用画像与 Session 价值报告" in usage_profile_html
    assert "代表性 Session" in usage_profile_html
    assert "证据口径" in usage_profile_html
    assert "outside-session" not in usage_profile_html


def test_run_codex_official_visualization_runs_only_pending_factor_ids(monkeypatch, tmp_path):
    calls: list[list[str]] = []

    class FakePackBuilder:
        def __init__(self, **_: object) -> None:
            pass

        def build(self) -> SimpleNamespace:
            return SimpleNamespace(factor_ids=["official.present", "official.missing"])

    class FakeLedger:
        def __init__(self, _paths: object) -> None:
            pass

        def list_session_statuses(self, *, factor_ids: list[str]) -> list[SimpleNamespace]:
            assert factor_ids == ["official.present", "official.missing"]
            return [
                SimpleNamespace(session_id="outside-session", pending_factor_count=2),
                SimpleNamespace(session_id="session-1", pending_factor_count=1),
            ]

        def list_pending_factor_ids(self, *, session_id: str, factor_ids: list[str]) -> list[str]:
            assert session_id == "session-1"
            assert factor_ids == ["official.present", "official.missing"]
            return ["official.missing"]

    def fake_run_factors(**kwargs: object) -> SimpleNamespace:
        calls.append(list(kwargs["factor_ids"]))  # type: ignore[index]
        return SimpleNamespace(result_count=1, error_count=0)

    output_html = tmp_path / "workspace" / ".evozeus" / "runtime" / "reports" / "codex-factor-visualization.html"
    output_html.parent.mkdir(parents=True, exist_ok=True)
    output_html.write_text("<html></html>", encoding="utf-8")
    project_html = tmp_path / "workspace" / ".evozeus" / "runtime" / "reports" / "project-insights" / "project-analysis-zh.html"
    project_html.parent.mkdir(parents=True, exist_ok=True)
    project_html.write_text("<html></html>", encoding="utf-8")
    usage_profile_html = tmp_path / "workspace" / ".evozeus" / "runtime" / "reports" / "ai-usage-profile" / "index.html"
    usage_profile_html.parent.mkdir(parents=True, exist_ok=True)
    usage_profile_html.write_text("<html></html>", encoding="utf-8")

    source = tmp_path / "approved-codex-history"

    def fake_scan_sessions(**kwargs: object) -> SimpleNamespace:
        assert kwargs["source_dir"] == source
        return SimpleNamespace(session_count=1, session_ids=("session-1",))

    def fake_generate_ledger_browser(**kwargs: object) -> SimpleNamespace:
        assert kwargs["session_ids"] == ("session-1",)
        return SimpleNamespace(
            ledger_path=tmp_path / "workspace" / ".evozeus" / "runtime" / "index" / "results.sqlite3",
            html_path=output_html,
        )

    def fake_generate_project_insights_site(**kwargs: object) -> SimpleNamespace:
        assert kwargs["session_ids"] == ("session-1",)
        return SimpleNamespace(
            html_path=project_html,
            project_count=1,
            session_count=1,
        )

    def fake_generate_ai_usage_profile_report(**kwargs: object) -> SimpleNamespace:
        assert kwargs["session_ids"] == ("session-1",)
        return SimpleNamespace(
            html_path=usage_profile_html,
            mbti_code="INTJ",
        )

    monkeypatch.setattr(visualization_use_case, "scan_sessions", fake_scan_sessions)
    monkeypatch.setattr(visualization_use_case, "OfficialFactorPackBuilder", FakePackBuilder)
    monkeypatch.setattr(visualization_use_case, "LedgerRepository", FakeLedger)
    monkeypatch.setattr(visualization_use_case, "run_factors", fake_run_factors)
    monkeypatch.setattr(visualization_use_case, "generate_ledger_browser", fake_generate_ledger_browser)
    monkeypatch.setattr(visualization_use_case, "generate_project_insights_site", fake_generate_project_insights_site)
    monkeypatch.setattr(visualization_use_case, "generate_ai_usage_profile_report", fake_generate_ai_usage_profile_report)

    result = run_codex_official_visualization(
        workspace_root=tmp_path / "workspace",
        source_dir=source,
        official_repo_root=tmp_path / "official",
        skip_fresh=True,
    )

    assert calls == [["official.missing"]]
    assert result.ran_count == 1
    assert result.skipped_count == 1
    assert result.usage_profile_html_path == usage_profile_html

    def fake_generate_project_insights(**kwargs: object) -> SimpleNamespace:
        assert kwargs["project"] == "daxing"
        assert kwargs["match_mode"] == "contains"
        assert kwargs["session_ids"] == ("session-1",)
        return SimpleNamespace(html_path=project_html, session_count=1)

    def fail_generate_project_insights_site(**_: object) -> SimpleNamespace:
        raise AssertionError("project route must not generate the all-project site")

    monkeypatch.setattr(visualization_use_case, "generate_project_insights", fake_generate_project_insights)
    monkeypatch.setattr(visualization_use_case, "generate_project_insights_site", fail_generate_project_insights_site)
    project_result = run_codex_official_visualization(
        workspace_root=tmp_path / "workspace",
        source_dir=source,
        official_repo_root=tmp_path / "official",
        skip_fresh=True,
        project="daxing",
        project_contains=True,
    )

    assert project_result.project_insights_project_count == 1
    assert project_result.project_insights_session_count == 1
    assert project_result.project_insights_html_path == project_html


def _official_repo_root() -> Path:
    configured = os.environ.get("EVOZEUS_OFFICIAL_REPO_ROOT")
    if not configured:
        pytest.skip("EVOZEUS_OFFICIAL_REPO_ROOT is required for cross-repo visualization tests")
    return Path(configured).expanduser().resolve()


def _expected_official_factor_count() -> int:
    return len(list((_official_repo_root() / "factors").glob("*/FACTOR.xml")))
