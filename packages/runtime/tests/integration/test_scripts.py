from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import pytest


def test_scanner_and_runner_scripts_work_together(tmp_path):
    scan = subprocess.run(
        [
            sys.executable,
            "scripts/run_scanner.py",
            "--provider",
            "codex",
            "--source",
            "tests/fixtures/codex_sessions",
            "--workspace",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert scan.returncode == 0, scan.stderr
    assert "scanned_sessions=1" in scan.stdout

    run = subprocess.run(
        [
            sys.executable,
            "scripts/run_runner.py",
            "--session-id",
            "session-minimal",
            "--factor",
            "default.tool_failure",
            "--pack-root",
            "tests/fixtures/factor_packs",
            "--workspace",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert run.returncode == 0, run.stderr
    assert "results=1" in run.stdout
    assert "errors=0" in run.stdout


def test_sqlite_visualizer_script_writes_html(tmp_path):
    scan = subprocess.run(
        [
            sys.executable,
            "scripts/run_scanner.py",
            "--provider",
            "codex",
            "--source",
            "tests/fixtures/codex_sessions",
            "--workspace",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert scan.returncode == 0, scan.stderr

    visualizer = subprocess.run(
        [
            sys.executable,
            "scripts/render_sqlite_html.py",
            "--workspace",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert visualizer.returncode == 0, visualizer.stderr
    assert "html=" in visualizer.stdout
    html_path = Path(visualizer.stdout.split("html=", 1)[1].splitlines()[0])
    assert html_path.exists()
    assert "session-minimal" in html_path.read_text(encoding="utf-8")


def test_graphqlite_visualizer_script_writes_html(tmp_path):
    if importlib.util.find_spec("graphqlite") is None:
        pytest.skip("graphqlite optional dependency is not installed")

    scan = subprocess.run(
        [
            sys.executable,
            "scripts/run_scanner.py",
            "--provider",
            "codex",
            "--source",
            "tests/fixtures/codex_sessions",
            "--workspace",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert scan.returncode == 0, scan.stderr

    run = subprocess.run(
        [
            sys.executable,
            "scripts/run_runner.py",
            "--session-id",
            "session-minimal",
            "--factor",
            "default.tool_failure",
            "--pack-root",
            "tests/fixtures/factor_packs",
            "--workspace",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert run.returncode == 0, run.stderr

    migrate = subprocess.run(
        [
            sys.executable,
            "scripts/migrate_sqlite_to_graphqlite.py",
            "--workspace",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert migrate.returncode == 0, migrate.stderr

    visualizer = subprocess.run(
        [
            sys.executable,
            "scripts/render_graphqlite_html.py",
            "--workspace",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    assert visualizer.returncode == 0, visualizer.stderr
    assert "html=" in visualizer.stdout
    html_path = Path(visualizer.stdout.split("html=", 1)[1].splitlines()[0])
    html = html_path.read_text(encoding="utf-8")
    assert "EvoZeus Graph Ledger Browser" in html
    assert "GraphQLite sparse evidence graph" in html
    assert "session-minimal" in html


def test_scanner_script_uses_default_codex_dirs_when_source_is_omitted(tmp_path):
    home = tmp_path / "home"
    source = home / ".codex" / "sessions"
    source.mkdir(parents=True)
    fixture = Path("tests/fixtures/codex_sessions/session-minimal.jsonl")
    (source / "session-minimal.jsonl").write_text(fixture.read_text(encoding="utf-8"), encoding="utf-8")

    scan = subprocess.run(
        [
            sys.executable,
            "scripts/run_scanner.py",
            "--provider",
            "codex",
            "--workspace",
            str(tmp_path / "workspace"),
        ],
        capture_output=True,
        text=True,
        check=False,
        env={"HOME": str(home)},
    )

    assert scan.returncode == 0, scan.stderr
    assert "scanned_sessions=1" in scan.stdout


def test_scanner_script_defaults_runtime_state_to_home_evozeus(tmp_path):
    home = tmp_path / "home"
    source = home / ".codex" / "sessions"
    source.mkdir(parents=True)
    fixture = Path("tests/fixtures/codex_sessions/session-minimal.jsonl")
    (source / "session-minimal.jsonl").write_text(fixture.read_text(encoding="utf-8"), encoding="utf-8")

    scan = subprocess.run(
        [
            sys.executable,
            "scripts/run_scanner.py",
            "--provider",
            "codex",
        ],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "HOME": str(home)},
    )

    assert scan.returncode == 0, scan.stderr
    assert f"ledger={home / '.evozeus' / 'runtime' / 'index' / 'results.sqlite3'}" in scan.stdout


def test_codex_official_visualization_script_writes_final_html(tmp_path):
    home = tmp_path / "home"
    source = home / ".codex" / "sessions"
    source.mkdir(parents=True)
    fixture = Path("tests/fixtures/codex_sessions/session-minimal.jsonl")
    (source / "session-minimal.jsonl").write_text(fixture.read_text(encoding="utf-8"), encoding="utf-8")

    run = subprocess.run(
        [
            sys.executable,
            "scripts/run_codex_official_visualization.py",
            "--workspace",
            str(tmp_path / "workspace"),
            "--source-path",
            str(source),
            "--official-repo-root",
            str(_official_repo_root()),
            "--force",
            "--project-min-sessions",
            "1",
        ],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "HOME": str(home)},
    )

    assert run.returncode == 0, run.stderr
    assert "sessions=1" in run.stdout
    assert f"factors={_expected_official_factor_count()}" in run.stdout
    assert "errors=0" in run.stdout
    html_path = Path(run.stdout.split("html=", 1)[1].splitlines()[0])
    assert html_path.exists()
    assert "Global Canvas" in html_path.read_text(encoding="utf-8")
    project_html_path = Path(run.stdout.split("project_insights_html=", 1)[1].splitlines()[0])
    assert project_html_path.exists()
    assert "把真实会话变成可复用的工作方法" in project_html_path.read_text(encoding="utf-8")


def _expected_official_factor_count() -> int:
    return len(list((_official_repo_root() / "factors").glob("*/FACTOR.xml")))


def _official_repo_root() -> Path:
    configured = os.environ.get("EVOZEUS_OFFICIAL_REPO_ROOT")
    if not configured:
        pytest.skip("EVOZEUS_OFFICIAL_REPO_ROOT is required for cross-repo script tests")
    return Path(configured).expanduser().resolve()
