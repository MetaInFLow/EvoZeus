from __future__ import annotations

from evozeus.core.session import SessionEnvelope
from evozeus.factors.protocol import FactorResult
from evozeus.runtime.paths import RuntimePaths


class FileSessionRepository:
    def __init__(self, paths: RuntimePaths):
        self.paths = paths

    def write_session(self, envelope: SessionEnvelope) -> None:
        session_dir = self.paths.session_dir(envelope.session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        (session_dir / "session-envelope.json").write_text(
            envelope.model_dump_json(indent=2) + "\n",
            encoding="utf-8",
        )
        with (session_dir / "events.jsonl").open("w", encoding="utf-8") as handle:
            for event in envelope.events:
                handle.write(event.model_dump_json() + "\n")

    def append_factor_results(self, session_id: str, results: list[FactorResult]) -> None:
        session_dir = self.paths.session_dir(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        with (session_dir / "factor-results.jsonl").open("a", encoding="utf-8") as handle:
            for result in results:
                handle.write(result.model_dump_json() + "\n")
