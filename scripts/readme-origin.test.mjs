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
