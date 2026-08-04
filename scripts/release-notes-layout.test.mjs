import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PRODUCT_VERSION = "0.5.1";
const PRODUCT_TAG = `v${PRODUCT_VERSION}`;
const COEVOLVE_VERSION = "v0.15.0";
const COEVOLVE_COMMIT = "ddd004dda0e8db16503d1e0b0aafa5a495465f2d";
const COEVOLVE_SHA256 = "sha256:94e52170ce5020fb425d538b28e867065b902bdc91704873a1ad2aaad9b9a694";

function readJson(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

test("keeps versioned Release Notes out of the repository root", () => {
  const rootNotes = readdirSync(ROOT).filter((name) => /^release-notes-v\d+\.\d+\.\d+\.md$/.test(name));
  assert.deepEqual(rootNotes, []);

  const notes = readdirSync(join(ROOT, "docs", "releases")).filter((name) => /^v\d+\.\d+\.\d+\.md$/.test(name));
  assert.ok(notes.length > 0);
});

test("resolves tag Release Notes from docs/releases", () => {
  const workflow = readFileSync(join(ROOT, ".github", "workflows", "release.yml"), "utf8");
  assert.match(workflow, /RELEASE_NOTES_DIR:\s*docs\/releases/);
  assert.match(workflow, /--notes-file "\$\{RELEASE_NOTES_DIR\}\/\$\{GITHUB_REF_NAME\}\.md"/);
  assert.match(workflow, /test -s "\$\{RELEASE_NOTES_DIR\}\/\$\{GITHUB_REF_NAME\}\.md"/);
});

test("uploads and verifies every Release asset before immutable publication", () => {
  const workflow = readFileSync(join(ROOT, ".github", "workflows", "release.yml"), "utf8");
  const createDraft = workflow.indexOf("gh release create");
  const uploadAssets = workflow.indexOf("gh release upload");
  const verifyDigest = workflow.indexOf("actual_digest=");
  const publishRelease = workflow.indexOf("gh release edit", uploadAssets);
  const assetBlock = workflow.match(/assets=\(\n([\s\S]*?)\n\s*\)/);

  assert.match(workflow, /concurrency:\n\s+group: release-\$\{\{ github\.ref \}\}\n\s+cancel-in-progress: false/);
  assert.ok(createDraft >= 0);
  assert.ok(uploadAssets > createDraft);
  assert.ok(verifyDigest > uploadAssets);
  assert.ok(publishRelease > verifyDigest);
  assert.match(workflow.slice(createDraft, uploadAssets), /--verify-tag --draft/);
  assert.match(workflow.slice(createDraft, uploadAssets), /gh release edit[^\n]+--notes-file/);
  assert.match(workflow.slice(createDraft, uploadAssets), /elif \[ "\$\{release_state\}" = \$'false\\tfalse' \]; then/);
  assert.match(workflow.slice(createDraft, uploadAssets), /gh release delete "\$\{GITHUB_REF_NAME\}" --yes\n\s+exit 1/);
  assert.match(workflow.slice(createDraft, uploadAssets), /test "\$\{release_state\}" = \$'false\\ttrue'/);
  assert.match(workflow.slice(createDraft, uploadAssets), /publish_required="false"/);
  assert.ok(assetBlock);
  assert.deepEqual(
    assetBlock[1].trim().split("\n").map((line) => line.trim().replace(/^"|"$/g, "")),
    [
      "evozeus-install-preflight.mjs",
      "evozeus-install-preflight.mjs.sha256",
      "evozeus-${GITHUB_REF_NAME}.tar.gz",
      "evozeus-${GITHUB_REF_NAME}.tar.gz.sha256",
      "evozeus-product-stable.json",
    ],
  );
  assert.match(workflow, /test "\$\{asset_count\}" -eq "\$\{#assets\[@\]\}"/);
  assert.match(workflow, /steps\.release_draft\.outputs\.publish_required/);
  assert.equal([...workflow.matchAll(/git ls-remote origin/g)].length, 2);
  assert.match(workflow, /isDraft,isImmutable/);
  assert.match(workflow.slice(publishRelease), /--draft=false --latest/);
  assert.match(workflow.slice(publishRelease), /if \[ "\$\{release_state\}" = \$'false\\tfalse' \]/);
  assert.match(workflow.slice(publishRelease), /gh release delete "\$\{GITHUB_REF_NAME\}" --yes/);
  assert.match(workflow.slice(publishRelease), /test "\$\{release_state\}" = \$'false\\ttrue'/);
});

test("keeps current product metadata and Release Notes aligned", () => {
  const stable = readJson("channels/stable-release-input.json");
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const codexPlugin = readJson(".codex-plugin/plugin.json");
  const claudePlugin = readJson(".claude-plugin/plugin.json");
  const claudeMarketplace = readJson(".claude-plugin/marketplace.json");
  const cli = readFileSync(join(ROOT, "scripts", "evozeus-cli.mjs"), "utf8");
  const governance = readFileSync(join(ROOT, "ZEUS_STATUS.yml"), "utf8");
  const releaseIndex = readFileSync(join(ROOT, "docs", "releases", "README.md"), "utf8");
  const releaseNotes = readFileSync(join(ROOT, "docs", "releases", `${PRODUCT_TAG}.md`), "utf8");

  assert.equal(stable.product_version, PRODUCT_TAG);
  assert.equal(stable.core.archive_url, `https://github.com/MetaInFLow/EvoZeus/releases/download/${PRODUCT_TAG}/evozeus-${PRODUCT_TAG}.tar.gz`);
  assert.equal(packageJson.version, PRODUCT_VERSION);
  assert.equal(packageLock.version, PRODUCT_VERSION);
  assert.equal(packageLock.packages[""].version, PRODUCT_VERSION);
  assert.equal(codexPlugin.version, PRODUCT_VERSION);
  assert.equal(claudePlugin.version, PRODUCT_VERSION);
  assert.equal(claudeMarketplace.plugins[0].version, PRODUCT_VERSION);
  assert.match(cli, new RegExp(`const CLI_VERSION = "${PRODUCT_VERSION.replaceAll(".", "\\.")}";`));
  assert.match(governance, new RegExp(`^governance_version: ${PRODUCT_VERSION}$`, "m"));
  assert.match(releaseIndex, new RegExp(`\\[${PRODUCT_TAG.replaceAll(".", "\\.")}\\]\\(${PRODUCT_TAG.replaceAll(".", "\\.")}\\.md\\)`));
  assert.match(releaseNotes, new RegExp(`^# EvoZeus ${PRODUCT_TAG.replaceAll(".", "\\.")}$`, "m"));
});

test("pins the CoEvolve v0.15 consumer and migration contract", () => {
  const stable = readJson("channels/stable-release-input.json");
  const coevolve = stable.components.coevolve;
  const requiredPaths = new Set(coevolve.required_paths);

  assert.equal(coevolve.version, COEVOLVE_VERSION);
  assert.equal(coevolve.commit, COEVOLVE_COMMIT);
  assert.deepEqual(coevolve.source, {
    kind: "release_archive",
    url: `https://github.com/MetaInFLow/EvoZeus-CoEvolve/releases/download/${COEVOLVE_VERSION}/evozeus-coevolve-${COEVOLVE_VERSION}.tar.gz`,
    ref: COEVOLVE_VERSION,
    sha256: COEVOLVE_SHA256
  });
  assert.equal(stable.compatibility.coevolve_contract, "v1.2.0");

  for (const path of [
    "requirements-commonmark.lock",
    "scripts/evozeus_harness_legacy_prompt_adapter.py",
    "scripts/evozeus_official_upgrade_verify.py",
    "scripts/evozeus_wrapper_preflight.py",
    "templates/target/.evozeus_evoinfra/skills/using-evozeus-harness/SKILL.md",
    "contracts/v1/user-prompt-lesson-runtime-lifecycle.json",
    "contracts/v1/migrations/profiles/current.json",
    "contracts/v1/migrations/history/harness-skill/current.json",
    "contracts/v1/migrations/profiles/canonical-v1.0-to-v1.1-v1.json",
    "contracts/v1/migrations/profiles/legacy-v0.14-three-section-to-canonical-v1.1-v1.json",
    "contracts/v1/migrations/protocols/official-upgrade-protocol-v1.json",
    "contracts/v1/migrations/history/harness-skill/v1.1.0/closure.json"
  ]) {
    assert.ok(requiredPaths.has(path), `missing CoEvolve release path: ${path}`);
  }
});
