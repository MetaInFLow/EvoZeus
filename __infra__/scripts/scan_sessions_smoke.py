from __future__ import annotations

import tempfile
from pathlib import Path

from evozeus.scanners.base import ScanRequest
from evozeus.scanners.providers.codex import CodexScanner
from smoke_support import write_sample_codex_session


def main() -> None:
    with tempfile.TemporaryDirectory() as tmp:
        source_dir = Path(tmp)
        write_sample_codex_session(source_dir)
        scanner = CodexScanner()
        refs = scanner.discover(ScanRequest(provider="codex", source_dir=source_dir))
        assert refs, "expected at least one scanned session"
        envelope = scanner.load(refs[0])
        roles = {event.role for event in envelope.events}
        has_tool_result = any(event.tool_result for event in envelope.events)
        assert envelope.session_id
        assert envelope.provider == "codex"
        assert envelope.source_ref
        assert len(envelope.events) >= 3
        assert {"user", "assistant", "tool"} <= roles
        assert has_tool_result
        print(
            f"scan sessions ok: sessions={len(refs)} events={len(envelope.events)} "
            f"has_tool_result={has_tool_result}"
        )


if __name__ == "__main__":
    main()
