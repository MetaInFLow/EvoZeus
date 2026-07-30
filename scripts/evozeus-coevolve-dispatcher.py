#!/usr/bin/env python3
"""Resolve the active EvoZeus channel before running the CoEvolve SessionStart hook."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


SCHEMA_VERSION = "evozeus.channel-coevolve-dispatcher.v2"
AUTO_UPDATE_TIMEOUT_SECONDS = 120


def _read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def _fallback(channel: str | None, message: str) -> dict:
    label = (channel or "unconfigured").upper()
    return {
        "continue": True,
        "systemMessage": f"[EvoZeus {label}] {message}",
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": (
                f"evozeus_dispatcher={SCHEMA_VERSION}; "
                f"evozeus_channel={channel or 'unconfigured'}; dispatcher_status=degraded"
            ),
        },
    }


def _run_auto_update(home: Path) -> list[str]:
    if os.environ.get("EVOZEUS_COEVOLVE_RUNTIME_CHILD") == "1":
        return []
    executable = home / "bin" / "evozeus"
    if not executable.is_file():
        return []
    environment = {**os.environ, "EVOZEUS_HOME": str(home), "EVOZEUS_SESSION_UPDATE_CHECK": "1"}
    try:
        result = subprocess.run(
            [str(executable), "version", "--json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=environment,
            timeout=AUTO_UPDATE_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ["🛡️ EvoZeus · 自动更新失败｜检查超时，当前会话继续使用已验证版本"]
    try:
        stderr = result.stderr.decode("utf-8")
    except UnicodeDecodeError:
        return []
    logs = [line.strip() for line in stderr.splitlines() if "EvoZeus ·" in line]
    if result.returncode != 0 and not logs:
        logs.append("🛡️ EvoZeus · 自动更新失败｜版本检查未完成，当前会话继续使用已验证版本")
    return logs


def main() -> int:
    home = Path(os.environ.get("EVOZEUS_HOME", Path.home() / ".evozeus")).expanduser().resolve()
    update_logs = _run_auto_update(home)
    active = _read_json(home / "active-channel.json")
    channel = active.get("channel") if active.get("channel") in {"stable", "uat"} else None
    state = _read_json(home / "channel-state.json")
    entry = state.get("channels", {}).get(channel, {}) if channel else {}
    coevolve_root = entry.get("component_roots", {}).get("coevolve") if isinstance(entry, dict) else None

    if not coevolve_root:
        legacy = _read_json(home / "hooks" / "state.json")
        candidate = legacy.get("wrapper_source")
        if isinstance(candidate, str) and candidate != "channel-managed":
            coevolve_root = candidate

    template = Path(coevolve_root).expanduser().resolve() / "templates/global/evozeus_wrapper_dispatcher.py" if coevolve_root else None
    if template is None or not template.is_file():
        payload = _fallback(channel, "CoEvolve hook source is unavailable; continuing without a freshness claim.")
        if update_logs:
            payload["systemMessage"] = "\n".join([*update_logs, payload["systemMessage"]])
            context = payload["hookSpecificOutput"]["additionalContext"]
            payload["hookSpecificOutput"]["additionalContext"] = f"{context}; evozeus_auto_update=reported"
        print(json.dumps(payload, ensure_ascii=False))
        return 0

    hook_input = sys.stdin.buffer.read()
    environment = {
        **os.environ,
        "EVOZEUS_HOME": str(home),
        **({"EVOZEUS_ACTIVE_CHANNEL": channel} if channel else {}),
        **({"EVOZEUS_RUNTIME_STATE_ROOT": str(home / "state" / channel)} if channel else {}),
    }
    result = subprocess.run(
        [sys.executable, str(template)],
        input=hook_input,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=environment,
        check=False,
    )
    try:
        payload = json.loads(result.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        payload = _fallback(channel, "CoEvolve hook returned an invalid response; continuing safely.")

    if not isinstance(payload, dict):
        payload = _fallback(channel, "CoEvolve hook returned an invalid response; continuing safely.")
    label = (channel or "unconfigured").upper()
    coevolve_message = f"[EvoZeus {label}] {payload.get('systemMessage', 'CoEvolve hook evaluated.')}"
    payload["systemMessage"] = "\n".join([*update_logs, coevolve_message])
    hook_output = payload.setdefault("hookSpecificOutput", {})
    context = str(hook_output.get("additionalContext", "")).strip()
    update_status = "reported" if update_logs else "quiet"
    prefix = (
        f"evozeus_dispatcher={SCHEMA_VERSION}; "
        f"evozeus_channel={channel or 'unconfigured'}; "
        f"evozeus_auto_update={update_status}"
    )
    hook_output["additionalContext"] = f"{prefix}; {context}" if context else prefix
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
