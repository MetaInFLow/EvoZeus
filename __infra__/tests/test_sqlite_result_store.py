from pathlib import Path

from evozeus.core.session import SessionEnvelope
from evozeus.factors.protocol import FactorResult, FactorStage
from evozeus.models import SessionEvent, Verdict
from evozeus.runtime.paths import RuntimePaths
from evozeus.scanners.base import SessionRef
from evozeus.storage.sqlite_result_store import SQLiteResultStore


def test_sqlite_result_store_records_sessions_results_tags_and_event_content(tmp_path: Path):
    paths = RuntimePaths.for_workspace(tmp_path).ensure()
    store = SQLiteResultStore(paths)
    session = _session("session-alpha")
    result = FactorResult(
        factor_id="default.tool_failure",
        factor_version="0.1.0",
        framework_id="agent_session_review.v0",
        stage=FactorStage.SIGNAL_EXTRACTION,
        target_type="session",
        target_id=session.session_id,
        session_id=session.session_id,
        status="matched",
        tags=[{"type": "tool_failure", "value": "exec_command"}],
        scores={"tool_failure": 1.0},
        evidence_refs=[{"ref_id": "t1", "kind": "tool_event"}],
        verdict_signals=[Verdict.FIX_ENVIRONMENT.value],
        confidence=0.82,
    )

    analysis_run_id = store.record_factor_run(
        session,
        [result],
        factor_ids=["default.tool_failure"],
    )

    assert analysis_run_id.startswith("arun_")
    assert paths.result_index_db.exists()

    statuses = store.list_session_statuses(factor_ids=["default.tool_failure"])
    assert [(row.session_id, row.event_count, row.analyzed_factor_count, row.pending_factor_count) for row in statuses] == [
        ("session-alpha", 2, 1, 0)
    ]
    assert statuses[0].last_analyzed_at

    event_tags = store.list_event_factor_tags(session_id="session-alpha")
    assert len(event_tags) == 1
    event_tag = event_tags[0]
    assert event_tag.event_id == "t1"
    assert event_tag.role == "tool"
    assert event_tag.content == "fatal: network timeout"
    assert event_tag.factor_id == "default.tool_failure"
    assert event_tag.tag_type == "tool_failure"
    assert event_tag.tag_value == "exec_command"
    assert event_tag.analysis_run_id == analysis_run_id


def test_sqlite_result_store_marks_discovered_sessions_pending_until_factor_run(tmp_path: Path):
    paths = RuntimePaths.for_workspace(tmp_path).ensure()
    store = SQLiteResultStore(paths)
    store.record_session_refs(
        [
            SessionRef(provider="codex", session_id="session-alpha", source_path=Path("session-alpha.jsonl")),
            SessionRef(provider="codex", session_id="session-beta", source_path=Path("session-beta.jsonl")),
        ]
    )

    store.record_factor_run(
        _session("session-alpha"),
        [
            FactorResult(
                factor_id="default.open_loop",
                factor_version="0.1.0",
                framework_id="agent_session_review.v0",
                stage=FactorStage.SIGNAL_EXTRACTION,
                target_type="session",
                target_id="session-alpha",
                session_id="session-alpha",
                status="skipped",
                confidence=0.0,
            )
        ],
        factor_ids=["default.open_loop"],
    )

    statuses = store.list_session_statuses(factor_ids=["default.open_loop"])
    by_id = {row.session_id: row for row in statuses}

    assert by_id["session-alpha"].pending_factor_count == 0
    assert by_id["session-alpha"].last_analyzed_at
    assert by_id["session-beta"].event_count == 0
    assert by_id["session-beta"].analyzed_factor_count == 0
    assert by_id["session-beta"].pending_factor_count == 1
    assert by_id["session-beta"].last_analyzed_at == ""


def test_sqlite_result_store_replaces_stale_discovered_session_id_for_same_source(tmp_path: Path):
    paths = RuntimePaths.for_workspace(tmp_path).ensure()
    store = SQLiteResultStore(paths)
    source_path = Path("session-archive-shape.jsonl")

    store.record_session_refs([SessionRef(provider="codex", session_id="session-archive-shape", source_path=source_path)])
    store.record_session_refs([SessionRef(provider="codex", session_id="archive-session", source_path=source_path)])

    statuses = store.list_session_statuses(factor_ids=["default.open_loop"])

    assert [row.session_id for row in statuses] == ["archive-session"]
    assert statuses[0].pending_factor_count == 1


def _session(session_id: str) -> SessionEnvelope:
    return SessionEnvelope(
        session_id=session_id,
        provider="codex",
        source_ref=f"{session_id}.jsonl",
        events=[
            SessionEvent(event_id="u1", role="user", content="请修复 runtime scanner"),
            SessionEvent(
                event_id="t1",
                role="tool",
                content="fatal: network timeout",
                tool_name="exec_command",
                tool_result={"stderr": "fatal: network timeout"},
            ),
        ],
    )
