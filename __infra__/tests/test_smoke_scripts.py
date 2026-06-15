from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = PROJECT_ROOT / "__infra__" / "scripts"


def run_script(name: str, *args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(PROJECT_ROOT / "__infra__" / "src")
    return subprocess.run(
        [sys.executable, str(SCRIPTS / name), *args],
        check=False,
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        env=env,
    )


def test_scan_sessions_script_finds_session_with_enough_information():
    result = run_script("scan_sessions_smoke.py")

    assert result.returncode == 0, result.stderr
    assert "scan sessions ok" in result.stdout
    assert "sessions=1" in result.stdout
    assert "events=3" in result.stdout
    assert "has_tool_result=True" in result.stdout


def test_scan_factors_script_reports_builtin_factor_count():
    result = run_script("scan_factors_smoke.py")

    assert result.returncode == 0, result.stderr
    assert "scan factors ok" in result.stdout
    assert "count=3" in result.stdout
    assert "default.tool_failure" in result.stdout


def test_run_factor_script_runs_specified_factor():
    result = run_script("run_factor_smoke.py", "default.tool_failure")

    assert result.returncode == 0, result.stderr
    assert "run factor ok" in result.stdout
    assert "factor_id=default.tool_failure" in result.stdout
    assert "verdict=Fix Environment" in result.stdout


def test_result_report_script_writes_markdown_report_without_json_result_file():
    result = run_script("result_report_smoke.py")

    assert result.returncode == 0, result.stderr
    assert "result report ok" in result.stdout
    assert "factor-results.md" in result.stdout
    assert "json_result_file=False" in result.stdout
