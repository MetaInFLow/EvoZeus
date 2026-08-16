import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const PRIMARY_DESCRIPTION =
  "经明确确认后，将本地 Codex 历史转化为 AI 使用画像，并为独立 Skillware Repo 接入 CoEvolve Harness。";
const PRIMARY_PROMPTS = [
  "先为我生成本机 Codex 历史扫描计划并等待明确批准；当前只支持 Codex，批准前不要读取历史。批准后生成 AI 使用习惯、优势与盲区、人格画像（例如 INTJ 倾向）报告。",
  "为我指定的独立 Skillware Repo 接入 CoEvolve Harness；先检查并给出计划，修改 Repo 或 GitHub 前等待我的明确批准。",
  "列出 EvoZeus 的全部功能，并检查当前安装和 Stable/UAT 状态。"
];

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8"));
}

test("plugin metadata leads with the two primary outcomes and approval boundary", () => {
  const codex = readJson(".codex-plugin/plugin.json");
  const claude = readJson(".claude-plugin/plugin.json");
  const marketplace = readJson(".claude-plugin/marketplace.json");

  assert.equal(codex.description, PRIMARY_DESCRIPTION);
  assert.deepEqual(codex.keywords.slice(0, 2), ["ai-usage-profile", "skillware-evolution"]);
  assert.equal(codex.interface.shortDescription, "AI 使用画像与 Skillware 进化");
  assert.match(codex.interface.longDescription, /习惯、优势、盲区/);
  assert.match(codex.interface.longDescription, /会话派生人格倾向/);
  assert.match(codex.interface.longDescription, /当前 Release 只支持 Codex/);
  assert.match(codex.interface.longDescription, /会话复盘、Lesson 捕捉和 Stable\/UAT 维护作为辅助能力继续提供/);
  assert.deepEqual(codex.interface.defaultPrompt, PRIMARY_PROMPTS);
  assert.match(claude.description, /本地 Codex 历史/);
  assert.match(claude.description, /当前只支持 Codex/);
  assert.deepEqual(claude.keywords, codex.keywords);
  assert.match(marketplace.plugins[0].description, /本地 Codex 历史/);
  assert.match(marketplace.plugins[0].description, /当前只支持 Codex/);
  assert.match(marketplace.metadata.description, /AI 使用画像/);
  assert.match(marketplace.metadata.description, /CoEvolve Harness/);
});

test("installed onboarding and the root plugin route keep primary and supporting features ordered", () => {
  const onboarding = readFileSync(
    new URL("../docs/reference/install-onboarding-conversation.md", import.meta.url),
    "utf8"
  );
  const usingEvoZeus = readFileSync(new URL("../skills/using-evozeus/SKILL.md", import.meta.url), "utf8");

  assert.ok(onboarding.indexOf("1. 生成 AI 使用画像") < onboarding.indexOf("3. 复盘 Session 并沉淀 Lesson"));
  assert.ok(onboarding.indexOf("2. 为 Skillware 接入 Harness") < onboarding.indexOf("4. 检查本地状态"));
  assert.match(onboarding, /当前只支持 Codex 历史/);
  assert.match(onboarding, /A\. 先生成本机 Codex 历史扫描与 AI 使用画像计划/);
  assert.match(onboarding, /B\. 为某个独立 Skillware Repo 生成 CoEvolve Harness 接入计划/);
  assert.ok(usingEvoZeus.indexOf("基于本地 Codex 历史规划或生成 AI 使用画像") < usingEvoZeus.indexOf("复盘一次会话"));
  assert.match(usingEvoZeus, /当前 Release 只支持 Codex/);
  assert.match(usingEvoZeus, /明确确认前不要读取 Codex 历史、运行 Factor 或写入报告/);
});

test("using-evozeus exposes semantic examples for specified activation scenes", () => {
  const skill = readFileSync(new URL("../skills/using-evozeus/SKILL.md", import.meta.url), "utf8");
  for (const text of [
    "## 指定场景激活示例",
    "生成 AI 使用画像",
    "接入或检查 Harness",
    "复盘 Agent 会话",
    "检查或维护 Stable/UAT",
    "激活 UAT 候选",
    "业务运行中出现纠偏",
    "不是关键词清单",
    "任何候选 Lesson 都优先于场景路由",
  ]) {
    assert.match(skill, new RegExp(text.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&")));
  }
});

test("install instructions share the local-state-first Stable preflight contract", () => {
  const maintain = readFileSync(new URL("../skills/maintain-evozeus/SKILL.md", import.meta.url), "utf8");
  const install = readFileSync(new URL("../maintainer/skills/evozeus-install-registration/SKILL.md", import.meta.url), "utf8");
  const reference = readFileSync(new URL("../docs/reference/install-preflight.md", import.meta.url), "utf8");
  const states = [
    "not_installed",
    "healthy_current",
    "update_available",
    "repair_required",
    "legacy_migration_required",
    "unknown_or_unverifiable"
  ];

  for (const state of states) {
    assert.match(maintain, new RegExp(state));
    assert.match(install, new RegExp(state));
    assert.match(reference, new RegExp(state));
  }
  assert.ok(install.indexOf("步骤 0：解析 Release 前检查本地 CLI 和状态") < install.indexOf("仅当状态为 not_installed 时解析最新不可变 EvoZeus Stable Release 资源和 checksum"));
  assert.match(maintain, /只有 `not_installed` 可以进入全新安装/);
  assert.match(maintain, /严格的零下载、零写入、零注册 no-op/);
  assert.match(install, /Preflight v1 只支持 Stable/);
  assert.match(install, /--preflight-stdin --approve-write/);
});

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
