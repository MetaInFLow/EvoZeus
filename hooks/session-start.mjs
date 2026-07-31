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
  "At the end of a meaningful task, silently check whether the work exposed a reusable rule, failure pattern, workflow improvement, environment fix, or product behavior gap.",
  "Before asking to record a Lesson, resolve one target Repo or named local-only destination, one record artifact, the affected scope, and the exact write boundary. If any field is unknown, do not emit a generic recording question.",
  "When all fields are known, finish the user's requested result first, then add exactly one normal chat line: 🧙 EvoZeus · 捕捉到一条 Lesson｜<脱敏的一句话摘要>｜拟记录到：<目标 Repo 或 local-only 位置> · <记录载体>｜影响范围：<受影响产品、Skill 或工作流>｜写入边界：<本次确认将创建的记录；明确排除的后续动作>。要按此记录吗？",
  "This line is a proposal only. User confirmation authorizes exactly the displayed record operation. Do not modify code, create a PR, install, release, or perform any excluded follow-up action without separate approval.",
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
