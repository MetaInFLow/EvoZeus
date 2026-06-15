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
