import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const englishOrigin =
  "> Origin: EvoZeus came from a retrospective between [Anthony](https://github.com/HaodiFan) and [Neil](https://github.com/orgs/MetaInFLow/people/Neillan96) after a hackathon that did not go well.";
const chineseOrigin =
  "> Origin：宙斯的概念诞生于一次不太成功的黑客松之后，[Anthony](https://github.com/HaodiFan) 和 [Neil](https://github.com/orgs/MetaInFLow/people/Neillan96) 两个人的一次复盘。";

function assertOriginIsPinned(readme, origin, navigationMarker) {
  const originIndex = readme.indexOf(origin);
  const navigationIndex = readme.indexOf(navigationMarker);

  assert.notEqual(originIndex, -1, "README must preserve the Anthony and Neil origin statement");
  assert.notEqual(navigationIndex, -1, "README navigation marker must exist");
  assert.ok(originIndex < navigationIndex, "Origin statement must remain above README navigation");
  assert.ok(
    readme.slice(0, originIndex).split("\n").length <= 12,
    "Origin statement must remain in the README intro"
  );
}

test("keeps the Anthony and Neil origin statement at the top of both root READMEs", () => {
  const chinese = readFileSync(resolve(root, "README.md"), "utf8");
  const english = readFileSync(resolve(root, "README.en.md"), "utf8");
  const legacyChinese = readFileSync(resolve(root, "docs/README.zh-CN.md"), "utf8");

  assertOriginIsPinned(chinese, chineseOrigin, '<a href="README.en.md">English</a>');
  assertOriginIsPinned(english, englishOrigin, '<a href="README.md">简体中文</a>');
  assertOriginIsPinned(legacyChinese, chineseOrigin, "[返回默认中文 README](../README.md)");
});

test("keeps the primary product narrative and real Demo contract aligned in both root READMEs", () => {
  const chinese = readFileSync(resolve(root, "README.md"), "utf8");
  const english = readFileSync(resolve(root, "README.en.md"), "utf8");
  const readmes = [chinese, english];
  const demoRepo = "https://github.com/MetaInFLow/diagnose-enterprise-ai-scenarios";
  const stableSkill = `${demoRepo}/blob/v0.1.0/SKILL.md`;
  const harnessManifest = `${demoRepo}/blob/main/.evozeus-wrapper/wrapper.json`;

  assert.ok(chinese.indexOf("## 两项主功能") < chinese.indexOf("## 适用场景"));
  assert.ok(english.indexOf("## Two primary capabilities") < english.indexOf("## Use Cases"));
  assert.match(chinese, /批准前不要读取历史/);
  assert.match(english, /Do not read history before approval/);
  assert.match(chinese, /当前只支持本机 Codex 历史/);
  assert.match(english, /supports local Codex history only/);
  assert.doesNotMatch(chinese, /本机 Agent 历史/);
  assert.doesNotMatch(english, /local Agent history/);
  assert.match(chinese, /独立 Skillware Repo 接入 CoEvolve Harness/);
  assert.match(english, /Attach a CoEvolve Harness to the independent Skillware repository/);

  for (const readme of readmes) {
    assert.match(readme, new RegExp(demoRepo));
    assert.match(readme, new RegExp(stableSkill.replaceAll(".", "\\.")));
    assert.match(readme, new RegExp(harnessManifest.replaceAll(".", "\\.")));
    assert.doesNotMatch(readme, /Enterprise-ai-scenario-map-skill/i);
    assert.doesNotMatch(readme, /30\s*(?:\+|个以上)/i);
  }

  assert.match(chinese, /三个互不重复的候选场景、一个首选场景和一个带量化通过条件的最小验证动作/);
  assert.match(english, /three distinct candidate scenarios, one recommended scenario, and one minimum validation action with a measurable pass condition/);
  assert.match(
    chinese,
    /一家提供企业软件定制服务的公司，销售线索来自多个群聊，售前方案主要依靠个人经验，历史案例分散。请诊断三个适合优先验证的 AI 场景。/
  );
});
