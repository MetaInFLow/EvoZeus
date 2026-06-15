import json
from pathlib import Path

from evozeus.scanners.base import ScanRequest
from evozeus.scanners.providers.codex import CodexScanner


def test_codex_scanner_loads_jsonl_session_events(tmp_path: Path):
    session_path = tmp_path / "session-a.jsonl"
    session_path.write_text(
        "\n".join(
            [
                json.dumps({"id": "u1", "role": "user", "content": "请修复测试"}),
                json.dumps(
                    {
                        "id": "t1",
                        "role": "tool",
                        "tool_name": "exec_command",
                        "tool_result": {"stderr": "timeout"},
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    scanner = CodexScanner()
    refs = scanner.discover(ScanRequest(provider="codex", source_dir=tmp_path))
    envelope = scanner.load(refs[0])

    assert refs[0].session_id == "session-a"
    assert envelope.provider == "codex"
    assert [event.event_id for event in envelope.events] == ["u1", "t1"]
    assert envelope.events[1].tool_name == "exec_command"


def test_codex_scanner_loads_archived_payload_shape(tmp_path: Path):
    session_path = tmp_path / "session-archive.jsonl"
    session_path.write_text(
        "\n".join(
            [
                json.dumps({"type": "session_meta", "payload": {"id": "archive-session", "cwd": "/redacted"}}),
                json.dumps({"type": "response_item", "payload": {"role": "user", "content": "这个扫描结果不对"}}),
                json.dumps({"type": "event_msg", "payload": {"type": "exec_command", "message": "command failed"}}),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    scanner = CodexScanner()
    refs = scanner.discover(ScanRequest(provider="codex", source_dir=tmp_path))
    envelope = scanner.load(refs[0])

    assert envelope.session_id == "archive-session"
    assert [event.role for event in envelope.events] == ["user", "tool"]
    assert envelope.events[1].tool_name == "exec_command"
    assert envelope.events[1].tool_result == {"message": "command failed"}


def test_codex_scanner_normalizes_archived_response_item_tools(tmp_path: Path):
    session_path = tmp_path / "session-tools.jsonl"
    session_path.write_text(
        "\n".join(
            [
                json.dumps({"type": "session_meta", "payload": {"id": "tool-session"}}),
                json.dumps(
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "function_call",
                            "name": "exec_command",
                            "call_id": "call-1",
                            "arguments": "{\"cmd\":\"pytest\"}",
                        },
                    }
                ),
                json.dumps(
                    {
                        "type": "response_item",
                        "payload": {
                            "type": "function_call_output",
                            "call_id": "call-1",
                            "output": "pytest failed with timeout",
                        },
                    }
                ),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    scanner = CodexScanner()
    refs = scanner.discover(ScanRequest(provider="codex", source_dir=tmp_path))
    envelope = scanner.load(refs[0])

    assert [event.role for event in envelope.events] == ["tool", "tool"]
    assert envelope.events[0].tool_name == "exec_command"
    assert envelope.events[0].tool_result == {"arguments": "{\"cmd\":\"pytest\"}", "call_id": "call-1"}
    assert envelope.events[1].tool_name == "function_call_output"
    assert envelope.events[1].tool_result == {"output": "pytest failed with timeout", "call_id": "call-1"}
