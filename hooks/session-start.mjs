#!/usr/bin/env node

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function runAutoUpdateCheck() {
  if (process.env.EVOZEUS_COEVOLVE_RUNTIME_CHILD === "1") return { logs: [], status: "skipped_child" };
  const home = process.env.EVOZEUS_HOME || join(homedir(), ".evozeus");
  const executable = join(home, "bin", "evozeus");
  if (!existsSync(executable)) return { logs: [], status: "not_installed" };
  const result = spawnSync(executable, ["version", "--json"], {
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, EVOZEUS_HOME: home, EVOZEUS_SESSION_UPDATE_CHECK: "1" }
  });
  const logs = String(result.stderr || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("EvoZeus ·"));
  if (result.error?.code === "ETIMEDOUT") {
    logs.push("🛡️ EvoZeus · 自动更新失败｜检查超时，当前会话继续使用已验证版本");
  } else if (result.status !== 0 && logs.length === 0) {
    logs.push("🛡️ EvoZeus · 自动更新失败｜版本检查未完成，当前会话继续使用已验证版本");
  }
  return { logs, status: result.status === 0 ? "checked" : "check_failed" };
}

const update = runAutoUpdateCheck();

const additionalContext = [
  "EvoZeus Lesson check is enabled for this Claude Code session.",
  "Do not announce this hook or print an EvoZeus startup banner unless the user explicitly invokes EvoZeus.",
  "Before routing or executing a meaningful task, and again whenever the user adds a correction, semantically check whether the message exposes reusable knowledge, a repeatable workflow rule, an explicit record request, or a Skill/Harness defect.",
  "When a reusable candidate is found, pause the original task before the next substantive tool call and add exactly one separate normal chat line: 🧙 EvoZeus · 捕捉到一条 Lesson｜<脱敏的一句话摘要>。要先记录为 Issue 吗？",
  "Do not read business data or continue the original task until the user explicitly confirms the corresponding action. Do not persist a Lesson, create an Issue, modify a repository, or start a fix before confirmation.",
  "Do not show raw capture JSON. Do not include secrets, customer data, private paths, unreleased code, or unnecessary identities in the summary."
].join(" ");

process.stdout.write(
  JSON.stringify({
    continue: true,
    suppressOutput: update.logs.length === 0,
    ...(update.logs.length > 0 ? { systemMessage: update.logs.join("\n") } : {}),
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `${additionalContext} evozeus_auto_update=${update.status}.`
    }
  })
);
