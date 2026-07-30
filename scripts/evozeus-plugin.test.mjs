import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../hooks/session-start.mjs", import.meta.url))],
    {
    input: "{}",
    encoding: "utf8"
    }
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.continue, true);
  assert.equal(output.suppressOutput, true);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(output.hookSpecificOutput.additionalContext, /捕捉到一条 Lesson/);
  assert.match(output.hookSpecificOutput.additionalContext, /Do not persist a Lesson/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /signal_id|should_capture/);
});
