from __future__ import annotations

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import unittest


ROOT = Path(__file__).resolve().parents[1]
DISPATCHER = ROOT / "scripts" / "evozeus-coevolve-dispatcher.py"
ATTACHMENT = ROOT / "contracts" / "v1" / "user-prompt-lesson-runtime.json"
spec = importlib.util.spec_from_file_location("evozeus_user_prompt_runtime", DISPATCHER)
assert spec and spec.loader
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class UserPromptLessonRuntimeTest(unittest.TestCase):
    def _target(self, user_home: Path, root: Path, name: str = "example-skill") -> Path:
        target = root / f"target-{name}"
        target.mkdir()
        manifest = target / ".evozeus-wrapper" / "wrapper.json"
        manifest.parent.mkdir(parents=True)
        manifest.write_text(
            json.dumps(
                {
                    "canonical_repo": f"MetaInFLow/{name}",
                    "wrapper_version": "v0.14.0",
                    "instruction_surface": "SKILL.md",
                }
            ),
            encoding="utf-8",
        )
        (target / "SKILL.md").write_text(
            f"---\nname: {name}-assistant\n---\n# Test Skill\n",
            encoding="utf-8",
        )
        pointer = user_home / ".evozeus" / ".projects" / "MetaInFLow" / name
        pointer.parent.mkdir(parents=True)
        pointer.symlink_to(target)
        return target

    def _fixture(
        self,
        root: Path,
        *,
        companion_root: Path | None = None,
    ) -> dict[str, Path]:
        user_home = root / "user-home"
        product_home = root / "custom-product-home"
        install_root = product_home / "releases" / "fixture"
        core_root = install_root / "evozeus"
        session_root = core_root / "packs" / "session-signal"
        contract_path = core_root / runtime.SESSION_SIGNAL_ATTACHMENT_PATH
        contract_path.parent.mkdir(parents=True)
        if companion_root is None:
            script = (
                session_root
                / "src"
                / "evozeus_session_signal_skill"
                / "lesson_candidate.py"
            )
            script.parent.mkdir(parents=True)
            script.write_text(
                textwrap.dedent(
                    """\
                    import json
                    import sys

                    def main():
                        request = json.loads(sys.stdin.read())
                        prompt = request.get("prompt")
                        if prompt == "overflow-stdout":
                            sys.stdout.buffer.write(b"x" * (1024 * 1024))
                            return 0
                        if prompt == "overflow-stderr":
                            sys.stderr.buffer.write(b"x" * (1024 * 1024))
                            return 0
                        if prompt == "candidate":
                            target = request["targets"][0]["repo"] if request.get("targets") else None
                            guidance = f"Model-only Lesson guidance for {target or 'unassigned'}."
                            print(json.dumps({
                                "schema_version": "evozeus.session-signal.lesson-candidate.v1",
                                "candidate": True,
                                "target_repo": target,
                                "model_guidance": guidance,
                            }))
                        else:
                            print(json.dumps({
                                "schema_version": "evozeus.session-signal.lesson-candidate.v1",
                                "candidate": False,
                            }))
                        return 0
                    """
                ),
                encoding="utf-8",
            )
            attachment = {
                "schema_version": "evozeus.user-prompt.lesson-runtime-attachment.v1",
                "runtime_api": runtime.USER_PROMPT_RUNTIME_API,
                "component": {
                    "repository": "MetaInFLow/EvoZeus-session-signal-skill",
                    "version": "v0.1.1",
                    "api": "evozeus.session-signal.lesson-candidate.v1",
                    "entrypoint": "src/evozeus_session_signal_skill/lesson_candidate.py",
                    "files": [
                        {
                            "path": "src/evozeus_session_signal_skill/lesson_candidate.py",
                            "sha256": hashlib.sha256(script.read_bytes()).hexdigest(),
                        }
                    ],
                },
            }
        else:
            for relative in ("scripts", "src"):
                shutil.copytree(companion_root / relative, session_root / relative)
            attachment = json.loads(ATTACHMENT.read_text(encoding="utf-8"))
            script = session_root / attachment["component"]["entrypoint"]
        contract_path.write_text(
            json.dumps(attachment, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        required_component_paths = [
            entry["path"] for entry in attachment["component"]["files"]
        ]
        manifest = {
            "schema_version": "evozeus.product-channel.v2",
            "product_version": "v0.5.0",
            "channel": "uat",
            "generated_at": "2026-07-31T00:00:00Z",
            "components": {
                "evozeus": {
                    "version": "v0.5.0",
                    "commit": "a" * 40,
                    "source": {
                        "kind": "git",
                        "url": "https://github.com/MetaInFLow/EvoZeus.git",
                        "ref": "refs/heads/uat/current",
                    },
                    "required_paths": [runtime.SESSION_SIGNAL_ATTACHMENT_PATH.as_posix()],
                }
            },
            "embedded": {
                "session_signal": {
                    "version": "v0.1.1",
                    "path": "packs/session-signal",
                    "required_paths": required_component_paths,
                }
            },
            "compatibility": {},
        }
        product_home.mkdir(parents=True, exist_ok=True)
        (product_home / "active-channel.json").write_text(
            json.dumps({"channel": "uat"}),
            encoding="utf-8",
        )
        (product_home / "channel-state.json").write_text(
            json.dumps(
                {
                    "channels": {
                        "uat": {
                            "manifest": manifest,
                            "manifest_digest": runtime._product_manifest_digest(manifest),
                            "install_root": str(install_root),
                            "component_roots": {"evozeus": str(core_root)},
                            "embedded_roots": {"session_signal": str(session_root)},
                        }
                    }
                }
            ),
            encoding="utf-8",
        )
        target = self._target(user_home, root)
        return {
            "user_home": user_home,
            "product_home": product_home,
            "install_root": install_root,
            "core_root": core_root,
            "session_root": session_root,
            "script": script,
            "contract": contract_path,
            "target": target,
        }

    def _invoke(self, fixture: dict[str, Path], prompt: str, **kwargs):
        return runtime.evaluate_user_prompt_submit(
            fixture["product_home"],
            fixture["user_home"],
            {
                "hook_event_name": "UserPromptSubmit",
                "cwd": str(fixture["target"]),
                "prompt": prompt,
            },
            **kwargs,
        )

    def test_core_attachment_owns_version_entrypoint_and_checksums(self):
        attachment = json.loads(ATTACHMENT.read_text(encoding="utf-8"))

        self.assertEqual(
            attachment["schema_version"],
            "evozeus.user-prompt.lesson-runtime-attachment.v1",
        )
        self.assertEqual(attachment["runtime_api"], runtime.USER_PROMPT_RUNTIME_API)
        self.assertEqual(attachment["component"]["version"], "v0.1.1")
        self.assertEqual(
            attachment["component"]["entrypoint"],
            "src/evozeus_session_signal_skill/lesson_candidate.py",
        )
        self.assertTrue(
            all(
                len(entry["sha256"]) == 64
                for entry in attachment["component"]["files"]
            )
        )

    def test_custom_product_home_uses_fixed_user_project_registry(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = self._fixture(Path(tmp))

            payload = self._invoke(fixture, "candidate")

            context = payload["hookSpecificOutput"]["additionalContext"]
            self.assertIn("MetaInFLow/example-skill", context)
            self.assertNotIn(str(fixture["target"]), json.dumps(payload))

    def test_neutral_prompt_is_silent(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = self._fixture(Path(tmp))

            self.assertEqual(self._invoke(fixture, "neutral"), {"continue": True})

    def test_invalid_channel_evidence_and_component_files_fail_open(self):
        for failure in ("manifest_digest", "version", "damaged", "symlink"):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp:
                fixture = self._fixture(Path(tmp))
                state_path = fixture["product_home"] / "channel-state.json"
                state = json.loads(state_path.read_text(encoding="utf-8"))
                entry = state["channels"]["uat"]
                if failure == "manifest_digest":
                    entry["manifest_digest"] = "sha256:" + "0" * 64
                elif failure == "version":
                    entry["manifest"]["embedded"]["session_signal"]["version"] = "v0.1.0"
                    entry["manifest_digest"] = runtime._product_manifest_digest(entry["manifest"])
                elif failure == "damaged":
                    fixture["script"].write_text("# damaged\n", encoding="utf-8")
                else:
                    outside = Path(tmp) / "outside.py"
                    outside.write_bytes(fixture["script"].read_bytes())
                    fixture["script"].unlink()
                    fixture["script"].symlink_to(outside)
                state_path.write_text(json.dumps(state), encoding="utf-8")

                self.assertEqual(self._invoke(fixture, "candidate"), {"continue": True})

    def test_subprocess_transport_is_bounded_and_fail_open(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = self._fixture(Path(tmp))
            captured: dict[str, object] = {}

            def runner(command, **kwargs):
                captured.update({"command": command, **kwargs})
                raise subprocess.TimeoutExpired(command, kwargs["timeout"])

            payload = self._invoke(fixture, "candidate", runner=runner)

            self.assertEqual(payload, {"continue": True})
            self.assertIn("-I", captured["command"])
            self.assertIn("-B", captured["command"])
            self.assertEqual(captured["shell"], False)
            self.assertEqual(captured["timeout"], 1.5)
            self.assertEqual(
                captured["env"],
                {"PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1"},
            )

    def test_component_stdout_and_stderr_are_bounded_while_streaming(self):
        for prompt in ("overflow-stdout", "overflow-stderr"):
            with self.subTest(prompt=prompt), tempfile.TemporaryDirectory() as tmp:
                fixture = self._fixture(Path(tmp))

                payload = self._invoke(fixture, prompt)

                self.assertEqual(payload, {"continue": True})

    def test_isolated_mode_ignores_unverified_import_shadow(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            fixture = self._fixture(root)
            marker = root / "shadow-import-executed"
            shadow = fixture["script"].parent / "json.py"
            shadow.write_text(
                "from pathlib import Path\n"
                f"Path({str(marker)!r}).write_text('executed', encoding='utf-8')\n"
                "raise RuntimeError('shadow import executed')\n",
                encoding="utf-8",
            )

            payload = self._invoke(fixture, "candidate")

            self.assertIn(
                "MetaInFLow/example-skill",
                payload["hookSpecificOutput"]["additionalContext"],
            )
            self.assertFalse(marker.exists())

    def test_oversized_prompt_stops_before_component_launch(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = self._fixture(Path(tmp))

            def runner(*_args, **_kwargs):
                self.fail("oversized prompt must not launch the component")

            payload = self._invoke(
                fixture,
                "x" * (runtime.SESSION_SIGNAL_MAX_PROMPT_CHARS + 1),
                runner=runner,
            )

            self.assertEqual(payload, {"continue": True})

    def test_cli_user_prompt_skips_session_auto_update_and_persistence(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            fixture = self._fixture(root)
            marker = root / "auto-update-was-called"
            executable = fixture["product_home"] / "bin" / "evozeus"
            executable.parent.mkdir(parents=True)
            executable.write_text(
                f"#!/bin/sh\ntouch '{marker}'\n",
                encoding="utf-8",
            )
            executable.chmod(0o755)

            def snapshot() -> dict[str, str]:
                return {
                    path.relative_to(root).as_posix(): hashlib.sha256(
                        path.read_bytes()
                    ).hexdigest()
                    for path in root.rglob("*")
                    if path.is_file() and not path.is_symlink()
                }

            before = snapshot()
            result = subprocess.run(
                [sys.executable, str(DISPATCHER)],
                input=json.dumps(
                    {
                        "hook_event_name": "UserPromptSubmit",
                        "cwd": str(fixture["target"]),
                        "prompt": "candidate",
                    }
                ),
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env={
                    **os.environ,
                    "HOME": str(fixture["user_home"]),
                    "EVOZEUS_HOME": str(fixture["product_home"]),
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
                check=False,
            )
            after = snapshot()

            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertIn(
                "MetaInFLow/example-skill",
                payload["hookSpecificOutput"]["additionalContext"],
            )
            self.assertFalse(marker.exists())
            self.assertEqual(before, after)

    @unittest.skipUnless(
        os.environ.get("EVOZEUS_TEST_SESSION_SIGNAL_ROOT"),
        "requires an explicit Session Signal companion checkout",
    )
    def test_real_companion_subprocess_smoke(self):
        companion = Path(os.environ["EVOZEUS_TEST_SESSION_SIGNAL_ROOT"]).resolve()
        with tempfile.TemporaryDirectory() as tmp:
            fixture = self._fixture(Path(tmp), companion_root=companion)

            correction = self._invoke(fixture, "这个结果不对，遗漏了验收标准。")
            hypothetical = self._invoke(
                fixture,
                "假设今后每次都必须检查 diff，我们需要评估成本。",
            )

            serialized = json.dumps(correction, ensure_ascii=False)
            self.assertIn("EvoZeus · Lesson", serialized)
            self.assertIn("MetaInFLow/example-skill", serialized)
            self.assertNotIn("遗漏了验收标准", serialized)
            self.assertNotIn(str(fixture["target"]), serialized)
            self.assertEqual(hypothetical, {"continue": True})


if __name__ == "__main__":
    unittest.main()
