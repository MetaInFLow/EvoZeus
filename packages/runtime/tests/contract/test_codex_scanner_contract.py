import inspect
import json
from pathlib import Path
from unittest.mock import patch

from evozeus_runtime.scanners.base import ScanRequest, SessionScanner
from evozeus_runtime.scanners.providers.codex import CodexScanner


def _write_jsonl(path: Path, records: list[dict]) -> None:
    path.write_text("\n".join(json.dumps(record, ensure_ascii=False) for record in records), encoding="utf-8")


def test_codex_scanner_implements_scanner_abstract_class():
    assert inspect.isabstract(SessionScanner)
    assert issubclass(CodexScanner, SessionScanner)


def test_codex_scanner_discovers_and_loads_fixture_sessions():
    scanner = CodexScanner()
    source = Path("tests/fixtures/codex_sessions")

    refs = scanner.discover(ScanRequest(provider="codex", source_dir=source))

    assert [ref.session_id for ref in refs] == ["session-minimal"]
    envelope = scanner.load(refs[0])
    assert envelope.provider == "codex"
    assert envelope.session_id == "session-minimal"
    assert envelope.events
    assert envelope.metadata["scanner_id"] == "codex"
    assert envelope.metadata["scanner_version"] == "0.1.0"
    assert envelope.events[0].metadata["event_locator_json"]["kind"] == "source_event"


def test_codex_scanner_discovers_session_meta_after_large_initial_record(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-oversized-prefix.jsonl"
    large_prefix = "x" * 150_000
    session_file.write_text(
        "\n".join(
            [
                '{"payload":{"base_instructions":{"text":"' + large_prefix + '"}}}',
                '{"type":"session_meta","payload":{"id":"embedded-session","cwd":"/tmp/project"}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"text":"run it"}]}}',
            ]
        ),
        encoding="utf-8",
    )
    scanner = CodexScanner()

    refs = scanner.discover(ScanRequest(provider="codex", source_dir=source))
    envelope = scanner.load(refs[0])

    assert refs[0].session_id == "embedded-session"
    assert envelope.session_id == "embedded-session"
    assert refs[0].metadata["session_cwd"] == "/tmp/project"


def test_codex_scanner_keeps_first_session_meta_when_rollout_contains_parent_meta(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-subagent.jsonl"
    session_file.write_text(
        "\n".join(
            [
                '{"type":"session_meta","payload":{"id":"subagent-session","cwd":"/tmp/subagent"}}',
                '{"type":"session_meta","payload":{"id":"parent-session","cwd":"/tmp/parent"}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"text":"run it"}]}}',
            ]
        ),
        encoding="utf-8",
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)
    message_refs = scanner.discover_message_refs(ref)

    assert ref.session_id == "subagent-session"
    assert envelope.session_id == "subagent-session"
    assert [message_ref.session_id for message_ref in message_refs] == ["subagent-session"]
    assert envelope.events[0].metadata["event_locator_json"]["payload"]["session_id"] == "subagent-session"


def test_codex_scanner_loads_events_progressively_without_read_text():
    scanner = CodexScanner()
    source = Path("tests/fixtures/codex_sessions")
    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]

    with patch.object(Path, "read_text", side_effect=AssertionError("load must stream lines")):
        event_iterator = scanner.iter_events(ref)
        assert inspect.isgenerator(event_iterator)
        assert next(event_iterator).event_id == "event_0002"
        envelope = scanner.load(ref)

    assert [event.event_id for event in envelope.events] == ["event_0002", "event_0003", "event_0004"]


def test_codex_scanner_discovers_message_ids_without_message_content():
    scanner = CodexScanner()
    source = Path("tests/fixtures/codex_sessions")
    session_ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]

    with patch.object(Path, "read_text", side_effect=AssertionError("message refs must stream lines")):
        message_refs = scanner.discover_message_refs(session_ref)

    assert [message_ref.message_id for message_ref in message_refs] == ["event_0002", "event_0004"]
    assert [message_ref.metadata["role"] for message_ref in message_refs] == ["user", "task_complete"]
    assert [message_ref.metadata["tool_name"] for message_ref in message_refs] == ["", ""]
    assert [message_ref.metadata["payload_type"] for message_ref in message_refs] == [
        "message",
        "task_complete",
    ]
    assert all("content_preview_redacted" not in message_ref.metadata for message_ref in message_refs)
    assert all("tool_result_preview_redacted" not in message_ref.metadata for message_ref in message_refs)


