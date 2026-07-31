import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import {
  ChannelError,
  activateInstalledChannel,
  applyChannelUpdate,
  channelSnapshot,
  prepareChannelUpdate,
  productManifestDigest,
  readActiveChannel,
  readChannelState,
  rollbackChannel,
  resolveInstalledComponentRoot,
  sha256,
  validateProductManifest
} from "./evozeus-channels.mjs";

const COMPONENT_PATHS = {
  evozeus: [
    ".codex-plugin/plugin.json",
    ".claude-plugin/plugin.json",
    "hooks/hooks.json",
    "scripts/evozeus-cli.mjs",
    "scripts/evozeus-channels.mjs",
    "scripts/evozeus-hosts.mjs",
    "scripts/evozeus-coevolve-dispatcher.py",
    "scripts/evozeus-install.mjs",
    "scripts/evozeus-doctor.mjs",
    "scripts/evozeus-install-prefetch.sh",
    "scripts/evozeus-install-preflight.mjs",
    "scripts/evozeus-launcher.mjs",
    "SKILL.md",
    "skills/using-evozeus/SKILL.md",
    "skills/maintain-evozeus/SKILL.md",
    "packages/runtime/src/evozeus_runtime/cli/main.py",
    "packages/runtime/pyproject.toml",
    "packs/session-signal/scripts/validate_official_factor_spec.py",
    "packs/session-signal/SKILL.md",
    "packs/session-signal/factors/task-completion/spec.json"
  ],
  coevolve: ["scripts/evozeus_wrapper.py", "SKILL.md", "contracts/v1/manifest.json"]
};
const EMBEDDED = {
  runtime: {
    version: "v0.2.0",
    path: "packages/runtime",
    required_paths: ["src/evozeus_runtime/cli/main.py", "pyproject.toml"]
  },
  session_signal: {
    version: "v0.1.0",
    path: "packs/session-signal",
    required_paths: ["scripts/validate_official_factor_spec.py", "SKILL.md", "factors/task-completion/spec.json"]
  }
};
const LAUNCHER = fileURLToPath(new URL("./evozeus-launcher.mjs", import.meta.url));
const REAL_BOOTSTRAP = new Map(
  [
    ".codex-plugin/plugin.json",
    ".claude-plugin/plugin.json",
    "hooks/hooks.json",
    "scripts/evozeus-cli.mjs",
    "scripts/evozeus-channels.mjs",
    "scripts/evozeus-hosts.mjs",
    "scripts/evozeus-coevolve-dispatcher.py",
    "scripts/evozeus-install-prefetch.sh",
    "scripts/evozeus-install-preflight.mjs",
    "scripts/evozeus-launcher.mjs"
  ].map((entry) => [entry, readFileSync(new URL(`../${entry}`, import.meta.url), "utf8")])
);

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initComponent(root, componentId, marker = "one") {
  const repo = join(root, componentId);
  mkdirSync(repo, { recursive: true });
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "EvoZeus Test");
  for (const entry of COMPONENT_PATHS[componentId]) {
    const path = join(repo, entry);
    mkdirSync(dirname(path), { recursive: true });
    const content = REAL_BOOTSTRAP.has(entry)
      ? REAL_BOOTSTRAP.get(entry)
      : entry === "contracts/v1/manifest.json"
      ? `${JSON.stringify({ bundle_version: "v1.0.0", runtime_compatibility: { min_inclusive: "0.1.0", max_exclusive: "0.3.0" } })}\n`
      : componentId === "evozeus" && entry.endsWith("evozeus-cli.mjs")
      ? `console.log(JSON.stringify({ ok: true, marker: ${JSON.stringify(marker)} }));\n`
      : entry.endsWith(".py")
        ? `print(${JSON.stringify(`${componentId}:${marker}`)})\n`
        : `${componentId}:${marker}\n`;
    writeFileSync(path, content);
  }
  if (componentId === "evozeus") {
    writeFileSync(join(repo, "packages/runtime/src/evozeus_runtime/__init__.py"), "");
    writeFileSync(join(repo, "packages/runtime/src/evozeus_runtime/cli/__init__.py"), "");
  }
  writeFileSync(join(repo, "marker.txt"), `${marker}\n`);
  git(repo, "add", ".");
  git(repo, "commit", "-m", `fixture ${marker}`);
  return { repo, commit: git(repo, "rev-parse", "HEAD") };
}

function updateComponent(component, marker) {
  writeFileSync(join(component.repo, "marker.txt"), `${marker}\n`);
  git(component.repo, "add", "marker.txt");
  git(component.repo, "commit", "-m", `fixture ${marker}`);
  component.commit = git(component.repo, "rev-parse", "HEAD");
}

function uatManifest(components, productVersion = "v0.4.0") {
  return {
    schema_version: "evozeus.product-channel.v2",
    product_version: productVersion,
    channel: "uat",
    generated_at: "2026-07-26T00:00:00Z",
    components: Object.fromEntries(
      Object.entries(components).map(([componentId, component]) => [
        componentId,
        {
          version: componentId === "coevolve" ? "v0.13.0" : productVersion,
          commit: component.commit,
          source: { kind: "git", url: `file://${component.repo}`, ref: "uat/current" },
          required_paths: COMPONENT_PATHS[componentId]
        }
      ])
    ),
    embedded: EMBEDDED,
    compatibility: {
      runtime_min_inclusive: "0.1.0",
      runtime_max_exclusive: "0.3.0",
      coevolve_contract: "v1.0.0"
    }
  };
}

