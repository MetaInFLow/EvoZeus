import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

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

test("Lesson proposals expose the record destination and write boundary before confirmation", () => {
  const sources = [
    "../README.md",
    "../README.en.md",
    "../skills/using-evozeus/SKILL.md",
    "../skills/capture-evozeus-lesson/SKILL.md",
    "../skills/review-agent-session/SKILL.md",
    "../docs/reference/user-visible-events.md",
    "../hooks/session-start.mjs"
  ];

  for (const source of sources) {
    const content = read(source);
    assert.match(content, /拟记录到：/, `${source} must name the record destination`);
    assert.match(content, /记录载体|artifact/, `${source} must name the record artifact`);
    assert.match(content, /影响范围/, `${source} must name the affected scope`);
    assert.match(content, /写入边界/, `${source} must name the authorized write boundary`);
    assert.match(content, /要按此记录吗？/, `${source} must ask for confirmation of the displayed route`);
    assert.doesNotMatch(content, /要记录下来吗？/, `${source} must not use the ambiguous legacy prompt`);
  }
});