def test_codex_scanner_declares_default_local_session_dirs(monkeypatch, tmp_path):
    monkeypatch.setenv("HOME", str(tmp_path))
    scanner = CodexScanner()

    source_dirs = scanner.source_dirs(ScanRequest(provider="codex"))

    assert source_dirs == [
        tmp_path / ".codex" / "sessions",
        tmp_path / ".codex" / "archived_sessions",
    ]


def test_codex_scanner_keeps_bridge_ids_inside_an_explicit_source_dir(monkeypatch, tmp_path):
    home = tmp_path / "home"
    default_source = home / ".codex" / "sessions"
    default_source.mkdir(parents=True)
    (default_source / "outside-session.jsonl").write_text(
        '{"type":"session_meta","payload":{"id":"outside-session","cwd":"/tmp/outside"}}\n',
        encoding="utf-8",
    )
    approved_source = tmp_path / "approved"
    approved_source.mkdir()
    (approved_source / ".codex-source-ids.jsonl").write_text(
        '{"source_id":"outside-session"}\n',
        encoding="utf-8",
    )
    monkeypatch.setenv("HOME", str(home))

    refs = CodexScanner().discover(ScanRequest(provider="codex", source_dir=approved_source))

    assert refs == []


def test_codex_scanner_skips_malformed_jsonl_lines(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-broken.jsonl"
    session_file.write_text(
        "\n".join(
            [
                '{"type":"session_meta","payload":{"id":"broken-session"}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"text":"truncated',
                '{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"text":"still readable"}]}}',
            ]
        ),
        encoding="utf-8",
    )
    scanner = CodexScanner()

    refs = scanner.discover(ScanRequest(provider="codex", source_dir=source))
    envelope = scanner.load(refs[0])

    assert envelope.session_id == "broken-session"
    assert [event.content for event in envelope.events] == ["still readable"]
    assert envelope.metadata["malformed_jsonl_line_count"] == "1"


def test_codex_scanner_normalizes_factor_channels_for_codex_noise(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-normalized.jsonl"
    session_file.write_text(
        "\n".join(
            [
                '{"type":"session_meta","payload":{"id":"normalized-session"}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"text":"# AGENTS.md instructions\\n<INSTRUCTIONS>中文输出</INSTRUCTIONS>"}]}}',
                '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"text":"# Files mentioned by the user:\\n\\n## My request for Codex:\\n检查下为什么失败了"}]}}',
                '{"type":"response_item","payload":{"type":"message","role":"assistant","content":[{"text":"我会检查日志。"}]}}',
                '{"type":"response_item","payload":{"type":"function_call","name":"exec_command","arguments":"{\\"cmd\\":\\"pytest\\"}"}}',
                '{"type":"response_item","payload":{"type":"function_call_output","name":"exec_command","output":"{\\"exit_code\\":1,\\"stderr\\":\\"failed\\"}"}}',
                '{"type":"event_msg","payload":{"type":"task_complete","duration_ms":42}}',
            ]
        ),
        encoding="utf-8",
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)

    channels = [(event.role, event.metadata["content_kind"], event.metadata["factor_channel"]) for event in envelope.events]
    assert channels == [
        ("user", "codex_context", "context"),
        ("user", "real_user_message", "user_input"),
        ("assistant", "assistant_message", "assistant_result"),
        ("tool", "tool_call", "tool_usage"),
        ("tool", "tool_output", "tool_result"),
        ("task_complete", "task_complete", "assistant_result"),
    ]
    assert envelope.events[0].metadata["chat_role"] == "context"
    assert envelope.events[1].metadata["raw_role"] == "user"
    assert envelope.events[1].metadata["chat_role"] == "user"
    assert envelope.events[1].metadata["message_scope"] == "context_wrapper"
    assert envelope.events[1].metadata["factor_text_preview"] == "检查下为什么失败了"


def test_codex_scanner_marks_subagent_session_scope_from_thread_source(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-subagent-thread-source.jsonl"
    _write_jsonl(
        session_file,
        [
            {
                "type": "session_meta",
                "payload": {
                    "id": "subagent-thread-source-session",
                    "thread_source": "subagent",
                    "source": {
                        "subagent": {
                            "thread_spawn": {
                                "agent_nickname": "Meitner",
                                "agent_role": "explorer",
                                "depth": 1,
                                "parent_thread_id": "parent-thread",
                            }
                        }
                    },
                },
            },
            {
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"text": "看看报告里的 INTJ 证据是否可靠"}],
                },
            },
            {
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"text": "列一下高频句和判断依据"}],
                },
            },
        ],
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)
    message_refs = scanner.discover_message_refs(ref)

    assert envelope.metadata["session_thread_source"] == "subagent"
    assert envelope.metadata["session_source_kind"] == "subagent"
    assert envelope.metadata["subagent_parent_thread_id"] == "parent-thread"
    assert envelope.metadata["subagent_agent_nickname"] == "Meitner"
    assert envelope.metadata["subagent_agent_role"] == "explorer"
    assert envelope.metadata["subagent_depth"] == "1"
    assert [event.metadata["message_scope"] for event in envelope.events] == ["delegated_task", "delegated_task"]
    assert [event.metadata["factor_channel"] for event in envelope.events] == ["user_input", "user_input"]
    assert envelope.events[0].metadata["session_thread_source"] == "subagent"
    assert envelope.events[0].metadata["subagent_parent_thread_id"] == "parent-thread"
    assert [message_ref.metadata["message_scope"] for message_ref in message_refs] == ["delegated_task", "delegated_task"]


