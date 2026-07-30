import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
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
    "scripts/evozeus-cli.mjs",
    "SKILL.md",
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
    const content = entry === "contracts/v1/manifest.json"
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
      entry === "contracts/v1/manifest.json"
        ? `${JSON.stringify({ bundle_version: "v1.0.0", runtime_compatibility: { min_inclusive: "0.1.0", max_exclusive: "0.3.0" } })}\n`
        : entry.endsWith(".py")
          ? `print(${JSON.stringify(`${componentId}:${marker}`)})\n`
        : `${componentId}:${marker}\n`
    );
  }
  const archive = join(root, `${componentId}.tar.gz`);
  execFileSync("tar", ["-czf", archive, "-C", source, basename(top)]);
  const bytes = readFileSync(archive);
  return { archive, sha256: `sha256:${sha256(bytes)}` };
}

function stableManifest(root) {
  const commits = {
    evozeus: "1".repeat(40),
    coevolve: "3".repeat(40)
  };
  return {
    schema_version: "evozeus.product-channel.v2",
    product_version: "v0.4.0",
    channel: "stable",
    generated_at: "2026-07-26T00:00:00Z",
    components: Object.fromEntries(
      Object.keys(COMPONENT_PATHS).map((componentId) => {
        const archive = createArchive(root, componentId);
        return [
          componentId,
          {
            version: componentId === "coevolve" ? "v0.13.0" : "v0.4.0",
            commit: commits[componentId],
            source: {
              kind: "release_archive",
              url: `file://${archive.archive}`,
              ref: componentId === "evozeus" ? "v0.4.0" : "release",
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
  const root = mkdtempSync(join(tmpdir(), "evozeus-channels-"));
  try {
    return await callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function noSmoke(componentId) {
  return { component: componentId, status: "passed" };
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

  it("is idempotent for the same UAT manifest", async () =>
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
      const second = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: path,
        smokeRunner: noSmoke
      });
      assert.equal(second.status, "already_current");
      assert.equal(second.install_root, first.install_root);
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
      assert.ok(readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8").includes("evozeus.channel-coevolve-dispatcher.v1"));
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
      assert.ok(readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8").includes("evozeus.channel-coevolve-dispatcher.v1"));
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
        env: { ...process.env, EVOZEUS_HOME: home, EVOZEUS_UAT_MANIFEST: secondPath }
      });
      assert.equal(refreshed.status, 0, refreshed.stderr);
      const after = readChannelState(home).channels.uat.manifest_digest;
      assert.notEqual(after, before);
      assert.equal(readJsonReport(join(home, "state", "uat", "auto-refresh-last.json")).status, "installed");

      const broken = { ...uatManifest(components), components: { ...uatManifest(components).components } };
      broken.components.evozeus = { ...broken.components.evozeus, commit: "f".repeat(40) };
      const brokenPath = writeManifest(root, "uat-broken.json", broken);
      const continued = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: { ...process.env, EVOZEUS_HOME: home, EVOZEUS_UAT_MANIFEST: brokenPath }
      });
      assert.equal(continued.status, 0, continued.stderr);
      assert.equal(readChannelState(home).channels.uat.manifest_digest, after);
      assert.equal(readJsonReport(join(home, "state", "uat", "auto-refresh-last.json")).status, "failed_continuing_previous");
      assert.match(continued.stderr, /continuing the previous verified UAT/);
    }));
});

function readJsonReport(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("legacy diagnosis", () => {
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
