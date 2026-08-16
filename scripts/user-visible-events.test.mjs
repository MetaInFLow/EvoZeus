import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");

test("README and entry Skill expose the complete user-visible EvoZeus event catalog", () => {
  const readme = read("../README.md");
  const englishReadme = read("../README.en.md");
  const skill = read("../skills/using-evozeus/SKILL.md");
  const reference = read("../docs/reference/user-visible-events.md");
  const markers = [
    "🧙 EvoZeus · 已启动",
    "👁️ EvoZeus · 受管运行",
    "🧙 EvoZeus · 捕捉到一条 Lesson",
    "📝 EvoZeus · Lesson 已记录",
    "🔐 EvoZeus · 等待确认",
    "🧭 EvoZeus · 版本状态",
    "🧭 EvoZeus · 发现更新",
    "🛠️ EvoZeus · 自动更新中",
    "✅ EvoZeus · 自动更新完成",
    "🛡️ EvoZeus · 自动更新失败",
    "🛠️ EvoZeus · 进化中",
    "🧪 EvoZeus · UAT 就绪",
    "🚀 EvoZeus · 已发布",
    "↩️ EvoZeus · 已回滚",
    "🛡️ EvoZeus · 暂停",
    "✅ EvoZeus · 已验证"
  ];

  for (const marker of markers) {
    assert.match(readme, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(englishReadme, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(skill, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(reference, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Lesson activation pauses the original task before Issue confirmation", () => {
  const skill = read("../skills/using-evozeus/SKILL.md");
  const sessionSignal = read(
    "../packs/session-signal/src/evozeus_session_signal_skill/lesson_candidate.py"
  );
  for (const text of [
    "学习与纠偏激活协议",
    "捕获优先停机",
    "立即暂停原任务",
    "是否先记录为 Issue",
    "不读取业务数据",
    "等待用户明确要求继续",
  ]) {
    assert.match(skill, new RegExp(escapeRegex(text)));
  }
  for (const text of [
    "立即暂停原业务流程",
    "要先记录为 Issue 吗？",
    "不要读取业务数据、继续任务或开始修复",
  ]) {
    assert.match(sessionSignal, new RegExp(escapeRegex(text)));
  }
});
