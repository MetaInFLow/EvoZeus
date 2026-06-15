from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from evozeus.core.session import SessionEnvelope
from evozeus.models import SessionEvent
from evozeus.scanners.base import ScanRequest, SessionRef

TOOL_RESPONSE_ITEM_TYPES = {
    "function_call",
    "function_call_output",
    "custom_tool_call",
    "custom_tool_call_output",
    "web_search_call",
}


class CodexScanner:
    provider = "codex"

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
            SessionRef(provider=self.provider, session_id=path.stem, source_path=path)
            for path in paths
        ]

    def load(self, ref: SessionRef) -> SessionEnvelope:
        events: list[SessionEvent] = []
        session_id = ref.session_id
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
                events.append(event)

        return SessionEnvelope(
            session_id=session_id,
            provider=self.provider,
            source_ref=str(ref.source_path),
            events=events,
        )


def _session_id_from_record(record: dict[str, Any]) -> str | None:
    payload = record.get("payload")
    if record.get("type") == "session_meta" and isinstance(payload, dict) and payload.get("id"):
        return str(payload["id"])
    return None


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


def _source_dirs(request: ScanRequest) -> list[Path]:
    if request.source_dir is not None:
        return [request.source_dir]
    return [
        Path.home() / ".codex" / "sessions",
        Path.home() / ".codex" / "archived_sessions",
    ]
