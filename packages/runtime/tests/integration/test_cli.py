from pathlib import Path
from types import SimpleNamespace

from typer.testing import CliRunner

import evozeus_runtime.cli.main as cli_main
from evozeus_runtime.cli.main import app


def test_runtime_resolves_the_built_in_session_signal_pack():
    root = cli_main._built_in_session_signal_root()

    assert root is not None
    assert root.name == "session-signal"
    assert (root / "factors").is_dir()
    assert (root / "SKILL.md").is_file()


def test_status_command_prints_runtime_status():
    result = CliRunner().invoke(app, ["status"])

    assert result.exit_code == 0
    assert "scanner-runner-runtime" in result.stdout


def test_session_insights_command_runs_full_scan_factor_report_pipeline(monkeypatch, tmp_path):
    output_html = tmp_path / "visualizer.html"
    project_html = tmp_path / "project-analysis-zh.html"
    usage_profile_html = tmp_path / "ai-usage-profile" / "index.html"

    def fake_run_codex_official_visualization(**kwargs: object) -> SimpleNamespace:
        assert kwargs["workspace_root"] == tmp_path
        assert kwargs["official_repo_root"] == tmp_path / "official"
        assert kwargs["force"] is False
        assert kwargs["skip_fresh"] is True
        assert kwargs["project_min_sessions"] == 1
        assert kwargs["project_top_n"] == 12
        return SimpleNamespace(
            session_count=3,
            factor_count=7,
            ran_count=2,
            skipped_count=19,
            error_count=0,
            db_size_bytes=123,
            ledger_path=tmp_path / ".evozeus" / "runtime" / "index" / "results.sqlite3",
            html_path=output_html,
            project_insights_html_path=project_html,
            usage_profile_html_path=usage_profile_html,
            project_insights_project_count=1,
            project_insights_session_count=3,
        )

    monkeypatch.setattr(cli_main, "run_codex_official_visualization", fake_run_codex_official_visualization, raising=False)

    result = CliRunner().invoke(
        app,
        [
            "session-insights",
            "--workspace",
            str(tmp_path),
            "--official-repo-root",
            str(tmp_path / "official"),
            "--project-min-sessions",
            "1",
            "--project-top-n",
            "12",
        ],
    )

    assert result.exit_code == 0
    assert "sessions=3" in result.stdout
    assert "ran=2" in result.stdout
    assert "skipped=19" in result.stdout
    assert f"html={output_html}" in result.stdout
    assert f"project_insights_html={project_html}" in result.stdout
    assert f"usage_profile_html={usage_profile_html}" in result.stdout


def test_usage_profile_report_command_generates_integrated_report(monkeypatch, tmp_path):
    output_dir = tmp_path / "reports" / "ai-usage-profile"
    html_path = output_dir / "index.html"
    json_path = output_dir / "report-data.json"
    markdown_path = output_dir / "summary.md"

    def fake_generate_ai_usage_profile_report(**kwargs: object) -> SimpleNamespace:
        assert kwargs["workspace_root"] == tmp_path
        assert kwargs["formats"] == ["json", "html"]
        assert kwargs["output_dir"] == output_dir
        assert kwargs["subject"] == "Anthony"
        return SimpleNamespace(
            html_path=html_path,
            json_path=json_path,
            markdown_path=markdown_path,
            ledger_path=tmp_path / ".evozeus" / "runtime" / "index" / "results.sqlite3",
            session_count=3,
            factor_result_count=24,
            mbti_code="INTJ",
        )

    monkeypatch.setattr(cli_main, "generate_ai_usage_profile_report", fake_generate_ai_usage_profile_report, raising=False)

    result = CliRunner().invoke(
        app,
        [
            "usage-profile-report",
            "--workspace",
            str(tmp_path),
            "--format",
            "json",
            "--format",
            "html",
            "--output-dir",
            str(output_dir),
            "--subject",
            "Anthony",
        ],
    )

    assert result.exit_code == 0
    assert "sessions=3" in result.stdout
    assert "factor_results=24" in result.stdout
    assert "mbti=INTJ" in result.stdout
    assert f"html={html_path}" in result.stdout
