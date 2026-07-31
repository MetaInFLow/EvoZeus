#!/usr/bin/env python3
"""Resolve the active EvoZeus channel before running the CoEvolve SessionStart hook."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import stat
import subprocess
import sys
import time
from typing import Any


SCHEMA_VERSION = "evozeus.channel-coevolve-dispatcher.v2"
AUTO_UPDATE_TIMEOUT_SECONDS = 120
USER_PROMPT_EVENT = "UserPromptSubmit"
USER_PROMPT_RUNTIME_API = "evozeus.user-prompt.lesson-runtime.v1"
SESSION_SIGNAL_ATTACHMENT_PATH = Path("contracts/v1/user-prompt-lesson-runtime.json")
PROJECTS_DIR = Path(".evozeus/.projects")
MANIFEST_CANDIDATES = (
    Path(".evozeus-wrapper/wrapper.json"),
    Path(".evozeus_evoinfra/wrapper.json"),
    Path(".evozeus/wrapper.json"),
)
SESSION_SIGNAL_TIMEOUT_SECONDS = 1.5
SESSION_SIGNAL_MAX_REQUEST_BYTES = 256 * 1024
SESSION_SIGNAL_MAX_OUTPUT_BYTES = 16 * 1024
SESSION_SIGNAL_MAX_STDERR_BYTES = 16 * 1024
SESSION_SIGNAL_MAX_PROMPT_CHARS = 32_000
SESSION_SIGNAL_MAX_TARGETS = 256
_ISOLATED_COMPONENT_BOOTSTRAP = (
    "import runpy,sys; namespace=runpy.run_path(sys.argv[1]); "
    "raise SystemExit(namespace['main']())"
)


class _ComponentOutputLimitExceeded(Exception):
    pass


def _read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _product_manifest_digest(manifest: dict[str, Any]) -> str:
    canonical = json.dumps(
        manifest,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{_sha256_bytes(canonical)}"


def _safe_relative_path(value: object) -> Path | None:
    if not isinstance(value, str) or not value or "\\" in value:
        return None
    relative_path = Path(value)
    if relative_path.is_absolute() or ".." in relative_path.parts:
        return None
    return relative_path


def _contains(parent: Path, child: Path) -> bool:
    try:
        child.relative_to(parent)
    except ValueError:
        return False
    return True


def _resolved_directory(value: object) -> Path | None:
    if not isinstance(value, str):
        return None
    raw = Path(value).expanduser()
    if not raw.is_absolute() or raw.is_symlink():
        return None
    try:
        resolved = raw.resolve(strict=True)
    except OSError:
        return None
    return resolved if resolved.is_dir() else None


def _regular_file_under(root: Path, relative_value: object) -> Path | None:
    relative_path = _safe_relative_path(relative_value)
    if relative_path is None:
        return None
    cursor = root
    for part in relative_path.parts:
        cursor = cursor / part
        try:
            mode = cursor.lstat().st_mode
        except OSError:
            return None
        if stat.S_ISLNK(mode):
            return None
    try:
        resolved = cursor.resolve(strict=True)
    except OSError:
        return None
    if not _contains(root, resolved) or not stat.S_ISREG(resolved.lstat().st_mode):
        return None
    return resolved


def _validated_attachment(core_root: Path, manifest: dict[str, Any]) -> dict[str, Any] | None:
    components = manifest.get("components")
    core_component = components.get("evozeus") if isinstance(components, dict) else None
    required_paths = core_component.get("required_paths") if isinstance(core_component, dict) else None
    if not isinstance(required_paths, list) or SESSION_SIGNAL_ATTACHMENT_PATH.as_posix() not in {
        value for value in required_paths if isinstance(value, str)
    }:
        return None
    path = _regular_file_under(core_root, SESSION_SIGNAL_ATTACHMENT_PATH.as_posix())
    if path is None:
        return None
    attachment = _read_json(path)
    component = attachment.get("component")
    if (
        attachment.get("schema_version") != "evozeus.user-prompt.lesson-runtime-attachment.v1"
        or attachment.get("runtime_api") != USER_PROMPT_RUNTIME_API
        or not isinstance(component, dict)
        or component.get("repository") != "MetaInFLow/EvoZeus-session-signal-skill"
        or component.get("api") != "evozeus.session-signal.lesson-candidate.v1"
        or not re.fullmatch(r"v\d+\.\d+\.\d+", str(component.get("version") or ""))
        or not isinstance(component.get("entrypoint"), str)
    ):
        return None
    files = component.get("files")
    if not isinstance(files, list) or not files:
        return None
    return attachment


def resolve_session_signal_component(product_home: Path) -> dict[str, Any] | None:
    """Resolve the Core-owned, digest-bound Session Signal method attachment."""
    active = _read_json(product_home / "active-channel.json")
    channel = active.get("channel")
    if channel not in {"stable", "uat"}:
        return None
    state = _read_json(product_home / "channel-state.json")
    channels = state.get("channels")
    entry = channels.get(channel) if isinstance(channels, dict) else None
    if not isinstance(entry, dict):
        return None
    manifest = entry.get("manifest")
    if (
        not isinstance(manifest, dict)
        or manifest.get("schema_version") != "evozeus.product-channel.v2"
        or manifest.get("channel") != channel
        or entry.get("manifest_digest") != _product_manifest_digest(manifest)
    ):
        return None
    install_root = _resolved_directory(entry.get("install_root"))
    component_roots = entry.get("component_roots")
    embedded_roots = entry.get("embedded_roots")
    if (
        install_root is None
        or not isinstance(component_roots, dict)
        or not isinstance(embedded_roots, dict)
    ):
        return None
    core_root = _resolved_directory(component_roots.get("evozeus"))
    session_root = _resolved_directory(embedded_roots.get("session_signal"))
    if (
        core_root is None
        or session_root is None
        or not _contains(install_root, core_root)
        or not _contains(core_root, session_root)
    ):
        return None
    attachment = _validated_attachment(core_root, manifest)
    if attachment is None:
        return None
    component = attachment["component"]
    embedded_map = manifest.get("embedded")
    embedded = embedded_map.get("session_signal") if isinstance(embedded_map, dict) else None
    if not isinstance(embedded, dict) or embedded.get("version") != component["version"]:
        return None
    embedded_path = _safe_relative_path(embedded.get("path"))
    required_paths = embedded.get("required_paths")
    if embedded_path is None or not isinstance(required_paths, list):
        return None
    try:
        expected_root = (core_root / embedded_path).resolve(strict=True)
    except OSError:
        return None
    if expected_root != session_root:
        return None
    declared_required_paths = {value for value in required_paths if isinstance(value, str)}
    verified_files: dict[str, Path] = {}
    for file_entry in component["files"]:
        if not isinstance(file_entry, dict):
            return None
        relative_path = file_entry.get("path")
        expected_sha256 = file_entry.get("sha256")
        path = _regular_file_under(session_root, relative_path)
        if (
            path is None
            or not isinstance(relative_path, str)
            or relative_path not in declared_required_paths
            or not isinstance(expected_sha256, str)
            or not re.fullmatch(r"[a-f0-9]{64}", expected_sha256)
            or _sha256_bytes(path.read_bytes()) != expected_sha256
        ):
            return None
        verified_files[relative_path] = path
    script = verified_files.get(component["entrypoint"])
    if script is None:
        return None
    return {
        "api": component["api"],
        "script": script,
        "component_root": session_root,
    }


def _version_key(tag: str) -> tuple[int, int, int] | None:
    match = re.fullmatch(r"v(\d+)\.(\d+)\.(\d+)", tag)
    return tuple(int(part) for part in match.groups()) if match else None


def _read_skill_name(path: Path) -> str | None:
    if not path.is_file() or path.is_symlink():
        return None
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return None
    frontmatter = re.match(r"\A---\s*\n(.*?)\n---(?:\s*\n|\Z)", text, re.DOTALL)
    if not frontmatter:
        return None
    match = re.search(r"(?m)^name:\s*['\"]?([^'\"\n]+?)['\"]?\s*$", frontmatter.group(1))
    return match.group(1).strip() if match else None


def discover_wrapped_targets(user_home: Path) -> list[dict[str, Any]]:
    projects_root = user_home.expanduser().resolve() / PROJECTS_DIR
    targets: list[dict[str, Any]] = []
    if not projects_root.is_dir() or projects_root.is_symlink():
        return targets
    for owner_dir in sorted(projects_root.iterdir()):
        if not owner_dir.is_dir() or owner_dir.is_symlink():
            continue
        for pointer in sorted(owner_dir.iterdir()):
            if not pointer.is_symlink() or not pointer.exists():
                continue
            try:
                canonical = pointer.resolve(strict=True)
            except OSError:
                continue
            if not canonical.is_dir():
                continue
            manifest_path = next(
                (
                    canonical / candidate
                    for candidate in MANIFEST_CANDIDATES
                    if (canonical / candidate).is_file()
                    and not (canonical / candidate).is_symlink()
                ),
                None,
            )
            if manifest_path is None:
                continue
            wrapper_manifest = _read_json(manifest_path)
            expected_repo = f"{owner_dir.name}/{pointer.name}"
            wrapper_version = wrapper_manifest.get("wrapper_version")
            if (
                wrapper_manifest.get("canonical_repo") != expected_repo
                or not isinstance(wrapper_version, str)
                or _version_key(wrapper_version) is None
            ):
                continue
            aliases = [expected_repo, pointer.name]
            instruction_surface = wrapper_manifest.get("instruction_surface") or "SKILL.md"
            surface = _regular_file_under(canonical, instruction_surface)
            if surface is not None and (declared_name := _read_skill_name(surface)):
                aliases.append(declared_name)
            targets.append(
                {
                    "repo": expected_repo,
                    "canonical_path": str(canonical),
                    "aliases": list(dict.fromkeys(aliases)),
                }
            )
    return targets


def _lesson_component_request(
    hook_input: dict[str, Any],
    targets: list[dict[str, Any]],
    *,
    api: str,
) -> dict[str, Any]:
    bounded_targets = targets if len(targets) <= SESSION_SIGNAL_MAX_TARGETS else []
    return {
        "schema_version": api,
        "event_name": USER_PROMPT_EVENT,
        "prompt": hook_input.get("prompt"),
        "cwd": hook_input.get("cwd"),
        "targets": bounded_targets,
    }


def _run_bounded_component(
    command: list[str],
    *,
    input_bytes: bytes,
    cwd: Path,
    env: dict[str, str],
    timeout: float,
) -> subprocess.CompletedProcess[bytes]:
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cwd,
        env=env,
        shell=False,
        bufsize=0,
    )
    assert process.stdin is not None
    assert process.stdout is not None
    assert process.stderr is not None
    selector = selectors.DefaultSelector()
    stdout_buffer = bytearray()
    stderr_buffer = bytearray()
    input_offset = 0
    deadline = time.monotonic() + timeout

    def close_stream(stream) -> None:
        try:
            selector.unregister(stream)
        except (KeyError, ValueError):
            pass
        try:
            stream.close()
        except OSError:
            pass

    try:
        for stream in (process.stdin, process.stdout, process.stderr):
            os.set_blocking(stream.fileno(), False)
        selector.register(process.stdout, selectors.EVENT_READ, "stdout")
        selector.register(process.stderr, selectors.EVENT_READ, "stderr")
        if input_bytes:
            selector.register(process.stdin, selectors.EVENT_WRITE, "stdin")
        else:
            process.stdin.close()

        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise subprocess.TimeoutExpired(command, timeout)
            events = selector.select(remaining)
            if not events:
                raise subprocess.TimeoutExpired(command, timeout)
            for key, _ in events:
                stream = key.fileobj
                channel = key.data
                if channel == "stdin":
                    try:
                        written = os.write(
                            stream.fileno(),
                            input_bytes[input_offset : input_offset + 65_536],
                        )
                    except BlockingIOError:
                        continue
                    except BrokenPipeError:
                        close_stream(stream)
                        continue
                    input_offset += written
                    if input_offset >= len(input_bytes):
                        close_stream(stream)
                    continue

                buffer = stdout_buffer if channel == "stdout" else stderr_buffer
                limit = (
                    SESSION_SIGNAL_MAX_OUTPUT_BYTES
                    if channel == "stdout"
                    else SESSION_SIGNAL_MAX_STDERR_BYTES
                )
                try:
                    chunk = os.read(stream.fileno(), min(65_536, limit - len(buffer) + 1))
                except BlockingIOError:
                    continue
                if not chunk:
                    close_stream(stream)
                    continue
                buffer.extend(chunk)
                if len(buffer) > limit:
                    raise _ComponentOutputLimitExceeded(channel)

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise subprocess.TimeoutExpired(command, timeout)
        return_code = process.wait(timeout=remaining)
        return subprocess.CompletedProcess(
            command,
            return_code,
            bytes(stdout_buffer),
            bytes(stderr_buffer),
        )
    except Exception:
        if process.poll() is None:
            process.kill()
        process.wait()
        raise
    finally:
        selector.close()
        for stream in (process.stdin, process.stdout, process.stderr):
            if not stream.closed:
                stream.close()


def _invoke_lesson_component(
    component: dict[str, Any],
    request: dict[str, Any],
    *,
    runner=None,
) -> dict[str, Any] | None:
    encoded = json.dumps(request, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > SESSION_SIGNAL_MAX_REQUEST_BYTES:
        return None
    command = [
        sys.executable,
        "-I",
        "-B",
        "-X",
        "utf8",
        "-c",
        _ISOLATED_COMPONENT_BOOTSTRAP,
        str(component["script"]),
    ]
    environment = {"PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1"}
    try:
        if runner is None:
            result = _run_bounded_component(
                command,
                input_bytes=encoded,
                cwd=component["component_root"],
                env=environment,
                timeout=SESSION_SIGNAL_TIMEOUT_SECONDS,
            )
        else:
            result = runner(
                command,
                input=encoded,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=component["component_root"],
                env=environment,
                timeout=SESSION_SIGNAL_TIMEOUT_SECONDS,
                check=False,
                shell=False,
            )
    except (OSError, subprocess.TimeoutExpired, _ComponentOutputLimitExceeded):
        return None
    if (
        result.returncode != 0
        or len(result.stdout) > SESSION_SIGNAL_MAX_OUTPUT_BYTES
        or len(result.stderr) > SESSION_SIGNAL_MAX_STDERR_BYTES
    ):
        return None
    try:
        response = json.loads(result.stdout.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(response, dict) or response.get("schema_version") != component["api"]:
        return None
    candidate = response.get("candidate")
    if candidate is False and set(response) == {"schema_version", "candidate"}:
        return response
    if candidate is not True or set(response) != {
        "schema_version",
        "candidate",
        "target_repo",
        "model_guidance",
    }:
        return None
    guidance = response.get("model_guidance")
    target_repo = response.get("target_repo")
    registered_repos = {target["repo"] for target in request["targets"]}
    private_values = (
        str(request.get("prompt") or ""),
        str(request.get("cwd") or ""),
        str(component["component_root"]),
        str(component["script"]),
        *(target["canonical_path"] for target in request["targets"]),
    )
    if (
        not isinstance(guidance, str)
        or not guidance
        or len(guidance) > 4_096
        or (target_repo is not None and target_repo not in registered_repos)
        or any(private_value and private_value in guidance for private_value in private_values)
    ):
        return None
    return response


def evaluate_user_prompt_submit(
    product_home: Path,
    user_home: Path,
    hook_input: dict[str, Any],
    *,
    runner=None,
) -> dict[str, Any]:
    if hook_input.get("hook_event_name") != USER_PROMPT_EVENT:
        return {"continue": True}
    prompt = hook_input.get("prompt")
    if not isinstance(prompt, str) or len(prompt) > SESSION_SIGNAL_MAX_PROMPT_CHARS:
        return {"continue": True}
    try:
        component = resolve_session_signal_component(product_home.expanduser().resolve())
        if component is None:
            return {"continue": True}
        targets = discover_wrapped_targets(user_home)
        request = _lesson_component_request(hook_input, targets, api=component["api"])
        response = _invoke_lesson_component(component, request, runner=runner)
    except Exception:
        return {"continue": True}
    if not response or response.get("candidate") is not True:
        return {"continue": True}
    return {
        "continue": True,
        "hookSpecificOutput": {
            "hookEventName": USER_PROMPT_EVENT,
            "additionalContext": response["model_guidance"],
        },
    }


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
    hook_input_bytes = sys.stdin.buffer.read(SESSION_SIGNAL_MAX_REQUEST_BYTES + 1)
    if len(hook_input_bytes) > SESSION_SIGNAL_MAX_REQUEST_BYTES:
        print(json.dumps({"continue": True}))
        return 0
    try:
        loaded_hook_input = json.loads(hook_input_bytes.decode("utf-8") or "{}")
    except (UnicodeDecodeError, json.JSONDecodeError):
        loaded_hook_input = {}
    hook_input = loaded_hook_input if isinstance(loaded_hook_input, dict) else {}
    if hook_input.get("hook_event_name") == USER_PROMPT_EVENT:
        payload = evaluate_user_prompt_submit(
            product_home=home,
            user_home=Path.home(),
            hook_input=hook_input,
        )
        print(json.dumps(payload, ensure_ascii=False))
        return 0

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

    environment = {
        **os.environ,
        "EVOZEUS_HOME": str(home),
        **({"EVOZEUS_ACTIVE_CHANNEL": channel} if channel else {}),
        **({"EVOZEUS_RUNTIME_STATE_ROOT": str(home / "state" / channel)} if channel else {}),
    }
    result = subprocess.run(
        [sys.executable, str(template)],
        input=hook_input_bytes,
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
