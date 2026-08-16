from __future__ import annotations

import json
import re
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any


LESSON_CANDIDATE_API = "evozeus.session-signal.lesson-candidate.v1"
USER_PROMPT_EVENT = "UserPromptSubmit"
MAX_REQUEST_BYTES = 256 * 1024
MAX_PROMPT_CHARS = 32_000
MAX_TARGETS = 256
MAX_ALIASES_PER_TARGET = 32
MAX_ALIAS_CHARS = 128
MAX_CORRECTION_REQUIREMENTS_CHARS = 12_000
MAX_GUIDANCE_CHARS = 4_096
_REPO_PATTERN = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def _valid_target(value: object) -> dict[str, object] | None:
    if not isinstance(value, Mapping):
        return None
    repo = value.get("repo")
    canonical_path = value.get("canonical_path")
    aliases = value.get("aliases", [])
    requirements = value.get("correction_requirements")
    if (
        not isinstance(repo, str)
        or not _REPO_PATTERN.fullmatch(repo)
        or not isinstance(canonical_path, str)
        or not Path(canonical_path).is_absolute()
        or not isinstance(aliases, Sequence)
        or isinstance(aliases, (str, bytes))
        or len(aliases) > MAX_ALIASES_PER_TARGET
        or not all(isinstance(alias, str) and alias.strip() for alias in aliases)
        or not all(len(alias) <= MAX_ALIAS_CHARS for alias in aliases)
        or (
            requirements is not None
            and (
                not isinstance(requirements, str)
                or len(requirements) > MAX_CORRECTION_REQUIREMENTS_CHARS
            )
        )
    ):
        return None
    return {
        "repo": repo,
        "canonical_path": str(Path(canonical_path).resolve(strict=False)),
        "aliases": tuple(dict.fromkeys([repo, *aliases])),
        "correction_requirements": requirements if isinstance(requirements, str) else "",
    }


def _contains(parent: str, child: str) -> bool:
    try:
        return Path(child).resolve(strict=False).is_relative_to(Path(parent).resolve(strict=False))
    except (OSError, RuntimeError, ValueError):
        return False


def _alias_is_mentioned(prompt: str, alias: str) -> bool:
    lowered = prompt.casefold()
    normalized = alias.casefold().strip()
    if not normalized:
        return False
    if re.search(r"[\u3400-\u9fff]", normalized):
        return normalized in lowered
    return re.search(
        rf"(?<![a-z0-9_-]){re.escape(normalized)}(?![a-z0-9_-])",
        lowered,
    ) is not None


def select_lesson_target(
    *,
    cwd: str | None,
    prompt: str,
    targets: Sequence[object],
) -> str | None:
    """Select a registered target using filesystem containment or one alias."""
    valid_targets = [target for value in targets if (target := _valid_target(value))]
    if isinstance(cwd, str) and Path(cwd).is_absolute():
        resolved_cwd = str(Path(cwd).resolve(strict=False))
        containing = [
            target
            for target in valid_targets
            if _contains(str(target["canonical_path"]), resolved_cwd)
        ]
        if containing:
            containing.sort(
                key=lambda target: len(Path(str(target["canonical_path"])).parts),
                reverse=True,
            )
            return str(containing[0]["repo"])

    mentioned = {
        str(target["repo"])
        for target in valid_targets
        if any(_alias_is_mentioned(prompt, alias) for alias in target["aliases"])
    }
    return next(iter(mentioned)) if len(mentioned) == 1 else None


def _requirements_for_target(
    targets: Sequence[object],
    target_repo: str | None,
) -> str:
    valid_targets = [target for value in targets if (target := _valid_target(value))]
    if target_repo:
        for target in valid_targets:
            if target["repo"] == target_repo:
                return str(target["correction_requirements"])
        return ""

    requirements = list(
        dict.fromkeys(
            str(target["correction_requirements"])
            for target in valid_targets
            if str(target["correction_requirements"]).strip()
        )
    )
    if len(requirements) == 1:
        return requirements[0]
    return ""


