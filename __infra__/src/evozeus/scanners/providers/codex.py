from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from evozeus.core.session import SessionEnvelope
from evozeus.models import SessionEvent
from evozeus.scanners.base import ScanRequest, SessionRef
from evozeus.scanners.resolver import EventLocator, ResolvedEvent

TOOL_RESPONSE_ITEM_TYPES = {
    "function_call",
    "function_call_output",
    "custom_tool_call",
    "custom_tool_call_output",
    "web_search_call",
}
SCANNER_ID = "codex"
SCANNER_VERSION = "0.1.0"
SOURCE_LOCATOR_SCHEMA = "locator.codex_jsonl.v0"
ARTIFACT_LOCATOR_SCHEMA = "locator.evozeus_artifact_jsonl.v0"
SECRET_RE = re.compile(r"(?i)\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*\S+")


class CodexScanner:
    provider = "codex"
    scanner_id = SCANNER_ID
    scanner_version = SCANNER_VERSION

    def can_discover(self, request: ScanRequest) -> bool:
        return any(source_dir.exists() and any(source_dir.rglob("*.jsonl")) for source_dir in _source_dirs(request))

    def discover(self, request: ScanRequest) -> list[SessionRef]:
        paths = [
            path
            for source_dir in _source_dirs(request)
            if source_dir.exists()
            for path in source_dir.rglob("*.jsonl")
        ]
        paths = sorted(paths)
        if request.limit is not None:
            paths = paths[: request.limit]
        return [
            SessionRef(
                provider=self.provider,
                session_id=_discover_session_id(path),
                source_path=path,
                metadata=_source_metadata(path),
            )
            for path in paths
        ]

    def load(self, ref: SessionRef) -> SessionEnvelope:
        events: list[SessionEvent] = []
        session_id = ref.session_id
        source_fingerprint = str(ref.metadata.get("source_fingerprint") or _source_fingerprint(ref.source_path))
        for index, line in enumerate(ref.source_path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip():
                continue
            record = json.loads(line)
            if not isinstance(record, dict):
                continue

            embedded_session_id = _session_id_from_record(record)
            if embedded_session_id is not None:
                session_id = embedded_session_id
                continue

            event = _event_from_payload(index, record)
            if event is not None:
                event = _with_locator(
                    event,
                    record=record,
                    source_path=ref.source_path,
                    source_fingerprint=source_fingerprint,
                    raw_line_index=index,
                    event_index=len(events) + 1,
                    session_id=session_id,
                )
                events.append(event)

        return SessionEnvelope(
            session_id=session_id,
            provider=self.provider,
            source_ref=str(ref.source_path),
            events=events,
            metadata={
                "scanner_id": SCANNER_ID,
                "scanner_version": SCANNER_VERSION,
                "source_fingerprint": source_fingerprint,
            },
        )


def _session_id_from_record(record: dict[str, Any]) -> str | None:
    payload = record.get("payload")
    if record.get("type") == "session_meta" and isinstance(payload, dict) and payload.get("id"):
        return str(payload["id"])
    return None


def _discover_session_id(path: Path) -> str:
    inspected = 0
    with path.open(encoding="utf-8") as handle:
        lines = handle.readlines(100_000)
    for line in lines:
        if not line.strip():
            continue
        inspected += 1
        if inspected > 100:
            break
        try:
            record = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(record, dict):
            continue
        session_id = _session_id_from_record(record)
        if session_id is not None:
            return session_id
    return path.stem


def _event_from_payload(index: int, record: dict[str, Any]) -> SessionEvent | None:
    payload = record.get("payload")
    if isinstance(payload, dict):
        return _event_from_wrapped_payload(index, record, payload)
    return _event_from_flat_payload(index, record)


def _event_from_flat_payload(index: int, payload: dict[str, Any]) -> SessionEvent:
    event_id = str(payload.get("event_id") or payload.get("id") or f"event_{index:04d}")
    role = str(payload.get("role") or payload.get("type") or "unknown")
    content = _string_content(payload.get("content") or payload.get("text") or "")
    tool_result = payload.get("tool_result")
    return SessionEvent(
        event_id=event_id,
        role=role,
        content=content,
        tool_name=payload.get("tool_name"),
        tool_result=tool_result if isinstance(tool_result, dict) else None,
        metadata={"provider": "codex"},
    )


def _event_from_wrapped_payload(index: int, record: dict[str, Any], payload: dict[str, Any]) -> SessionEvent | None:
    wrapper_type = str(record.get("type") or "unknown")
    if wrapper_type == "session_meta":
        return None

    event_type = str(payload.get("type") or wrapper_type)
    event_id = str(payload.get("id") or record.get("id") or record.get("timestamp") or f"event_{index:04d}")

    if wrapper_type == "response_item":
        if event_type in TOOL_RESPONSE_ITEM_TYPES:
            return _tool_response_item_event(event_id, wrapper_type, event_type, payload)
        return SessionEvent(
            event_id=event_id,
            role=str(payload.get("role") or event_type),
            content=_response_content(payload),
            metadata={"provider": "codex", "codex_record_type": wrapper_type, "codex_event_type": event_type},
        )

    if wrapper_type == "event_msg":
        message = payload.get("message") or payload.get("last_agent_message") or payload.get("content") or payload.get("text")
        role = _event_msg_role(event_type, payload)
        tool_result = {"message": _string_content(message)} if role == "tool" and message is not None else None
        return SessionEvent(
            event_id=event_id,
            role=role,
            content=_string_content(message),
            tool_name=event_type if role == "tool" else None,
            tool_result=tool_result,
            metadata={"provider": "codex", "codex_record_type": wrapper_type, "codex_event_type": event_type},
        )

    return SessionEvent(
        event_id=event_id,
        role=str(payload.get("role") or event_type),
        content=_response_content(payload),
        metadata={"provider": "codex", "codex_record_type": wrapper_type, "codex_event_type": event_type},
    )


def _tool_response_item_event(
    event_id: str,
    wrapper_type: str,
    event_type: str,
    payload: dict[str, Any],
) -> SessionEvent:
    tool_result = _tool_result_payload(payload)
    return SessionEvent(
        event_id=event_id,
        role="tool",
        content=_tool_content(payload),
        tool_name=str(payload.get("name") or event_type),
        tool_result=tool_result,
        metadata={"provider": "codex", "codex_record_type": wrapper_type, "codex_event_type": event_type},
    )


def _event_msg_role(event_type: str, payload: dict[str, Any]) -> str:
    if payload.get("role"):
        return str(payload["role"])
    if event_type in {"agent_message", "assistant_message"} or payload.get("last_agent_message") is not None:
        return "assistant"
    if event_type in {"user_message", "user"}:
        return "user"
    if event_type in {"exec_command", "tool_call", "tool_result", "function_call", "function_call_output"}:
        return "tool"
    if payload.get("message") is not None and event_type.endswith("_command"):
        return "tool"
    return "event"


def _tool_result_payload(payload: dict[str, Any]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key in ("arguments", "input", "output", "status", "call_id"):
        if key in payload:
            result[key] = payload[key]
    return result


def _tool_content(payload: dict[str, Any]) -> str:
    for key in ("output", "arguments", "input", "status"):
        if key in payload:
            return _string_content(payload[key])
    return ""


def _response_content(payload: dict[str, Any]) -> str:
    content = payload.get("content")
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text") or item.get("content") or item.get("message")
                if text is not None:
                    parts.append(_string_content(text))
        if parts:
            return "\n".join(parts)
    return _string_content(content or payload.get("text") or payload.get("message") or "")


def _string_content(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


class CodexSourceResolver:
    scanner_id = SCANNER_ID
    scanner_version = SCANNER_VERSION

    def resolve_event(self, locator: EventLocator) -> ResolvedEvent:
        if locator.scanner_id != SCANNER_ID or locator.scanner_version != SCANNER_VERSION:
            raise ValueError("unsupported codex locator version")
        if locator.locator_schema != SOURCE_LOCATOR_SCHEMA:
            raise ValueError("unsupported codex locator schema")
        source_path = Path(str(locator.payload.get("source_path") or ""))
        line_start = int(locator.payload.get("line_start") or 0)
        if line_start < 1:
            raise ValueError("locator line_start must be >= 1")
        record = _read_jsonl_record(source_path, line_start)
        event = _event_from_payload(line_start, record)
        if event is None:
            raise ValueError("locator does not point to a codex event")
        content_hash = _content_hash(event.content)
        return ResolvedEvent(
            scanner_id=SCANNER_ID,
            scanner_version=SCANNER_VERSION,
            session_id=str(locator.payload.get("session_id") or ""),
            event_id=str(locator.payload.get("event_id") or event.event_id),
            source_ref=str(source_path),
            content=event.content,
            content_hash=content_hash,
            metadata={"locator_schema": locator.locator_schema},
        )

    def verify_hash(self, resolved: ResolvedEvent, expected_hash: str) -> bool:
        return resolved.content_hash == expected_hash


def _with_locator(
    event: SessionEvent,
    *,
    record: dict[str, Any],
    source_path: Path,
    source_fingerprint: str,
    raw_line_index: int,
    event_index: int,
    session_id: str,
) -> SessionEvent:
    metadata = dict(event.metadata)
    content_hash = _content_hash(event.content)
    metadata.update(
        {
            "provider": "codex",
            "scanner_id": SCANNER_ID,
            "scanner_version": SCANNER_VERSION,
            "source_ref": str(source_path),
            "source_fingerprint": source_fingerprint,
            "content_hash": content_hash,
            "content_preview_redacted": _preview(event.content),
            "tool_result_hash": _content_hash(_string_content(event.tool_result or {})) if event.tool_result else "",
            "tool_result_preview_redacted": _preview(_string_content(event.tool_result or {})) if event.tool_result else "",
            "event_locator_json": _event_locator(
                record,
                source_path=source_path,
                raw_line_index=raw_line_index,
                session_id=session_id,
                event_id=event.event_id,
            ),
            "artifact_locator_json": _artifact_locator(
                session_id=session_id,
                event_id=event.event_id,
                event_index=event_index,
            ),
        }
    )
    return event.model_copy(update={"metadata": metadata})


def _event_locator(
    record: dict[str, Any],
    *,
    source_path: Path,
    raw_line_index: int,
    session_id: str,
    event_id: str,
) -> dict[str, Any]:
    payload = record.get("payload")
    payload_type = payload.get("type") if isinstance(payload, dict) else record.get("type")
    return {
        "schema_version": "locator.v0",
        "scanner_id": SCANNER_ID,
        "scanner_version": SCANNER_VERSION,
        "locator_schema": SOURCE_LOCATOR_SCHEMA,
        "kind": "source_event",
        "payload": {
            "source_path": str(source_path),
            "line_start": raw_line_index,
            "line_end": raw_line_index,
            "record_type": str(record.get("type") or "flat"),
            "payload_type": str(payload_type or ""),
            "session_id": session_id,
            "event_id": event_id,
        },
    }


def _artifact_locator(*, session_id: str, event_id: str, event_index: int) -> dict[str, Any]:
    return {
        "schema_version": "locator.v0",
        "scanner_id": SCANNER_ID,
        "scanner_version": SCANNER_VERSION,
        "locator_schema": ARTIFACT_LOCATOR_SCHEMA,
        "kind": "normalized_artifact_event",
        "payload": {
            "artifact_path": f".evozeus/sessions/{session_id}/events.jsonl",
            "line_start": event_index,
            "line_end": event_index,
            "session_id": session_id,
            "event_id": event_id,
        },
    }


def _source_metadata(path: Path) -> dict[str, str]:
    stat = path.stat()
    return {
        "scanner_id": SCANNER_ID,
        "scanner_version": SCANNER_VERSION,
        "source_ref": str(path),
        "source_size": str(stat.st_size),
        "source_mtime": str(stat.st_mtime_ns),
        "source_fingerprint": _source_fingerprint(path),
    }


def _source_fingerprint(path: Path) -> str:
    stat = path.stat()
    digest = hashlib.sha256()
    digest.update(str(path).encode("utf-8"))
    digest.update(str(stat.st_size).encode("utf-8"))
    digest.update(str(stat.st_mtime_ns).encode("utf-8"))
    with path.open("rb") as handle:
        digest.update(handle.read(64 * 1024))
        if stat.st_size > 64 * 1024:
            handle.seek(max(stat.st_size - 64 * 1024, 0))
            digest.update(handle.read(64 * 1024))
    return f"sha256:{digest.hexdigest()}"


def _content_hash(content: str) -> str:
    return f"sha256:{hashlib.sha256(content.encode('utf-8')).hexdigest()}"


def _preview(content: str, *, limit: int = 160) -> str:
    redacted = SECRET_RE.sub(lambda match: f"{match.group(1)}=[REDACTED]", content)
    return redacted[:limit]


def _read_jsonl_record(source_path: Path, line_number: int) -> dict[str, Any]:
    with source_path.open(encoding="utf-8") as handle:
        for index, line in enumerate(handle, start=1):
            if index == line_number:
                record = json.loads(line)
                if not isinstance(record, dict):
                    raise ValueError("codex source line is not a JSON object")
                return record
    raise ValueError("codex source line not found")


def _source_dirs(request: ScanRequest) -> list[Path]:
    if request.source_dir is not None:
        return [request.source_dir]
    return [
        Path.home() / ".codex" / "sessions",
        Path.home() / ".codex" / "archived_sessions",
    ]