function createArchive(root, componentId, marker = "stable") {
  const source = join(root, `${componentId}-source`);
  const top = join(source, `${componentId}-archive`);
  mkdirSync(top, { recursive: true });
  for (const entry of COMPONENT_PATHS[componentId]) {
    const path = join(top, entry);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      REAL_BOOTSTRAP.has(entry)
        ? REAL_BOOTSTRAP.get(entry)
        : entry === "contracts/v1/manifest.json"
        ? `${JSON.stringify({ bundle_version: "v1.0.0", runtime_compatibility: { min_inclusive: "0.1.0", max_exclusive: "0.3.0" } })}\n`
        : componentId === "evozeus" && entry.endsWith("evozeus-cli.mjs")
          ? `console.log(JSON.stringify({ ok: true, marker: ${JSON.stringify(marker)} }));\n`
        : entry.endsWith(".py")
          ? `print(${JSON.stringify(`${componentId}:${marker}`)})\n`
        : `${componentId}:${marker}\n`
    );
  }
  if (componentId === "evozeus") {
    writeFileSync(join(top, "packages/runtime/src/evozeus_runtime/__init__.py"), "");
    writeFileSync(join(top, "packages/runtime/src/evozeus_runtime/cli/__init__.py"), "");
  }
  const archive = join(root, `${componentId}.tar.gz`);
  execFileSync("tar", ["-czf", archive, "-C", source, basename(top)]);
  const bytes = readFileSync(archive);
  return { archive, sha256: `sha256:${sha256(bytes)}` };
}

function stableManifest(root, productVersion = "v0.4.0", commitDigit = "1") {
  const commits = {
    evozeus: commitDigit.repeat(40),
    coevolve: "3".repeat(40)
  };
  return {
    schema_version: "evozeus.product-channel.v2",
    product_version: productVersion,
    channel: "stable",
    generated_at: "2026-07-26T00:00:00Z",
    components: Object.fromEntries(
      Object.keys(COMPONENT_PATHS).map((componentId) => {
        const archive = createArchive(root, componentId, `${productVersion}-${componentId}`);
        return [
          componentId,
          {
            version: componentId === "coevolve" ? "v0.13.0" : productVersion,
            commit: commits[componentId],
            source: {
              kind: "release_archive",
              url: `file://${archive.archive}`,
              ref: componentId === "evozeus" ? productVersion : "release",
              sha256: archive.sha256
            },
            required_paths: COMPONENT_PATHS[componentId]
          }
        ];
      })
    ),
    embedded: EMBEDDED,
    compatibility: {
      runtime_min_inclusive: "0.1.0",
      runtime_max_exclusive: "0.3.0",
      coevolve_contract: "v1.0.0"
    }
  };
}

function fileFetch(url) {
  const path = new URL(url);
  const bytes = readFileSync(path);
  return Promise.resolve(
    new Response(bytes, { status: 200, headers: { "content-type": "application/gzip" } })
  );
}

function writeManifest(root, name, manifest) {
  const path = join(root, name);
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
  return path;
}

async function fixture(callback) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "evozeus-channels-")));
  try {
    return await callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function noSmoke(componentId) {
  return { component: componentId, status: "passed" };
}

function runInstalledCli(cliPath, args, { home, path }) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: path,
      EVOZEUS_HOME: home,
      EVOZEUS_HOSTS_AVAILABLE: "codex",
      EVOZEUS_AUTO_UPDATE: "0",
      EVOZEUS_AUTO_UPDATE_CHILD: "1",
      EVOZEUS_APPROVE_FEEDBACK: "0",
      NODE_ENV: "test",
      EVOZEUS_PREFLIGHT_TEST_RELEASE_TAG: "v0.4.0"
    }
  });
}