def test_codex_scanner_marks_legacy_subagent_session_scope_from_thread_spawn(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-legacy-subagent-thread-spawn.jsonl"
    _write_jsonl(
        session_file,
        [
            {
                "type": "session_meta",
                "payload": {
                    "id": "legacy-subagent-session",
                    "forked_from_id": "legacy-parent-thread",
                    "agent_nickname": "Ampere",
                    "agent_role": "worker",
                    "source": {
                        "subagent": {
                            "thread_spawn": {
                                "agent_nickname": "Ampere",
                                "agent_role": "worker",
                                "depth": 1,
                                "parent_thread_id": "legacy-parent-thread",
                            }
                        }
                    },
                },
            },
            {
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"text": "这个交付物缺少什么验收标准"}],
                },
            },
        ],
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)
    message_refs = scanner.discover_message_refs(ref)

    assert envelope.metadata["session_thread_source"] == "subagent"
    assert envelope.metadata["session_source_kind"] == "subagent"
    assert envelope.metadata["subagent_parent_thread_id"] == "legacy-parent-thread"
    assert envelope.metadata["subagent_agent_nickname"] == "Ampere"
    assert envelope.events[0].metadata["message_scope"] == "delegated_task"
    assert message_refs[0].metadata["message_scope"] == "delegated_task"


def test_codex_scanner_marks_automation_session_scope_from_thread_source(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-automation-thread-source.jsonl"
    _write_jsonl(
        session_file,
        [
            {
                "type": "session_meta",
                "payload": {
                    "id": "automation-session",
                    "thread_source": "automation",
                    "source": "vscode",
                },
            },
            {
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"text": "生成今天的项目日报"}],
                },
            },
        ],
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)
    message_refs = scanner.discover_message_refs(ref)

    assert envelope.metadata["session_thread_source"] == "automation"
    assert envelope.events[0].metadata["message_scope"] == "automation"
    assert message_refs[0].metadata["message_scope"] == "automation"


def test_codex_scanner_keeps_user_session_scope_direct_for_normal_text(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-user-thread-source.jsonl"
    _write_jsonl(
        session_file,
        [
            {
                "type": "session_meta",
                "payload": {
                    "id": "user-thread-source-session",
                    "thread_source": "user",
                    "source": "vscode",
                },
            },
            {
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"text": "看看报告里的 INTJ 证据是否可靠"}],
                },
            },
            {
                "type": "event_msg",
                "payload": {
                    "type": "user_message",
                    "message": "看看报告里的 INTJ 证据是否可靠",
                },
            },
        ],
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)
    message_refs = scanner.discover_message_refs(ref)

    assert envelope.metadata["session_thread_source"] == "user"
    assert len(envelope.events) == 1
    assert envelope.events[0].metadata["message_scope"] == "direct_user"
    assert envelope.events[0].metadata["codex_user_origin"] == "event_msg_mirror"
    assert message_refs[0].metadata["message_scope"] == "direct_user"


