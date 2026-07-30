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
