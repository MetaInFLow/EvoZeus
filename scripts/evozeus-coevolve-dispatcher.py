#!/usr/bin/env python3
"""Resolve the active EvoZeus channel before running the CoEvolve SessionStart hook."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


SCHEMA_VERSION = "evozeus.channel-coevolve-dispatcher.v1"


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


def main() -> int:
    home = Path(os.environ.get("EVOZEUS_HOME", Path.home() / ".evozeus")).expanduser().resolve()
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
        print(json.dumps(_fallback(channel, "CoEvolve hook source is unavailable; continuing without a freshness claim."), ensure_ascii=False))
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
    payload["systemMessage"] = f"[EvoZeus {label}] {payload.get('systemMessage', 'CoEvolve hook evaluated.')}"
    hook_output = payload.setdefault("hookSpecificOutput", {})
    context = str(hook_output.get("additionalContext", "")).strip()
    prefix = f"evozeus_dispatcher={SCHEMA_VERSION}; evozeus_channel={channel or 'unconfigured'}"
    hook_output["additionalContext"] = f"{prefix}; {context}" if context else prefix
    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
