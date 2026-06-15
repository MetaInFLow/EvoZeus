import json
from pathlib import Path

from evozeus.core.session import SessionEnvelope
from evozeus.factors.protocol import FactorResult, FactorStage
from evozeus.models import SessionEvent, Verdict
from evozeus.runtime.paths import RuntimePaths
from evozeus.storage.file_repository import FileSessionRepository


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
    assert json.loads((session_dir / "session-envelope.json").read_text(encoding="utf-8"))["session_id"] == "ezs_001"
    assert json.loads((session_dir / "events.jsonl").read_text(encoding="utf-8").splitlines()[0])["event_id"] == "u1"
    assert json.loads((session_dir / "factor-results.jsonl").read_text(encoding="utf-8").splitlines()[0])[
        "factor_id"
    ] == "default.test"
