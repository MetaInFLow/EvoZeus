import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("Claude plugin auto-discovers one read-only SessionStart Lesson check", () => {
  const hooks = JSON.parse(readFileSync(new URL("../hooks/hooks.json", import.meta.url), "utf8"));
  const entries = hooks.hooks.SessionStart;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].matcher, "startup|resume|clear|compact");
  assert.equal(entries[0].hooks.length, 1);
  assert.match(entries[0].hooks[0].command, /session-start\.mjs/);
});

test("Claude marketplace exposes the root EvoZeus plugin", () => {
  const marketplace = JSON.parse(
    readFileSync(new URL("../.claude-plugin/marketplace.json", import.meta.url), "utf8")
  );
  assert.equal(marketplace.name, "evozeus");
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(marketplace.plugins[0].name, "evozeus");
  assert.equal(marketplace.plugins[0].source, "./");
});

test("SessionStart adapter injects the Lesson contract without user-visible output", () => {
  const home = mkdtempSync(join(tmpdir(), "evozeus-plugin-hook-"));
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../hooks/session-start.mjs", import.meta.url))],
    {
    input: "{}",
    encoding: "utf8",
    env: { ...process.env, EVOZEUS_HOME: home }
    }
  );
  rmSync(home, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.continue, true);
  assert.equal(output.suppressOutput, true);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(output.hookSpecificOutput.additionalContext, /捕捉到一条 Lesson/);
  assert.match(output.hookSpecificOutput.additionalContext, /Do not persist a Lesson/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /signal_id|should_capture/);
});

test("SessionStart adapter surfaces EvoZeus automatic update logs", () => {
  const home = mkdtempSync(join(tmpdir(), "evozeus-plugin-hook-update-"));
  const bin = join(home, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "evozeus"),
    "#!/bin/sh\nprintf '{\"ok\":true}\\n'\nprintf '🛠️ EvoZeus · 自动更新中｜正在对齐Plugin、Runtime、Session Signal与CoEvolve\\n' >&2\nprintf '✅ EvoZeus · 自动更新完成｜Stable v0.4.1 · 新会话加载Plugin\\n' >&2\n",
    { mode: 0o755 }
  );
  try {
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL("../hooks/session-start.mjs", import.meta.url))],
      { input: "{}", encoding: "utf8", env: { ...process.env, EVOZEUS_HOME: home } }
    );
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.suppressOutput, false);
    assert.match(output.systemMessage, /自动更新中/);
    assert.match(output.systemMessage, /自动更新完成/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("CoEvolve dispatcher relays the same EvoZeus automatic update logs", () => {
  const home = mkdtempSync(join(tmpdir(), "evozeus-coevolve-hook-update-"));
  const bin = join(home, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "evozeus"),
    "#!/bin/sh\nprintf '{\"ok\":true}\\n'\nprintf '🧭 EvoZeus · 发现更新｜Stable v0.4.0 → v0.4.1\\n' >&2\nprintf '✅ EvoZeus · 自动更新完成｜Stable v0.4.1 · 新会话加载Plugin\\n' >&2\n",
    { mode: 0o755 }
  );
  try {
    const result = spawnSync(
      "python3",
      [fileURLToPath(new URL("./evozeus-coevolve-dispatcher.py", import.meta.url))],
      { input: "{}", encoding: "utf8", env: { ...process.env, EVOZEUS_HOME: home } }
    );
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.match(output.systemMessage, /发现更新/);
    assert.match(output.systemMessage, /自动更新完成/);
    assert.match(output.hookSpecificOutput.additionalContext, /evozeus_auto_update=reported/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