def test_codex_scanner_marks_unmirrored_new_user_response_item_as_context(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-user-synthetic-context.jsonl"
    _write_jsonl(
        session_file,
        [
            {
                "type": "session_meta",
                "payload": {
                    "id": "user-synthetic-context-session",
                    "thread_source": "user",
                    "source": "vscode",
                },
            },
            {
                "type": "response_item",
                "payload": {
                    "type": "message",
                    "role": "user",
                    "content": [{"text": "<skill><name>product-design:index</name><path>/tmp/SKILL.md</path></skill>"}],
                },
            },
        ],
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)
    message_refs = scanner.discover_message_refs(ref)

    assert envelope.events[0].metadata["codex_user_origin"] == "synthetic_context"
    assert envelope.events[0].metadata["factor_channel"] == "context"
    assert envelope.events[0].metadata["message_scope"] == "context_wrapper"
    assert message_refs == []


def test_codex_scanner_marks_delegated_task_prompt_scope_as_legacy_fallback(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-delegated-task.jsonl"
    session_file.write_text(
        "\n".join(
            json.dumps(record, ensure_ascii=False)
            for record in [
                {"type": "session_meta", "payload": {"id": "delegated-task-session"}},
                {
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "user",
                        "content": [{"text": "你是代码审查 agent。请只读检查仓库，不要修改文件。"}],
                    },
                },
                {
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "user",
                        "content": [{"text": "看看报告里的 INTJ 证据是否可靠"}],
                    },
                },
            ]
        ),
        encoding="utf-8",
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)
    message_refs = scanner.discover_message_refs(ref)

    assert [event.metadata["message_scope"] for event in envelope.events] == ["delegated_task", "direct_user"]
    assert [event.metadata["factor_channel"] for event in envelope.events] == ["user_input", "user_input"]
    assert [message_ref.metadata["message_scope"] for message_ref in message_refs] == ["delegated_task", "direct_user"]


def test_codex_scanner_dedupes_mirrored_user_message_with_image_block(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-mirrored-user.jsonl"
    request = (
        "# Files mentioned by the user:\\n\\n"
        "## codex-clipboard-demo.png: /var/folders/demo/codex-clipboard-demo.png\\n\\n"
        "## My request for Codex:\\n"
        "检查这个页面为什么错位\\n"
        '<image name=[Image #1] path="/var/folders/demo/codex-clipboard-demo.png"></image>'
    )
    session_file.write_text(
        "\n".join(
            json.dumps(record, ensure_ascii=False)
            for record in [
                {"type": "session_meta", "payload": {"id": "mirrored-user-session"}},
                {"type": "response_item", "payload": {"type": "message", "role": "user", "content": [{"text": request}]}},
                {"type": "event_msg", "payload": {"type": "user_message", "message": request}},
            ]
        ),
        encoding="utf-8",
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)

    assert len(envelope.events) == 1
    assert envelope.events[0].metadata["factor_text_preview"] == "检查这个页面为什么错位"


def test_codex_scanner_preserves_tool_name_in_function_call_output_payload(tmp_path):
    source = tmp_path / "codex_sessions"
    source.mkdir()
    session_file = source / "rollout-tool-name.jsonl"
    session_file.write_text(
        "\n".join(
            json.dumps(record, ensure_ascii=False)
            for record in [
                {"type": "session_meta", "payload": {"id": "tool-name-session"}},
                {
                    "type": "response_item",
                    "payload": {"type": "function_call_output", "name": "exec_command", "output": "Process exited with code 1"},
                },
            ]
        ),
        encoding="utf-8",
    )
    scanner = CodexScanner()

    ref = scanner.discover(ScanRequest(provider="codex", source_dir=source))[0]
    envelope = scanner.load(ref)

    assert envelope.events[0].tool_name == "exec_command"
    assert envelope.events[0].tool_result == {"name": "exec_command", "output": "Process exited with code 1"}
