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
    assert refs[0].metadata["source_size"]
    assert refs[0].metadata["source_mtime"]
    assert refs[0].metadata["source_fingerprint"].startswith("sha256:")
    assert envelope.provider == "codex"
    assert [event.event_id for event in envelope.events] == ["u1", "t1"]
    assert envelope.events[1].tool_name == "exec_command"
    locator = envelope.events[0].metadata["event_locator_json"]
    artifact_locator = envelope.events[0].metadata["artifact_locator_json"]

    assert envelope.events[0].metadata["scanner_id"] == "codex"
    assert envelope.events[0].metadata["scanner_version"] == "0.1.0"
    assert locator["schema_version"] == "locator.v0"
    assert locator["scanner_id"] == "codex"
    assert locator["scanner_version"] == "0.1.0"
    assert locator["locator_schema"] == "locator.codex_jsonl.v0"
    assert locator["kind"] == "source_event"
    assert locator["payload"]["source_path"] == str(session_path)
    assert locator["payload"]["line_start"] == 1
    assert locator["payload"]["line_end"] == 1
    assert artifact_locator["locator_schema"] == "locator.evozeus_artifact_jsonl.v0"
    assert envelope.events[0].metadata["content_hash"].startswith("sha256:")
    assert envelope.events[0].metadata["content_preview_redacted"] == "请修复测试"


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

    assert refs[0].session_id == "archive-session"
    assert envelope.session_id == "archive-session"
    assert [event.role for event in envelope.events] == ["user", "tool"]
    assert envelope.events[1].tool_name == "exec_command"
    assert envelope.events[1].tool_result == {"message": "command failed"}


def test_codex_scanner_redacts_secret_like_values_from_preview(tmp_path: Path):
    session_path = tmp_path / "session-secret.jsonl"
    session_path.write_text(
        json.dumps({"id": "u1", "role": "user", "content": "token=abc123 请调试"}, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    scanner = CodexScanner()
    ref = scanner.discover(ScanRequest(provider="codex", source_dir=tmp_path))[0]
    envelope = scanner.load(ref)

    assert envelope.events[0].content == "token=abc123 请调试"
    assert envelope.events[0].metadata["content_preview_redacted"] == "token=[REDACTED] 请调试"


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


def test_codex_scanner_bridges_source_id_manifest_to_local_codex_source(tmp_path: Path, monkeypatch):
    source_id = "rollout-test-bridge"
    session_id = "bridge-session"
    fake_home = tmp_path / "home"
    codex_source = fake_home / ".codex" / "sessions" / "2026" / "06" / "17" / f"{source_id}.jsonl"
    codex_source.parent.mkdir(parents=True)
    codex_source.write_text(
        "\n".join(
            [
                json.dumps({"type": "session_meta", "payload": {"id": session_id}}),
                json.dumps({"type": "response_item", "payload": {"id": "u1", "role": "user", "content": "桥接扫描"}}),
                json.dumps({"type": "response_item", "payload": {"id": "a1", "role": "assistant", "content": "已读取原始 source"}}),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    source_dir = tmp_path / "testdata"
    source_dir.mkdir()
    (source_dir / "codex-source-ids.jsonl").write_text(json.dumps({"source_id": source_id}) + "\n", encoding="utf-8")
    monkeypatch.setenv("HOME", str(fake_home))

    scanner = CodexScanner()
    refs = scanner.discover(ScanRequest(provider="codex", source_dir=source_dir))
    envelope = scanner.load(refs[0])

    assert len(refs) == 1
    assert refs[0].session_id == session_id
    assert refs[0].source_path == codex_source
    assert refs[0].metadata["bridge_source_id"] == source_id
    assert refs[0].metadata["bridge_manifest"] == str(source_dir / "codex-source-ids.jsonl")
    assert envelope.session_id == session_id
    assert [event.content for event in envelope.events] == ["桥接扫描", "已读取原始 source"]
    assert envelope.events[0].metadata["event_locator_json"]["payload"]["source_path"] == str(codex_source)