def model_guidance(target_repo: str | None, correction_requirements: str) -> str:
    """Build model-only guidance from the registered Skill's written rule."""
    requirements = correction_requirements.strip()
    if not requirements:
        raise ValueError("missing Skill correction requirements")
    if target_repo:
        action = f"如确认记录，使用目标 Skill `{target_repo}`；本次只记录，不启动修复。"
        route = f"目标归属已由可信运行信息确定为 `{target_repo}`。"
    else:
        action = "如确认记录，先询问并确认目标 Skill；本次只记录，不启动修复。"
        route = "目标归属未唯一确定，禁止猜测。"
    guidance = "\n".join(
        [
            "EvoZeus model-only guidance：以下 Skill 纠偏要求是本轮 Lesson 判断的唯一业务依据；禁止使用固定关键词、正则或词面命中代替语义判断。",
            "逐条理解当前用户消息，并判断它是否满足这份要求；如果模型判断信息对未来运行具有复用价值，即使用户没有明确说“记住”，也按候选处理。若不满足，正常完成当前任务，不展示 Lesson。若满足，立即暂停原业务流程，在下一次实质性工具调用前追加一条脱敏、可行动、可复用的 Lesson 提示；不要读取业务数据、继续任务或开始修复。",
            "提示格式：💡 `EvoZeus · Lesson` 待记录；捕捉到一条可复用 Lesson：<一句话摘要>。要先记录为 Issue 吗？",
            action,
            route,
            "禁止展示内部 JSON、signal ID、capture state、route、诊断字段、Hook 输出或本地路径。未获得明确确认前不得创建 Issue、继续原业务任务、修改 Skill 或启动修复；记录授权与修复授权分别确认。",
            "--- Skill correction requirements ---",
            requirements,
            "--- End Skill correction requirements ---",
        ]
    )
    if len(guidance) > MAX_GUIDANCE_CHARS:
        raise ValueError("Skill correction requirements exceed guidance limit")
    return guidance


def evaluate_lesson_candidate(request: Mapping[str, Any]) -> dict[str, Any]:
    """Route every prompt through the Skill-authored rule without persistence."""
    if request.get("schema_version") != LESSON_CANDIDATE_API:
        raise ValueError("unsupported lesson-candidate API")
    if request.get("event_name") != USER_PROMPT_EVENT:
        raise ValueError("unsupported lesson-candidate event")
    prompt = request.get("prompt")
    targets = request.get("targets")
    if (
        "targets" not in request
        or not isinstance(prompt, str)
        or not isinstance(targets, Sequence)
        or isinstance(targets, (str, bytes))
    ):
        raise ValueError("invalid lesson-candidate request")
    if len(prompt) > MAX_PROMPT_CHARS or len(targets) > MAX_TARGETS:
        raise ValueError("lesson-candidate request exceeds its item limits")
    if any(_valid_target(target) is None for target in targets):
        raise ValueError("invalid lesson-candidate target inventory")
    target_repo = select_lesson_target(
        cwd=request.get("cwd") if isinstance(request.get("cwd"), str) else None,
        prompt=prompt,
        targets=targets,
    )
    requirements = _requirements_for_target(targets, target_repo)
    if not requirements:
        return {"schema_version": LESSON_CANDIDATE_API, "candidate": False}
    return {
        "schema_version": LESSON_CANDIDATE_API,
        "candidate": True,
        "target_repo": target_repo,
        "model_guidance": model_guidance(target_repo, requirements),
    }


def main() -> int:
    try:
        raw = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        if len(raw) > MAX_REQUEST_BYTES:
            raise ValueError("lesson-candidate request exceeds its size limit")
        request = json.loads(raw.decode("utf-8"))
        if not isinstance(request, Mapping):
            raise ValueError("lesson-candidate request must be an object")
        response = evaluate_lesson_candidate(request)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        print("invalid lesson-candidate request", file=sys.stderr)
        return 2
    print(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
