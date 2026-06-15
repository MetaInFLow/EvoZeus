from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from evozeus.core.session import SessionEnvelope
from evozeus.models import SessionEvent
from evozeus.scanners.base import ScanRequest, SessionRef


class CodexScanner:
    provider = "codex"

    def can_discover(self, request: ScanRequest) -> bool:
        source_dir = request.source_dir
        return bool(source_dir and source_dir.exists() and any(source_dir.rglob("*.jsonl")))

    def discover(self, request: ScanRequest) -> list[SessionRef]:
        source_dir = request.source_dir
        if source_dir is None:
            return []
        paths = sorted(source_dir.rglob("*.jsonl"))
        if request.limit is not None:
            paths = paths[: request.limit]
        return [
            SessionRef(provider=self.provider, session_id=path.stem, source_path=path)
            for path in paths
        ]

    def load(self, ref: SessionRef) -> SessionEnvelope:
        events: list[SessionEvent] = []
        for index, line in enumerate(ref.source_path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            payload = json.loads(line)
            events.append(_event_from_payload(index, payload))

        return SessionEnvelope(
            session_id=ref.session_id,
            provider=self.provider,
            source_ref=str(ref.source_path),
            events=events,
        )


def _event_from_payload(index: int, payload: dict[str, Any]) -> SessionEvent:
    event_id = str(payload.get("event_id") or payload.get("id") or f"event_{index:04d}")
    role = str(payload.get("role") or payload.get("type") or "unknown")
    content = str(payload.get("content") or payload.get("text") or "")
    tool_result = payload.get("tool_result")
    return SessionEvent(
        event_id=event_id,
        role=role,
        content=content,
        tool_name=payload.get("tool_name"),
        tool_result=tool_result if isinstance(tool_result, dict) else None,
        metadata={"provider": "codex"},
    )
