from pathlib import Path

from evozeus.core.session import SessionEnvelope
from evozeus.factors.protocol import FactorResult, FactorStage
from evozeus.factors.packs import FactorPackRepository
from evozeus.models import SessionEvent, Verdict
from evozeus.reports.html_report import render_factor_results_html
from evozeus.runtime.paths import RuntimePaths
from evozeus.storage.file_repository import FileSessionRepository


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PACK_ROOT = PROJECT_ROOT / "__infra__" / "factor_packs"


def test_file_repository_persists_session_and_factor_results(tmp_path: Path):
    paths = RuntimePaths.for_workspace(tmp_path).ensure()
    repository = FileSessionRepository(paths)
    envelope = SessionEnvelope(
        session_id="ezs_001",
        provider="codex",
        source_ref="session.jsonl",
        events=[SessionEvent(event_id="u1", role="user", content="hello")],
    )
    result = FactorResult(
        factor_id="default.test",
        factor_version="0.1.0",
        framework_id="agent_session_review.v0",
        stage=FactorStage.SIGNAL_EXTRACTION,
        target_type="session",
        target_id="ezs_001",
        session_id="ezs_001",
        verdict_signals=[Verdict.PRESERVE.value],
        confidence=0.7,
    )

    repository.write_session(envelope)
    repository.append_factor_results("ezs_001", [result])

    session_dir = paths.session_dir("ezs_001")
    report = (session_dir / "factor-results.md").read_text(encoding="utf-8")
    assert "## Factor Results" in report
    assert "default.test" in report
    assert "Preserve" in report
    assert not (session_dir / "factor-results.jsonl").exists()


def test_file_repository_writes_html_report_for_selected_factor_results(tmp_path: Path):
    paths = RuntimePaths.for_workspace(tmp_path).ensure()
    repository = FileSessionRepository(paths)
    packs = FactorPackRepository(PACK_ROOT).discover()
    results = [
        FactorResult(
            factor_id="default.tool_failure",
            factor_version="0.1.0",
            framework_id="agent_session_review.v0",
            stage=FactorStage.SIGNAL_EXTRACTION,
            target_type="session",
            target_id="ezs_001",
            session_id="ezs_001",
            tags=[{"type": "phrase", "value": "timeout"}, {"type": "tool", "value": "exec_command"}],
            evidence_refs=[{"event_id": "t1", "kind": "tool"}],
            verdict_signals=[Verdict.FIX_ENVIRONMENT.value],
            confidence=0.8,
        ),
        FactorResult(
            factor_id="default.open_loop",
            factor_version="0.1.0",
            framework_id="agent_session_review.v0",
            stage=FactorStage.SIGNAL_EXTRACTION,
            target_type="session",
            target_id="ezs_001",
            session_id="ezs_001",
            verdict_signals=[Verdict.OPEN_CASE.value],
            confidence=0.6,
        ),
    ]

    html_path = repository.write_factor_results_html(
        "ezs_001",
        results,
        packs,
        selected_factor_ids=["default.tool_failure"],
    )

    html = html_path.read_text(encoding="utf-8")
    assert html_path.name == "factor-results.html"
    assert "<!doctype html>" in html
    assert "cdn.jsdelivr.net/npm/antd@5/dist/reset.css" in html
    assert "cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js" in html
    assert "cdn.jsdelivr.net/npm/antd@5/dist/antd.min.js" in html
    assert 'id="evozeus-dashboard-root"' in html
    assert "window.__EVOZEUS_REPORT__" in html
    assert "const { App, Badge, Card, Col, Drawer, Progress, Row, Space, Statistic, Table, Tabs, Tag, Typography } = antd;" in html
    assert 'data-workspace-tab="sessions"' in html
    assert 'data-workspace-tab="dashboards"' in html
    assert 'data-workspace-tab="factor_packs"' in html
    assert "Sessions" in html
    assert "Dashboards" in html
    assert "Factor Packs" in html
    assert "expandable" in html
    assert "setDrawerResult" in html
    assert 'data-component="word_cloud"' in html
    assert 'data-result-card="factor_result"' in html
    assert "timeout" in html
    assert "default.tool_failure" in html
    assert "Fix Environment" in html
    assert '"result_count":1' in html
    assert 'data-component="evidence_list"' not in html


def test_html_report_renders_summary_statuses_and_formatted_scores():
    packs = FactorPackRepository(PACK_ROOT).discover()
    results = [
        FactorResult(
            factor_id="default.negative_feedback",
            factor_version="0.1.0",
            framework_id="agent_session_review.v0",
            stage=FactorStage.SIGNAL_EXTRACTION,
            target_type="session",
            target_id="ezs_001",
            session_id="ezs_001",
            scores={"negative_feedback": 0.3333333333333333},
            verdict_signals=[Verdict.PROMOTE_TO_SKILL.value],
            confidence=0.72,
        ),
        FactorResult(
            factor_id="default.repeated_user_requests",
            factor_version="0.1.0",
            framework_id="agent_session_review.v0",
            stage=FactorStage.SIGNAL_EXTRACTION,
            target_type="session",
            target_id="ezs_001",
            session_id="ezs_001",
            status="skipped",
            confidence=0.0,
        ),
    ]

    html = render_factor_results_html("ezs_001", results, packs)

    assert "Ant Design" in html
    assert 'data-component="result_summary"' in html
    assert 'data-status="matched"' in html
    assert 'data-status="skipped"' in html
    assert "Matched" in html
    assert "Skipped" in html
    assert "0.333" in html
    assert "0.3333333333333333" not in html