function installedCliJson(cliPath, args, options) {
  const result = runInstalledCli(cliPath, args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

describe("product channel manifest", () => {
  it("accepts strict stable and uat manifests through code and JSON Schema", () =>
    fixture((root) => {
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const stable = stableManifest(join(root, "archives"));
      const uat = uatManifest(components);
      assert.deepEqual(validateProductManifest(stable, "stable"), []);
      assert.deepEqual(validateProductManifest(uat, "uat"), []);

      const schema = JSON.parse(
        readFileSync(new URL("../schemas/product-channel-manifest.schema.json", import.meta.url), "utf8")
      );
      const ajv = new Ajv2020({
        allErrors: true,
        strict: true,
        formats: {
          "date-time": (value) => !Number.isNaN(Date.parse(value)),
          uri: (value) => {
            try {
              new URL(value);
              return true;
            } catch {
              return false;
            }
          }
        }
      });
      const validate = ajv.compile(schema);
      assert.equal(validate(stable), true, JSON.stringify(validate.errors));
      assert.equal(validate(uat), true, JSON.stringify(validate.errors));
    }));

  it("rejects unknown channels, short commits, stable git sources, and extra fields", () =>
    fixture((root) => {
      const manifest = stableManifest(root);
      manifest.channel = "uat2";
      manifest.components.evozeus.commit = "abc";
      manifest.components.evozeus.source.kind = "git";
      manifest.compatibility.runtime_max_exclusive = "0.2.0";
      manifest.extra = true;
      const issues = validateProductManifest(manifest);
      assert.ok(issues.some((issue) => issue.includes("stable or uat")));
      assert.ok(issues.some((issue) => issue.includes("full lowercase Git SHA")));
      assert.ok(issues.some((issue) => issue.includes("not allowed")));
      assert.ok(issues.some((issue) => issue.includes("outside the product compatibility range")));
    }));
});

describe("channel transactions", () => {
  it("installs and overwrites one active UAT while retaining only rollback history", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const firstManifest = uatManifest(components);
      const firstPath = writeManifest(root, "uat-one.json", firstManifest);
      const first = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: firstPath,
        autoRefresh: true,
        smokeRunner: noSmoke
      });
      assert.equal(first.status, "installed");
      assert.equal(
        readFileSync(join(home, "skeleton/scripts/evozeus-channels.mjs"), "utf8"),
        readFileSync(join(first.component_roots.evozeus, "scripts/evozeus-channels.mjs"), "utf8")
      );
      assert.equal(
        readFileSync(join(home, "skeleton/scripts/evozeus-launcher.mjs"), "utf8"),
        readFileSync(join(first.component_roots.evozeus, "scripts/evozeus-launcher.mjs"), "utf8")
      );
      assert.equal(readActiveChannel(home).channel, "uat");
      assert.equal(readActiveChannel(home).auto_refresh, true);
      const firstCurrent = resolve(dirname(join(home, "worktrees", "uat", "current")), readlinkSync(join(home, "worktrees", "uat", "current")));

      updateComponent(components.evozeus, "fixed");
      const secondManifest = uatManifest(components);
      const secondPath = writeManifest(root, "uat-two.json", secondManifest);
      const second = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: secondPath,
        autoRefresh: true,
        smokeRunner: noSmoke
      });
      const secondCurrent = resolve(dirname(join(home, "worktrees", "uat", "current")), readlinkSync(join(home, "worktrees", "uat", "current")));
      assert.notEqual(firstCurrent, secondCurrent);
      assert.equal(readChannelState(home).channels.uat.previous.install_root, first.install_root);
      assert.equal(readFileSync(join(second.component_roots.evozeus, "marker.txt"), "utf8"), "fixed\n");
      assert.equal(second.embedded_roots.runtime, join(second.component_roots.evozeus, "packages/runtime"));
      assert.equal(channelSnapshot(home).active_channel, "uat");
      assert.equal(channelSnapshot(home).status, "ready");

      const rollback = rollbackChannel(home, "uat");
      assert.equal(rollback.status, "rolled_back");
      assert.equal(
        readFileSync(join(readChannelState(home).channels.uat.component_roots.evozeus, "marker.txt"), "utf8"),
        "one\n"
      );
      assert.equal(readActiveChannel(home).channel, "uat");
    }));

  it("keeps the previous UAT active when smoke validation fails", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const firstPath = writeManifest(root, "uat-one.json", uatManifest(components));
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: firstPath,
        smokeRunner: noSmoke
      });
      const digestBefore = readChannelState(home).channels.uat.manifest_digest;
      const currentBefore = readlinkSync(join(home, "worktrees", "uat", "current"));

      updateComponent(components.coevolve, "broken");
      const secondPath = writeManifest(root, "uat-two.json", uatManifest(components));
      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "uat",
          manifestSource: secondPath,
          smokeRunner: (componentId) => {
            if (componentId === "coevolve") throw new ChannelError("SMOKE_FAILED", "simulated smoke failure");
            return noSmoke(componentId);
          }
        }),
        /simulated smoke failure/
      );
      assert.equal(readChannelState(home).channels.uat.manifest_digest, digestBefore);
      assert.equal(readlinkSync(join(home, "worktrees", "uat", "current")), currentBefore);
    }));

  it("is a strict zero-write no-op for the same healthy UAT manifest", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const path = writeManifest(root, "uat.json", uatManifest(components));
      const first = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: path,
        smokeRunner: noSmoke
      });
      writeFileSync(join(home, "skeleton/scripts/evozeus-channels.mjs"), "legacy bootstrap\n");
      const second = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: path,
        smokeRunner: noSmoke
      });
      assert.equal(second.status, "already_current");
      assert.equal(second.decision, "healthy_noop");
      assert.equal(second.writes_now, false);
      assert.equal(second.install_root, first.install_root);
      assert.equal(
        readFileSync(join(home, "skeleton/scripts/evozeus-channels.mjs"), "utf8"),
        "legacy bootstrap\n"
      );
    }));

  it("repairs a damaged same-version UAT from a new verified root and retains rollback", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const manifestPath = writeManifest(root, "uat-repair.json", uatManifest(components));
      const installed = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      const customBootstrap = join(home, "skeleton", "scripts", "custom-helper.mjs");
      writeFileSync(customBootstrap, "preserve this non-bootstrap file\n");
      const missingPath = join(installed.component_roots.evozeus, "SKILL.md");
      rmSync(missingPath);
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      const activeBefore = readFileSync(join(home, "active-channel.json"), "utf8");
      const currentBefore = readlinkSync(join(home, "worktrees", "uat", "current"));
      const rootsBefore = readdirSync(join(home, "worktrees", "uat", "versions")).sort();
      const bootstrapBefore = Object.fromEntries(
        readdirSync(join(home, "skeleton", "scripts")).sort().map((name) => [
          name,
          readFileSync(join(home, "skeleton", "scripts", name), "utf8")
        ])
      );
      const dispatcherBefore = readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8");
      const dispatcherStateBefore = readFileSync(join(home, "hooks", "state.json"), "utf8");

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath
      });

      assert.equal(plan.decision, "repair");
      assert.equal(plan.repair_required, true);
      assert.ok(plan.current_integrity.issues.includes("component:evozeus:missing:SKILL.md"));
      assert.equal(plan.writes_now, false);
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readlinkSync(join(home, "worktrees", "uat", "current")), currentBefore);
      assert.equal(existsSync(missingPath), false);

      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "uat",
          manifestSource: manifestPath,
          smokeRunner: (componentId) => {
            if (componentId === "evozeus") throw new ChannelError("SMOKE_FAILED", "simulated repair failure");
            return noSmoke(componentId);
          }
        }),
        /simulated repair failure/
      );
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readFileSync(join(home, "active-channel.json"), "utf8"), activeBefore);
      assert.equal(readlinkSync(join(home, "worktrees", "uat", "current")), currentBefore);
      assert.deepEqual(readdirSync(join(home, "worktrees", "uat", "versions")).sort(), rootsBefore);

      let bootstrapCopies = 0;
      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "uat",
          manifestSource: manifestPath,
          smokeRunner: noSmoke,
          bootstrapCopy: (source, target) => {
            bootstrapCopies += 1;
            if (bootstrapCopies === 3) throw new Error("simulated bootstrap copy failure");
            cpSync(source, target);
          }
        }),
        /simulated bootstrap copy failure/
      );
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readFileSync(join(home, "active-channel.json"), "utf8"), activeBefore);
      assert.equal(readlinkSync(join(home, "worktrees", "uat", "current")), currentBefore);
      assert.deepEqual(readdirSync(join(home, "worktrees", "uat", "versions")).sort(), rootsBefore);
      assert.deepEqual(
        Object.fromEntries(
          readdirSync(join(home, "skeleton", "scripts")).sort().map((name) => [
            name,
            readFileSync(join(home, "skeleton", "scripts", name), "utf8")
          ])
        ),
        bootstrapBefore
      );
      assert.equal(readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8"), dispatcherBefore);
      assert.equal(readFileSync(join(home, "hooks", "state.json"), "utf8"), dispatcherStateBefore);

      const repaired = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      const entry = readChannelState(home).channels.uat;

      assert.equal(repaired.status, "repaired");
      assert.equal(repaired.decision, "repair");
      assert.notEqual(repaired.install_root, installed.install_root);
      assert.equal(entry.previous.install_root, installed.install_root);
      assert.equal(existsSync(installed.install_root), true);
      assert.equal(existsSync(join(entry.component_roots.evozeus, "SKILL.md")), true);
      assert.equal(readFileSync(customBootstrap, "utf8"), "preserve this non-bootstrap file\n");
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("routes a damaged active dispatcher through repair", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "archives"));
      const manifestPath = writeManifest(root, "stable-dispatcher-repair.json", manifest);
      const installed = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      rmSync(join(home, "hooks", "state.json"));

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch
      });
      assert.equal(plan.decision, "repair");
      assert.ok(plan.current_integrity.issues.includes("dispatcher_state:missing"));

      const repaired = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      assert.equal(repaired.status, "repaired");
      assert.notEqual(repaired.install_root, installed.install_root);
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("repairs a current link that no longer targets the installed entry", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "archives"));
      const manifestPath = writeManifest(root, "stable-link-repair.json", manifest);
      const installed = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      const currentLink = join(home, "releases", "stable", "current");
      const wrongRoot = join(home, "releases", "stable", "wrong-root");
      mkdirSync(wrongRoot);
      unlinkSync(currentLink);
      symlinkSync(wrongRoot, currentLink, "dir");
      assert.equal(channelSnapshot(home).health, "channel_integrity_mismatch");

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch
      });
      assert.equal(plan.decision, "repair");
      assert.ok(plan.current_integrity.issues.includes("current_link:target_mismatch"));

      const repaired = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      assert.equal(repaired.status, "repaired");
      assert.notEqual(repaired.install_root, installed.install_root);
      assert.equal(resolve(dirname(currentLink), readlinkSync(currentLink)), repaired.install_root);
      assert.equal(readChannelState(home).channels.stable.install_root, repaired.install_root);
    }));

  it("stops on same-manifest symlink evidence without writing a repair", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const manifestPath = writeManifest(root, "uat-unsafe.json", uatManifest(components));
      const installed = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      const requiredPath = join(installed.component_roots.evozeus, "SKILL.md");
      const outside = join(root, "outside-skill.md");
      writeFileSync(outside, "outside\n");
      rmSync(requiredPath);
      symlinkSync(outside, requiredPath);
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      assert.equal(channelSnapshot(home).health, "state_unverifiable");

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath
      });
      assert.equal(plan.decision, "unsafe_stop");
      assert.equal(plan.unsafe_state, true);
      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "uat",
          manifestSource: manifestPath,
          smokeRunner: noSmoke
        }),
        (error) => error.code === "LOCAL_STATE_UNSAFE"
      );
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
    }));

  it("fails closed on a self-consistent but structurally incomplete installed manifest", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "malformed-installed-archives"));
      const manifestPath = writeManifest(root, "malformed-installed-target.json", manifest);
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      const state = readChannelState(home);
      state.channels.stable.manifest = {
        ...state.channels.stable.manifest,
        components: {}
      };
      state.channels.stable.manifest_digest = productManifestDigest(state.channels.stable.manifest);
      writeFileSync(join(home, "channel-state.json"), `${JSON.stringify(state, null, 2)}\n`);
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");

      const snapshot = channelSnapshot(home);
      assert.equal(snapshot.health, "state_unverifiable");
      assert.equal(snapshot.integrity.status, "unsafe");
      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch
      });
      assert.equal(plan.decision, "unsafe_stop");
      assert.ok(plan.current_integrity.issues.some((issue) => issue.includes("components.evozeus is required")));
      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "stable",
          manifestSource: manifestPath,
          fetchImpl: fileFetch,
          smokeRunner: noSmoke
        }),
        (error) => error.code === "LOCAL_STATE_UNSAFE"
      );
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
    }));

  it("stops an update when rollback history points outside EVOZEUS_HOME", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const firstManifest = uatManifest(components);
      const firstPath = writeManifest(root, "uat-safe-current.json", firstManifest);
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: firstPath,
        smokeRunner: noSmoke
      });
      const state = readChannelState(home);
      const outsideRoot = join(root, "outside-rollback");
      mkdirSync(outsideRoot);
      state.channels.uat.previous = {
        ...state.channels.uat,
        install_root: outsideRoot,
        component_roots: {
          evozeus: join(outsideRoot, "evozeus"),
          coevolve: join(outsideRoot, "coevolve")
        },
        embedded_roots: {
          runtime: join(outsideRoot, "evozeus", "packages/runtime"),
          session_signal: join(outsideRoot, "evozeus", "packs/session-signal")
        },
        previous: null
      };
      writeFileSync(join(home, "channel-state.json"), `${JSON.stringify(state, null, 2)}\n`);
      updateComponent(components.evozeus, "newer");
      const updatePath = writeManifest(root, "uat-newer.json", uatManifest(components, "v0.4.1"));
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: updatePath
      });
      assert.equal(plan.decision, "unsafe_stop");
      assert.ok(plan.current_integrity.issues.includes("previous:install_root:unsafe"));
      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "uat",
          manifestSource: updatePath,
          smokeRunner: noSmoke
        }),
        (error) => error.code === "LOCAL_STATE_UNSAFE"
      );
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
    }));

  it("revalidates and reuses the prior UAT root when uat/current points back to it", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const firstPath = writeManifest(root, "uat-one.json", uatManifest(components));
      const first = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: firstPath,
        smokeRunner: noSmoke
      });

      updateComponent(components.evozeus, "two");
      const secondPath = writeManifest(root, "uat-two.json", uatManifest(components, "v0.3.1"));
      const second = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: secondPath,
        smokeRunner: noSmoke
      });

      const restored = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: firstPath,
        smokeRunner: noSmoke
      });
      const state = readChannelState(home).channels.uat;
      assert.equal(restored.status, "reused_verified");
      assert.equal(restored.install_root, first.install_root);
      assert.equal(state.install_root, first.install_root);
      assert.equal(state.previous.install_root, second.install_root);
      assert.equal(resolve(dirname(join(home, "worktrees", "uat", "current")), readlinkSync(join(home, "worktrees", "uat", "current"))), first.install_root);
    }));

  it("installs stable archives separately and dry-run does not write", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "archives"));
      const path = writeManifest(root, "stable.json", manifest);
      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: path,
        fetchImpl: fileFetch
      });
      assert.equal(plan.decision, "install");
      assert.equal(plan.writes_now, false);
      assert.equal(readChannelState(home).channels.stable, null);

      const applied = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: path,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      assert.equal(applied.status, "installed");
      assert.equal(readActiveChannel(home).channel, "stable");
      assert.ok(applied.install_root.includes("releases/stable/v0.4.0"));
      assert.ok(!applied.install_root.includes("worktrees/uat"));
    }));

  it("fails closed without writes when persisted channel control JSON is invalid", async () =>
    fixture(async (root) => {
      const manifest = stableManifest(join(root, "invalid-control-archives"));
      const manifestPath = writeManifest(root, "invalid-control-stable.json", manifest);
      const validEmptyState = `${JSON.stringify({
        schema_version: "evozeus.channel-state.v1",
        channels: { stable: null, uat: null },
        last_transaction: null
      })}\n`;
      const cases = [
        {
          name: "channel-json",
          files: { "channel-state.json": "{invalid\n" },
          issue: "channel_state:invalid"
        },
        {
          name: "channel-schema",
          files: { "channel-state.json": '{"schema_version":"wrong","channels":{}}\n' },
          issue: "channel_state:invalid"
        },
        {
          name: "active-json",
          files: { "channel-state.json": validEmptyState, "active-channel.json": "{invalid\n" },
          issue: "active_channel:invalid"
        },
        {
          name: "active-schema",
          files: {
            "channel-state.json": validEmptyState,
            "active-channel.json": '{"schema_version":"wrong","channel":"stable"}\n'
          },
          issue: "active_channel:invalid"
        },
        {
          name: "active-without-state",
          files: {
            "active-channel.json": '{"schema_version":"evozeus.active-channel.v1","channel":"stable"}\n'
          },
          issue: "channel_state:missing_with_active_channel"
        }
      ];

      for (const fixtureCase of cases) {
        const home = join(root, fixtureCase.name);
        mkdirSync(home);
        for (const [name, content] of Object.entries(fixtureCase.files)) {
          writeFileSync(join(home, name), content);
        }
        const before = Object.fromEntries(
          readdirSync(home).sort().map((name) => [name, readFileSync(join(home, name), "utf8")])
        );
        let fetchCalls = 0;
        const plan = await prepareChannelUpdate({
          evozeusHome: home,
          channel: "stable",
          manifestSource: "https://example.invalid/evozeus-product-stable.json",
          fetchImpl: async () => {
            fetchCalls += 1;
            throw new Error("unsafe local state must stop before manifest fetch");
          }
        });
        assert.equal(plan.decision, "unsafe_stop", fixtureCase.name);
        assert.ok(plan.current_integrity.issues.includes(fixtureCase.issue), fixtureCase.name);
        assert.equal(fetchCalls, 0, fixtureCase.name);
        await assert.rejects(
          applyChannelUpdate({
            evozeusHome: home,
            channel: "stable",
            manifestSource: manifestPath,
            fetchImpl: fileFetch,
            smokeRunner: noSmoke
          }),
          (error) => error.code === "LOCAL_STATE_UNSAFE"
        );
        assert.deepEqual(
          Object.fromEntries(readdirSync(home).sort().map((name) => [name, readFileSync(join(home, name), "utf8")])),
          before,
          fixtureCase.name
        );
      }
    }));

  it("stops before manifest fetch when a target channel or skeleton write parent is symlinked", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(root, "uat-before-unsafe-stable.json", uatManifest(components)),
        smokeRunner: noSmoke
      });
      const stableManifestValue = stableManifest(join(root, "unsafe-write-archives"));
      const stableManifestPath = writeManifest(root, "stable-after-unsafe-parent.json", stableManifestValue);
      const outsideRelease = join(root, "outside-release");
      const outsideSkeleton = join(root, "outside-skeleton");
      mkdirSync(outsideRelease);
      mkdirSync(outsideSkeleton);
      symlinkSync(outsideRelease, join(home, "releases"), "dir");
      rmSync(join(home, "skeleton", "scripts"), { recursive: true });
      symlinkSync(outsideSkeleton, join(home, "skeleton", "scripts"), "dir");
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      let fetchCalls = 0;

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: "https://example.invalid/evozeus-product-stable.json",
        fetchImpl: async () => {
          fetchCalls += 1;
          throw new Error("unsafe write roots must stop before manifest fetch");
        }
      });

      assert.equal(plan.decision, "unsafe_stop");
      assert.ok(plan.current_integrity.issues.includes("write_root:stable_channel:unsafe"));
      assert.ok(plan.current_integrity.issues.includes("write_root:skeleton_scripts:unsafe"));
      assert.equal(fetchCalls, 0);
      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "stable",
          manifestSource: stableManifestPath,
          fetchImpl: fileFetch,
          smokeRunner: noSmoke
        }),
        (error) => error.code === "LOCAL_STATE_UNSAFE"
      );
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.deepEqual(readdirSync(outsideRelease), []);
      assert.deepEqual(readdirSync(outsideSkeleton), []);
    }));

  it("stops before manifest fetch when a UAT Git mirror is an external symlink", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const cache = join(home, "cache", "git");
      const outsideMirror = join(root, "outside-evozeus-mirror");
      mkdirSync(cache, { recursive: true });
      mkdirSync(outsideMirror);
      symlinkSync(outsideMirror, join(cache, "evozeus.git"), "dir");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const manifestPath = writeManifest(root, "uat-after-unsafe-mirror.json", uatManifest(components));
      let fetchCalls = 0;

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: "https://example.invalid/uat.json",
        fetchImpl: async () => {
          fetchCalls += 1;
          throw new Error("unsafe UAT mirror must stop before manifest fetch");
        }
      });

      assert.equal(plan.decision, "unsafe_stop");
      assert.ok(plan.current_integrity.issues.includes("write_root:uat_git_mirror:evozeus:unsafe"));
      assert.equal(fetchCalls, 0);
      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "uat",
          manifestSource: manifestPath,
          smokeRunner: noSmoke
        }),
        (error) => error.code === "LOCAL_STATE_UNSAFE"
      );
      assert.deepEqual(readdirSync(outsideMirror), []);
      assert.deepEqual(readdirSync(home).sort(), ["cache"]);
    }));

  it("routes a broken Stable install through preflight, zero-write plan, approved repair, and healthy Doctor", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "repair-archives"));
      const manifestPath = writeManifest(root, "stable-repair.json", manifest);
      const installed = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      mkdirSync(join(home, "bin"), { recursive: true });
      writeFileSync(join(home, "bin", "evozeus"), "installed shim\n");
      const fakeBin = join(root, "bin");
      mkdirSync(fakeBin);
      const codex = join(fakeBin, "codex");
      writeFileSync(codex, "#!/bin/sh\nprintf '%s\\n' evozeus\n");
      chmodSync(codex, 0o755);
      const commandPath = `${fakeBin}:${process.env.PATH}`;
      const initialCli = join(installed.component_roots.evozeus, "scripts", "evozeus-cli.mjs");

      const initialAlignment = installedCliJson(
        initialCli,
        ["align", "--channel", "stable", "--host", "codex", "--manifest", manifestPath, "--approve-write", "--json"],
        { home, path: commandPath }
      );
      assert.equal(initialAlignment.data.update.status, "already_current");
      assert.equal(installedCliJson(initialCli, ["doctor", "--json"], { home, path: commandPath }).data.doctor_verdict, "ready");

      const missingRelative = "skills/using-evozeus/SKILL.md";
      const missingPath = join(installed.component_roots.evozeus, missingRelative);
      rmSync(missingPath);
      const brokenDoctor = installedCliJson(initialCli, ["doctor", "--json"], { home, path: commandPath });
      assert.equal(brokenDoctor.data.doctor_verdict, "repair_required");
      assert.match(brokenDoctor.data.next_command, /align --channel stable --host auto --json/);
      const preflight = installedCliJson(
        initialCli,
        ["install", "preflight", "--channel", "stable", "--json"],
        { home, path: commandPath }
      );
      assert.equal(preflight.local_state.status, "repair_required");
      assert.equal(preflight.next_action.action, "request_repair_approval");

      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      const activeBefore = readFileSync(join(home, "active-channel.json"), "utf8");
      const currentBefore = readlinkSync(join(home, "releases", "stable", "current"));
      const rootsBefore = readdirSync(join(home, "releases", "stable")).sort();
      const dryRun = installedCliJson(
        initialCli,
        ["align", "--channel", "stable", "--host", "codex", "--manifest", manifestPath, "--json"],
        { home, path: commandPath }
      );
      assert.equal(dryRun.operation, "system.alignPlan");
      assert.equal(dryRun.data.update.decision, "repair");
      assert.equal(dryRun.data.update.writes_now, false);
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readFileSync(join(home, "active-channel.json"), "utf8"), activeBefore);
      assert.equal(readlinkSync(join(home, "releases", "stable", "current")), currentBefore);
      assert.deepEqual(readdirSync(join(home, "releases", "stable")).sort(), rootsBefore);
      assert.equal(existsSync(missingPath), false);

      const approved = installedCliJson(
        initialCli,
        ["align", "--channel", "stable", "--host", "codex", "--manifest", manifestPath, "--approve-write", "--json"],
        { home, path: commandPath }
      );
      assert.equal(approved.operation, "system.align");
      assert.equal(approved.data.update.status, "repaired");
      assert.equal(approved.data.update.decision, "repair");
      const repairedEntry = readChannelState(home).channels.stable;
      assert.notEqual(repairedEntry.install_root, installed.install_root);
      assert.equal(repairedEntry.previous.install_root, installed.install_root);
      assert.equal(existsSync(installed.install_root), true);
      assert.equal(existsSync(join(repairedEntry.component_roots.evozeus, missingRelative)), true);
      const repairedCli = join(repairedEntry.component_roots.evozeus, "scripts", "evozeus-cli.mjs");
      const doctor = installedCliJson(repairedCli, ["doctor", "--json"], { home, path: commandPath });
      assert.equal(doctor.data.version.health, "healthy");
      assert.equal(doctor.data.doctor_verdict, "ready");
      const healthyPreflight = installedCliJson(
        repairedCli,
        ["install", "preflight", "--channel", "stable", "--json"],
        { home, path: commandPath }
      );
      assert.equal(healthyPreflight.local_state.status, "healthy_current");
      assert.equal(healthyPreflight.next_action.action, "report_noop");
    }));

  it("recovers an unreferenced partial Stable install after an interrupted update", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "archives"));
      const manifestPath = writeManifest(root, "stable.json", manifest);
      const digest = productManifestDigest(manifest);
      const staleRoot = join(
        home,
        "releases",
        "stable",
        `${manifest.product_version}-${digest.replace(/^sha256:/, "").slice(0, 16)}`
      );
      mkdirSync(join(staleRoot, "evozeus"), { recursive: true });
      writeFileSync(join(staleRoot, "evozeus", "interrupted.txt"), "partial\n");

      const applied = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });

      assert.equal(applied.status, "installed");
      assert.equal(applied.install_root, staleRoot);
      assert.equal(applied.recovered_interrupted_install, true);
      assert.equal(existsSync(join(staleRoot, "evozeus", "interrupted.txt")), false);
      assert.equal(readChannelState(home).channels.stable.install_root, staleRoot);
    }));

  it("keeps Stable and UAT component roots and runtime state separate", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const stable = stableManifest(join(root, "archives"));
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "stable.json", stable),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(root, "uat.json", uatManifest(components)),
        smokeRunner: noSmoke
      });
      const state = readChannelState(home);
      assert.notEqual(state.channels.stable.install_root, state.channels.uat.install_root);
      assert.ok(state.channels.stable.install_root.includes("releases/stable"));
      assert.ok(state.channels.uat.install_root.includes("worktrees/uat"));
      assert.equal(readActiveChannel(home).channel, "uat");
      activateInstalledChannel(home, "stable");
      assert.equal(readActiveChannel(home).channel, "stable");
      const resolved = resolveInstalledComponentRoot({
        evozeusHome: home,
        componentId: "runtime",
        sourceRoot: root,
        env: {}
      });
      assert.equal(resolved.root, state.channels.stable.embedded_roots.runtime);
      assert.equal(resolved.source, "channel:stable");
    }));

  it("backs up and migrates a legacy CoEvolve dispatcher to the active channel router", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      mkdirSync(join(home, "hooks"), { recursive: true });
      writeFileSync(join(home, "install-manifest.json"), `${JSON.stringify({ source: { resolved_commit: "a".repeat(40) } })}\n`);
      writeFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "# legacy dispatcher\n");
      writeFileSync(join(home, "hooks", "state.json"), `${JSON.stringify({ installed_version: "v0.10.0", wrapper_source: "/private/tmp/legacy" })}\n`);
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const result = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(root, "uat.json", uatManifest(components)),
        smokeRunner: noSmoke
      });

      const hookState = readJsonReport(join(home, "hooks", "state.json"));
      assert.equal(hookState.wrapper_source, "channel-managed");
      assert.equal(hookState.source_repository, "MetaInFLow/EvoZeus-CoEvolve");
      assert.ok(readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8").includes("evozeus.channel-coevolve-dispatcher.v2"));
      assert.ok(result.migration_backup);
      assert.equal(readFileSync(join(result.migration_backup, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8"), "# legacy dispatcher\n");
      assert.equal(channelSnapshot(home).dispatcher.status, "ready");
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("repairs a stale dispatcher when the single UAT candidate is overwritten", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const first = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(root, "uat-one.json", uatManifest(components)),
        smokeRunner: noSmoke
      });

      mkdirSync(join(home, "hooks"), { recursive: true });
      writeFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "# stale dispatcher\n");
      writeFileSync(
        join(home, "hooks", "state.json"),
        `${JSON.stringify({ installed_version: "v0.11.4", wrapper_source: "/private/tmp/stale-uat" })}\n`
      );
      updateComponent(components.coevolve, "uat-fix");

      const replaced = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(root, "uat-two.json", uatManifest(components, "v0.3.1")),
        smokeRunner: noSmoke
      });

      const hookState = readJsonReport(join(home, "hooks", "state.json"));
      assert.equal(replaced.status, "installed");
      assert.equal(readChannelState(home).channels.uat.previous.install_root, first.install_root);
      assert.equal(hookState.wrapper_source, "channel-managed");
      assert.equal(hookState.installed_version, "v0.13.0");
      assert.ok(readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8").includes("evozeus.channel-coevolve-dispatcher.v2"));
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("repairs a stale dispatcher when an installed UAT is explicitly activated", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(root, "uat.json", uatManifest(components)),
        smokeRunner: noSmoke
      });
      mkdirSync(join(home, "hooks"), { recursive: true });
      writeFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "# stale dispatcher\n");
      writeFileSync(
        join(home, "hooks", "state.json"),
        `${JSON.stringify({ installed_version: "v0.11.4", wrapper_source: "/private/tmp/stale-uat" })}\n`
      );

      activateInstalledChannel(home, "uat");

      assert.equal(readJsonReport(join(home, "hooks", "state.json")).wrapper_source, "channel-managed");
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("uses the active core when the skeleton host module is missing without rewriting it", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const manifestPath = writeManifest(root, "uat-bootstrap.json", uatManifest(components, "v0.4.1"));
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        autoRefresh: true,
        smokeRunner: noSmoke
      });
      const bootstrapHostModule = join(home, "skeleton", "scripts", "evozeus-hosts.mjs");
      rmSync(bootstrapHostModule, { force: true });

      const result = spawnSync(
        process.execPath,
        [join(home, "skeleton", "scripts", "evozeus-launcher.mjs"), "version", "--json"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            EVOZEUS_HOME: home,
            EVOZEUS_UAT_MANIFEST: manifestPath,
            EVOZEUS_HOSTS_AVAILABLE: "none",
            EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
          }
        }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.equal(existsSync(bootstrapHostModule), false);
      assert.equal(readChannelState(home).channels.uat.manifest.product_version, "v0.4.1");
    }));

  it("auto-refreshes the same active UAT and continues the previous UAT when a later refresh fails", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const firstPath = writeManifest(root, "uat-one.json", uatManifest(components));
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: firstPath,
        autoRefresh: true,
        smokeRunner: noSmoke
      });
      const before = readChannelState(home).channels.uat.manifest_digest;

      updateComponent(components.evozeus, "fixed-in-runtime");
      const secondPath = writeManifest(root, "uat-two.json", uatManifest(components));
      const refreshed = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          EVOZEUS_HOME: home,
          EVOZEUS_UAT_MANIFEST: secondPath,
          EVOZEUS_HOSTS_AVAILABLE: "none",
          EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
        }
      });
      assert.equal(refreshed.status, 0, refreshed.stderr);
      const after = readChannelState(home).channels.uat.manifest_digest;
      assert.notEqual(after, before);
      assert.equal(readJsonReport(join(home, "state", "uat", "auto-refresh-last.json")).status, "updated");
      assert.match(refreshed.stderr, /EvoZeus · 发现更新/);
      assert.match(refreshed.stderr, /EvoZeus · 自动更新中/);
      assert.match(refreshed.stderr, /EvoZeus · 自动更新完成/);

      const broken = { ...uatManifest(components), components: { ...uatManifest(components).components } };
      broken.components.evozeus = { ...broken.components.evozeus, commit: "f".repeat(40) };
      const brokenPath = writeManifest(root, "uat-broken.json", broken);
      const continued = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          EVOZEUS_HOME: home,
          EVOZEUS_UAT_MANIFEST: brokenPath,
          EVOZEUS_HOSTS_AVAILABLE: "none",
          EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
        }
      });
      assert.equal(continued.status, 0, continued.stderr);
      assert.equal(readChannelState(home).channels.uat.manifest_digest, after);
      assert.equal(readJsonReport(join(home, "state", "uat", "auto-refresh-last.json")).status, "failed_continuing_previous");
      assert.match(continued.stderr, /EvoZeus · 自动更新失败/);
    }));

  it("automatically updates Stable as one product and records the visible lifecycle", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const first = stableManifest(join(root, "stable-one"), "v0.4.0", "1");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "stable-one.json", first),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });

      const second = stableManifest(join(root, "stable-two"), "v0.4.1", "4");
      const secondPath = writeManifest(root, "stable-two.json", second);
      const updated = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          EVOZEUS_HOME: home,
          EVOZEUS_STABLE_MANIFEST: secondPath,
          EVOZEUS_HOSTS_AVAILABLE: "none",
          EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
        }
      });

      assert.equal(updated.status, 0, updated.stderr);
      assert.equal(readChannelState(home).channels.stable.manifest.product_version, "v0.4.1");
      assert.equal(readJsonReport(join(home, "state", "stable", "auto-update-last.json")).status, "updated");
      assert.match(updated.stderr, /EvoZeus · 发现更新/);
      assert.match(updated.stderr, /EvoZeus · 自动更新中/);
      assert.match(updated.stderr, /EvoZeus · 自动更新完成/);
    }));

  it("respects a disabled automatic update policy without changing the active product", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const first = stableManifest(join(root, "stable-policy-one"), "v0.4.0", "1");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "stable-policy-one.json", first),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      writeFileSync(
        join(home, "update-policy.json"),
        `${JSON.stringify({
          schema_version: "evozeus.update-policy.v1",
          enabled: false,
          check_interval_seconds: 0,
          channels: { stable: true, uat: true }
        })}\n`
      );
      const second = stableManifest(join(root, "stable-policy-two"), "v0.4.1", "4");
      const result = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          EVOZEUS_HOME: home,
          EVOZEUS_STABLE_MANIFEST: writeManifest(root, "stable-policy-two.json", second),
          EVOZEUS_HOSTS_AVAILABLE: "none"
        }
      });

      assert.equal(result.status, 0, result.stderr);
      assert.equal(readChannelState(home).channels.stable.manifest.product_version, "v0.4.0");
      assert.doesNotMatch(result.stderr, /EvoZeus ·/);
    }));
});

