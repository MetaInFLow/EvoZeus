from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys

import pytest


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from evozeus_session_signal_skill.lesson_candidate import (  # noqa: E402
    LESSON_CANDIDATE_API,
    MAX_CORRECTION_REQUIREMENTS_CHARS,
    MAX_PROMPT_CHARS,
    MAX_TARGETS,
    USER_PROMPT_EVENT,
    evaluate_lesson_candidate,
    select_lesson_target,
)


RULE = """# Feedback Audit Rule

Capture reusable correction or improvement feedback only after the business correction is complete.
Ask for explicit confirmation before recording. Never persist before confirmation.
"""


def target(
    repo: str = "MetaInFLow/example-skill",
    canonical_path: str = "/verified/example-skill",
    aliases: list[str] | None = None,
    requirements: str = RULE,
) -> dict[str, object]:
    return {
        "repo": repo,
        "canonical_path": canonical_path,
        "aliases": aliases or ["example-skill"],
        "correction_requirements": requirements,
    }


def request(
    prompt: str,
    targets: list[dict[str, object]] | None = None,
    *,
    cwd: str | None = None,
) -> dict[str, object]:
    payload = {
        "schema_version": LESSON_CANDIDATE_API,
        "event_name": USER_PROMPT_EVENT,
        "prompt": prompt,
        "targets": targets if targets is not None else [target()],
    }
    if cwd is not None:
        payload["cwd"] = cwd
    return payload


def test_written_skill_rule_drives_all_prompt_words() -> None:
    neutral = evaluate_lesson_candidate(request("请总结这份报告。", cwd="/verified/example-skill"))
    correction = evaluate_lesson_candidate(request("这个结果完全不符合我的预期。", cwd="/verified/example-skill"))

    assert neutral["candidate"] is True
    assert correction["candidate"] is True
    assert neutral["target_repo"] == correction["target_repo"] == "MetaInFLow/example-skill"
    assert RULE in neutral["model_guidance"]
    assert "固定关键词" in neutral["model_guidance"]


def test_missing_written_rule_stays_fail_open() -> None:
    result = evaluate_lesson_candidate(request("这条反馈使用了完全新的表达。", [target(requirements="")]))

    assert result == {"schema_version": LESSON_CANDIDATE_API, "candidate": False}


def test_target_rule_is_selected_by_cwd_before_alias() -> None:
    targets = [
        target("MetaInFLow/parent", "/verified", ["parent"], "parent rule"),
        target("MetaInFLow/child", "/verified/child", ["child"], "child rule"),
    ]

    assert select_lesson_target(
        cwd="/verified/child/work",
        prompt="parent",
        targets=targets,
    ) == "MetaInFLow/child"
    result = evaluate_lesson_candidate(request("parent", targets, cwd="/verified/child/work"))
    assert result["target_repo"] == "MetaInFLow/child"
    assert result["model_guidance"].endswith("child rule\n--- End Skill correction requirements ---")


def test_unique_alias_routes_without_keyword_signal() -> None:
    result = evaluate_lesson_candidate(
        request("请运行 example-skill 的正常任务。", [target()])
    )

    assert result["candidate"] is True
    assert result["target_repo"] == "MetaInFLow/example-skill"


def test_ambiguous_alias_keeps_target_unassigned_and_requires_shared_rule() -> None:
    targets = [
        target("MetaInFLow/first", "/verified/first", ["shared"], RULE),
        target("MetaInFLow/second", "/verified/second", ["shared"], RULE),
    ]

    result = evaluate_lesson_candidate(request("shared", targets))

    assert result["candidate"] is True
    assert result["target_repo"] is None
    assert "目标归属未唯一确定" in result["model_guidance"]
    assert "要提到哪个项目的问题列表？" in result["model_guidance"]
    assert "不写本地记录" in result["model_guidance"]


def test_different_unassigned_rules_do_not_allow_guessing() -> None:
    result = evaluate_lesson_candidate(
        request(
            "普通请求",
            [
                target("MetaInFLow/first", "/verified/first", ["first"], "first rule"),
                target("MetaInFLow/second", "/verified/second", ["second"], "second rule"),
            ],
        )
    )

    assert result == {"schema_version": LESSON_CANDIDATE_API, "candidate": False}


def test_prompt_and_private_paths_are_not_echoed() -> None:
    private_prompt = "PRIVATE-USER-FEEDBACK"
    private_path = "/Users/private/customer-repo"
    result = evaluate_lesson_candidate(
        request(
            private_prompt,
            [target(canonical_path=private_path)],
        )
    )

    serialized = json.dumps(result, ensure_ascii=False)
    assert private_prompt not in serialized
    assert private_path not in serialized


def test_api_rejects_invalid_event_and_bounds() -> None:
    with pytest.raises(ValueError, match="event"):
        evaluate_lesson_candidate({**request("x"), "event_name": "SessionStart"})
    with pytest.raises(ValueError):
        evaluate_lesson_candidate(request("x" * (MAX_PROMPT_CHARS + 1)))
    with pytest.raises(ValueError):
        evaluate_lesson_candidate(request("x", [target(requirements="x" * (MAX_CORRECTION_REQUIREMENTS_CHARS + 1))]))
    with pytest.raises(ValueError):
        evaluate_lesson_candidate(
            {
                **request("x"),
                "targets": [target(repo=f"MetaInFLow/repo-{index}") for index in range(MAX_TARGETS + 1)],
            }
        )


def test_cli_uses_stdin_stdout_and_does_not_write_runtime_files(tmp_path: Path) -> None:
    payload = request("这次使用了不同的反馈表达。")
    before = sorted(path.relative_to(tmp_path).as_posix() for path in tmp_path.rglob("*"))
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/evaluate_lesson_candidate.py")],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=tmp_path,
        env={"PYTHONDONTWRITEBYTECODE": "1"},
        check=False,
    )
    after = sorted(path.relative_to(tmp_path).as_posix() for path in tmp_path.rglob("*"))

    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["candidate"] is True
    assert before == after


def test_source_contains_no_prompt_keyword_detector() -> None:
    source = (ROOT / "src/evozeus_session_signal_skill/lesson_candidate.py").read_text(
        encoding="utf-8"
    )

    assert "DIRECT_CORRECTION_PATTERNS" not in source
    assert "DURABLE_RULE_PATTERNS" not in source
    assert "def is_lesson_candidate" not in source