function readJsonReport(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("legacy diagnosis", () => {
  it("reports an active v1 channel as migration_required without crashing", () =>
    fixture((root) => {
      const home = join(root, ".evozeus");
      mkdirSync(home, { recursive: true });
      writeFileSync(
        join(home, "active-channel.json"),
        `${JSON.stringify({ schema_version: "evozeus.active-channel.v1", channel: "uat", auto_refresh: false })}\n`
      );
      writeFileSync(
        join(home, "channel-state.json"),
        `${JSON.stringify({
          schema_version: "evozeus.channel-state.v1",
          channels: {
            stable: null,
            uat: {
              manifest: {
                schema_version: "evozeus.product-channel.v1",
                product_version: "v0.3.5",
                channel: "uat",
                components: {
                  evozeus: { version: "v0.3.5", commit: "a".repeat(40) },
                  coevolve: { version: "v0.13.1", commit: "b".repeat(40) },
                  infra: { version: "v0.2.0", commit: "c".repeat(40) },
                  session_signal: { version: "v0.1.0", commit: "d".repeat(40) }
                }
              },
              manifest_digest: `sha256:${"e".repeat(64)}`,
              install_root: join(home, "worktrees/uat/legacy"),
              component_roots: {}
            }
          }
        })}\n`
      );

      const snapshot = channelSnapshot(home);
      assert.equal(snapshot.active_channel, "uat");
      assert.equal(snapshot.product_version, "v0.3.5");
      assert.equal(snapshot.status, "legacy");
      assert.equal(snapshot.health, "migration_required");
      assert.equal(snapshot.legacy.manifest_schema, "evozeus.product-channel.v1");
    }));

  it("reports an unreleased install and temporary CoEvolve source as migration_required", () =>
    fixture((root) => {
      const home = join(root, ".evozeus");
      mkdirSync(join(home, "hooks"), { recursive: true });
      mkdirSync(join(home, "skeleton", "scripts"), { recursive: true });
      writeFileSync(
        join(home, "install-manifest.json"),
        `${JSON.stringify({ source: { resolved_commit: "a".repeat(40), exact_tag: null } })}\n`
      );
      writeFileSync(join(home, "skeleton", "scripts", "evozeus-cli.mjs"), "// old cli\n");
      writeFileSync(
        join(home, "hooks", "state.json"),
        `${JSON.stringify({ installed_version: "v0.11.4", wrapper_source: "/private/tmp/coevolve" })}\n`
      );
      const snapshot = channelSnapshot(home);
      assert.equal(snapshot.status, "legacy");
      assert.equal(snapshot.health, "migration_required");
      assert.ok(snapshot.legacy.issues.some((issue) => issue.includes("not an exact release tag")));
      assert.ok(snapshot.legacy.issues.some((issue) => issue.includes("temporary directory")));
    }));
});
