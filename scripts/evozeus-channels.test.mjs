import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
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
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import {
  ChannelError,
  activateInstalledChannel,
  applyChannelUpdate,
  channelRecoveryIncomplete,
  channelSnapshot,
  prepareChannelUpdate,
  productManifestDigest,
  readActiveChannel,
  readChannelState,
  refreshChannelBootstrap,
  rollbackChannel,
  resolveInstalledComponentRoot,
  sha256,
  validateProductManifest
} from "./evozeus-channels.mjs";
import { alignPluginHosts } from "./evozeus-hosts.mjs";

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
        ? entry.endsWith("evozeus-launcher.mjs")
          ? `${REAL_BOOTSTRAP.get(entry)}\n// fixture bootstrap: ${marker}\n`
          : REAL_BOOTSTRAP.get(entry)
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

function primeCodexPlugin(home, entry) {
  return alignPluginHosts({
    evozeusHome: home,
    sourceRoot: entry.component_roots.evozeus,
    channel: entry.manifest.channel,
    productVersion: entry.manifest.product_version,
    commit: entry.manifest.components.evozeus.commit,
    hosts: ["codex"],
    runCommand: () => ({ status: 0, stdout: "", stderr: "" })
  });
}

function flakyCodexCommand(root) {
  const bin = join(root, "fake-host-bin");
  const counter = join(root, "fake-codex-registration-count");
  const command = join(bin, "codex");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    command,
    `#!/bin/sh
if [ "\${1:-}" = "plugin" ] && [ "\${2:-}" = "list" ]; then
  printf '%s\\n' 'evozeus'
  exit 0
fi
count=0
if [ -f "$EVOZEUS_TEST_HOST_COUNTER" ]; then
  count=$(cat "$EVOZEUS_TEST_HOST_COUNTER")
fi
count=$((count + 1))
printf '%s\\n' "$count" > "$EVOZEUS_TEST_HOST_COUNTER"
failures=\${EVOZEUS_TEST_HOST_FAILURES:-1}
if [ "$count" -le "$failures" ]; then
  printf '%s\\n' 'injected Plugin registration failure' >&2
  exit 73
fi
exit 0
`
  );
  chmodSync(command, 0o755);
  return { bin, counter };
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

function treeInventory(root) {
  const inventory = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const stats = lstatSync(path);
      inventory.push({
        path: relative(root, path),
        kind: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "symlink" : "file",
        size: stats.size,
        mtime_ms: stats.mtimeMs
      });
      if (entry.isDirectory()) visit(path);
    }
  };
  visit(root);
  return inventory;
}

function runInstalledCli(cliPath, args, { home, path, env = {} }) {
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
      EVOZEUS_PREFLIGHT_TEST_RELEASE_TAG: "v0.4.0",
      ...env
    }
  });
}

function installedCliJson(cliPath, args, options) {
  const result = runInstalledCli(cliPath, args, options);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

describe("product channel manifest", () => {
  it("classifies channel rollback failures as incomplete recovery", () => {
    for (const code of [
      "UPDATE_ROLLBACK_FAILED",
      "ACTIVATION_ROLLBACK_FAILED",
      "BOOTSTRAP_ROLLBACK_FAILED",
      "ROLLBACK_TRANSACTION_FAILED"
    ]) {
      assert.equal(channelRecoveryIncomplete({ code }), true, code);
    }
    assert.equal(channelRecoveryIncomplete({ code: "SMOKE_FAILED" }), false);
  });

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

  it("refuses to activate rollback history that fails structure, compatibility, or smoke checks", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const first = stableManifest(join(root, "rollback-integrity-one"), "v0.4.0", "1");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "rollback-integrity-one.json", first),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const second = stableManifest(join(root, "rollback-integrity-two"), "v0.4.1", "4");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "rollback-integrity-two.json", second),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });

      const previous = readChannelState(home).channels.stable.previous;
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      const currentLink = join(home, "releases", "stable", "current");
      const linkBefore = readlinkSync(currentLink);
      const bootstrapPath = join(home, "skeleton", "scripts", "evozeus-launcher.mjs");
      const bootstrapBefore = readFileSync(bootstrapPath, "utf8");
      const assertRejectedWithoutActivation = (expectedIssue) => {
        assert.throws(
          () => rollbackChannel(home, "stable"),
          (error) => error.code === "ROLLBACK_STATE_UNHEALTHY"
            && error.details.issues.some((issue) => issue.includes(expectedIssue))
        );
        assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
        assert.equal(readlinkSync(currentLink), linkBefore);
        assert.equal(readFileSync(bootstrapPath, "utf8"), bootstrapBefore);
      };

      const skillPath = join(previous.component_roots.evozeus, "SKILL.md");
      const skillBefore = readFileSync(skillPath, "utf8");
      rmSync(skillPath);
      assertRejectedWithoutActivation("component:evozeus:missing:SKILL.md");
      writeFileSync(skillPath, skillBefore);

      const embeddedPath = join(previous.embedded_roots.runtime, "pyproject.toml");
      const embeddedBefore = readFileSync(embeddedPath, "utf8");
      rmSync(embeddedPath);
      assertRejectedWithoutActivation("embedded:runtime:missing:pyproject.toml");
      writeFileSync(embeddedPath, embeddedBefore);

      const contractPath = join(previous.component_roots.coevolve, "contracts", "v1", "manifest.json");
      const contractBefore = readFileSync(contractPath, "utf8");
      writeFileSync(contractPath, `${JSON.stringify({
        bundle_version: "v9.0.0",
        runtime_compatibility: { min_inclusive: "0.1.0", max_exclusive: "0.3.0" }
      })}\n`);
      assertRejectedWithoutActivation("compatibility:COEVOLVE_CONTRACT_MISMATCH");
      writeFileSync(contractPath, contractBefore);

      const cliPath = join(previous.component_roots.evozeus, "scripts", "evozeus-cli.mjs");
      const cliBefore = readFileSync(cliPath, "utf8");
      writeFileSync(cliPath, "process.exit(17);\n");
      assertRejectedWithoutActivation("component:evozeus:smoke:COMMAND_FAILED");
      writeFileSync(cliPath, cliBefore);

      const runtimeCliPath = join(previous.embedded_roots.runtime, "src", "evozeus_runtime", "cli", "main.py");
      const runtimeCliBefore = readFileSync(runtimeCliPath, "utf8");
      writeFileSync(runtimeCliPath, "raise SystemExit(17)\n");
      assertRejectedWithoutActivation("embedded:runtime:smoke:COMMAND_FAILED");
      writeFileSync(runtimeCliPath, runtimeCliBefore);

      const wrapperPath = join(previous.component_roots.coevolve, "scripts", "evozeus_wrapper.py");
      const wrapperBefore = readFileSync(wrapperPath, "utf8");
      writeFileSync(join(previous.component_roots.coevolve, "scripts", "smoke_helper.py"), "VALUE = 1\n");
      writeFileSync(wrapperPath, `import smoke_helper\n${wrapperBefore}`);
      const inventoryBefore = treeInventory(previous.install_root);
      const rollback = rollbackChannel(home, "stable");
      assert.equal(rollback.status, "rolled_back");
      assert.deepEqual(treeInventory(previous.install_root), inventoryBefore);
    }));

  it("restores the active channel bootstrap when an inactive-channel rollback fails", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const stableOne = stableManifest(join(root, "inactive-rollback-stable-one"), "v0.4.0", "1");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "inactive-rollback-stable-one.json", stableOne),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const stableTwo = stableManifest(join(root, "inactive-rollback-stable-two"), "v0.4.1", "4");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "inactive-rollback-stable-two.json", stableTwo),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(root, "inactive-rollback-uat.json", uatManifest(components, "v0.4.1")),
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      const stableLink = join(home, "releases", "stable", "current");
      const stableLinkBefore = readlinkSync(stableLink);
      const bootstrapPath = join(home, "skeleton", "scripts", "evozeus-launcher.mjs");
      const bootstrapBefore = readFileSync(bootstrapPath, "utf8");
      assert.equal(readActiveChannel(home).channel, "uat");

      assert.throws(
        () => rollbackChannel(home, "stable", {
          bootstrapCopy: () => {
            throw new Error("simulated inactive rollback bootstrap failure");
          }
        }),
        /simulated inactive rollback bootstrap failure/
      );

      assert.equal(readActiveChannel(home).channel, "uat");
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readlinkSync(stableLink), stableLinkBefore);
      assert.equal(readFileSync(bootstrapPath, "utf8"), bootstrapBefore);
      assert.doesNotMatch(bootstrapBefore, /fixture bootstrap:/);
      assert.equal(channelSnapshot(home).dispatcher.status, "ready");
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
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      const activeBefore = readFileSync(join(home, "active-channel.json"), "utf8");
      const bootstrapPath = join(home, "skeleton/scripts/evozeus-channels.mjs");
      const bootstrapBefore = readFileSync(bootstrapPath, "utf8");
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
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readFileSync(join(home, "active-channel.json"), "utf8"), activeBefore);
      assert.equal(readFileSync(bootstrapPath, "utf8"), bootstrapBefore);
    }));

  it("routes damaged or missing active bootstrap files through repair", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const manifestPath = writeManifest(root, "uat-bootstrap-repair.json", uatManifest(components));
      const installed = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      const bootstrapPath = join(home, "skeleton", "scripts", "evozeus-channels.mjs");
      const sourceBootstrap = join(installed.component_roots.evozeus, "scripts", "evozeus-channels.mjs");
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      const activeBefore = readFileSync(join(home, "active-channel.json"), "utf8");

      writeFileSync(bootstrapPath, "damaged bootstrap\n");
      const damaged = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath
      });
      assert.equal(damaged.decision, "repair");
      assert.ok(damaged.current_integrity.issues.includes("bootstrap:evozeus-channels.mjs:content_mismatch"));
      assert.equal(readFileSync(bootstrapPath, "utf8"), "damaged bootstrap\n");
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readFileSync(join(home, "active-channel.json"), "utf8"), activeBefore);

      writeFileSync(bootstrapPath, readFileSync(sourceBootstrap));
      rmSync(bootstrapPath);
      const missing = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath
      });
      assert.equal(missing.decision, "repair");
      assert.ok(missing.current_integrity.issues.includes("bootstrap:evozeus-channels.mjs:missing"));
      assert.equal(existsSync(bootstrapPath), false);
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readFileSync(join(home, "active-channel.json"), "utf8"), activeBefore);

      const repaired = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      assert.equal(repaired.status, "repaired");
      assert.equal(repaired.decision, "repair");
      assert.notEqual(repaired.install_root, installed.install_root);
      assert.equal(
        readFileSync(bootstrapPath, "utf8"),
        readFileSync(join(repaired.component_roots.evozeus, "scripts", "evozeus-channels.mjs"), "utf8")
      );
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("restores a missing primary CLI from the independent recovery shim", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const manifestPath = writeManifest(root, "uat-cli-repair.json", uatManifest(components));
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      const binRoot = join(home, "bin");
      const primaryCli = join(binRoot, "evozeus");
      const recoveryCli = join(binRoot, "evozeus-repair");
      mkdirSync(binRoot, { recursive: true });
      writeFileSync(recoveryCli, "#!/bin/sh\nprintf '%s\\n' recovery\n");
      chmodSync(recoveryCli, 0o755);

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath
      });
      assert.equal(plan.decision, "repair");
      assert.ok(plan.current_integrity.issues.includes("cli:missing"));

      const repaired = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      assert.equal(repaired.status, "repaired");
      assert.equal(readFileSync(primaryCli, "utf8"), readFileSync(recoveryCli, "utf8"));
      assert.equal(lstatSync(primaryCli).isFile(), true);
      assert.equal(lstatSync(primaryCli).mode & 0o111, 0o111);
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("repairs a corrupted non-executable primary CLI from the recovery shim", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const manifestPath = writeManifest(root, "uat-cli-integrity-repair.json", uatManifest(components));
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      const binRoot = join(home, "bin");
      const primaryCli = join(binRoot, "evozeus");
      const recoveryCli = join(binRoot, "evozeus-repair");
      mkdirSync(binRoot, { recursive: true });
      writeFileSync(recoveryCli, "#!/bin/sh\nprintf '%s\\n' recovery\n");
      chmodSync(recoveryCli, 0o755);
      writeFileSync(primaryCli, "truncated\n");
      chmodSync(primaryCli, 0o644);

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath
      });
      assert.equal(plan.decision, "repair");
      assert.ok(plan.current_integrity.issues.includes("cli:not_executable"));
      assert.ok(plan.current_integrity.issues.includes("cli:content_mismatch"));

      const repaired = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke
      });
      assert.equal(repaired.status, "repaired");
      assert.equal(readFileSync(primaryCli, "utf8"), readFileSync(recoveryCli, "utf8"));
      assert.equal(lstatSync(primaryCli).mode & 0o111, 0o111);
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("refreshes bootstrap on activation and restores the prior active channel when refresh fails", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const stable = stableManifest(join(root, "activation-stable"), "v0.4.0", "1");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "activation-stable.json", stable),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const uat = uatManifest(components, "v0.4.1");
      uat.components.coevolve.version = "v0.14.0";
      const uatPath = writeManifest(root, "activation-uat.json", uat);
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: uatPath,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const state = readChannelState(home);
      const stableEntry = state.channels.stable;
      const uatEntry = state.channels.uat;
      const bootstrapPath = join(home, "skeleton", "scripts", "evozeus-launcher.mjs");

      activateInstalledChannel(home, "stable");
      refreshChannelBootstrap(home, stableEntry.component_roots.evozeus);
      assert.match(readFileSync(bootstrapPath, "utf8"), /fixture bootstrap: v0\.4\.0-evozeus/);

      const activated = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: uatPath,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      assert.equal(activated.status, "activated");
      assert.equal(activated.decision, "activate");
      assert.equal(readActiveChannel(home).channel, "uat");
      assert.equal(
        readFileSync(bootstrapPath, "utf8"),
        readFileSync(join(uatEntry.component_roots.evozeus, "scripts", "evozeus-launcher.mjs"), "utf8")
      );
      assert.equal(readJsonReport(join(home, "hooks", "state.json")).installed_version, "v0.14.0");

      activateInstalledChannel(home, "stable");
      refreshChannelBootstrap(home, stableEntry.component_roots.evozeus);
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");
      const activeBefore = readFileSync(join(home, "active-channel.json"), "utf8");
      const bootstrapBefore = readFileSync(bootstrapPath, "utf8");
      const dispatcherBefore = readJsonReport(join(home, "hooks", "state.json"));

      await assert.rejects(
        applyChannelUpdate({
          evozeusHome: home,
          channel: "uat",
          manifestSource: uatPath,
          smokeRunner: noSmoke,
          embeddedSmokeRunner: noSmoke,
          bootstrapCopy: () => {
            throw new Error("simulated activation bootstrap failure");
          }
        }),
        /simulated activation bootstrap failure/
      );
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);
      assert.equal(readFileSync(join(home, "active-channel.json"), "utf8"), activeBefore);
      assert.equal(readFileSync(bootstrapPath, "utf8"), bootstrapBefore);
      const dispatcherAfter = readJsonReport(join(home, "hooks", "state.json"));
      assert.equal(dispatcherAfter.wrapper_source, dispatcherBefore.wrapper_source);
      assert.equal(dispatcherAfter.installed_version, dispatcherBefore.installed_version);
      assert.equal(readActiveChannel(home).channel, "stable");
      assert.equal(channelSnapshot(home).health, "healthy");
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

  it("repairs a byte-modified dispatcher that retains its marker and version state", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "dispatcher-content-archives"));
      const manifestPath = writeManifest(root, "stable-dispatcher-content-repair.json", manifest);
      const installed = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      const dispatcherPath = join(home, "hooks", "evozeus_wrapper_dispatcher.py");
      writeFileSync(
        dispatcherPath,
        `${readFileSync(dispatcherPath, "utf8")}\n# modified but keeps evozeus.channel-coevolve-dispatcher.v2\n`
      );

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch
      });

      assert.equal(plan.decision, "repair");
      assert.ok(plan.current_integrity.issues.includes("dispatcher:content_mismatch"));

      const repaired = await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke
      });
      const expected = join(
        repaired.component_roots.evozeus,
        "scripts",
        "evozeus-coevolve-dispatcher.py"
      );

      assert.equal(repaired.status, "repaired");
      assert.notEqual(repaired.install_root, installed.install_root);
      assert.equal(readFileSync(dispatcherPath, "utf8"), readFileSync(expected, "utf8"));
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

  it("stops before manifest fetch when a Plugin marketplace root is an external symlink", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const hosts = join(home, "hosts");
      const outsideMarketplace = join(root, "outside-codex-marketplace");
      mkdirSync(hosts, { recursive: true });
      mkdirSync(outsideMarketplace);
      symlinkSync(outsideMarketplace, join(hosts, "codex-marketplace"), "dir");
      const manifest = stableManifest(join(root, "unsafe-plugin-archives"));
      const manifestPath = writeManifest(root, "stable-after-unsafe-plugin.json", manifest);
      let fetchCalls = 0;

      const plan = await prepareChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: "https://example.invalid/evozeus-product-stable.json",
        fetchImpl: async () => {
          fetchCalls += 1;
          throw new Error("unsafe Plugin marketplace must stop before manifest fetch");
        }
      });

      assert.equal(plan.decision, "unsafe_stop");
      assert.ok(plan.current_integrity.issues.includes("write_root:codex_marketplace:unsafe"));
      assert.ok(plan.current_integrity.issues.includes("write_root:codex_plugin:unsafe"));
      assert.equal(fetchCalls, 0);
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
      assert.deepEqual(readdirSync(outsideMarketplace), []);
      assert.deepEqual(readdirSync(hosts), ["codex-marketplace"]);
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
      for (const name of ["evozeus", "evozeus-repair"]) {
        const shim = join(home, "bin", name);
        writeFileSync(shim, "#!/bin/sh\nprintf '%s\\n' installed-shim\n");
        chmodSync(shim, 0o755);
      }
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
      assert.equal(hookState.source_repository, "MetaInFLow/EvoZeus");
      assert.equal(hookState.runtime_api, "evozeus.user-prompt.lesson-runtime.v1");
      assert.ok(readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8").includes("evozeus.channel-coevolve-dispatcher.v2"));
      assert.ok(result.migration_backup);
      assert.equal(readFileSync(join(result.migration_backup, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8"), "# legacy dispatcher\n");
      assert.equal(channelSnapshot(home).dispatcher.status, "ready");
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

  it("installs the dispatcher from the newly installed Core when CoEvolve is unchanged", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const source = join(components.evozeus.repo, "scripts", "evozeus-coevolve-dispatcher.py");
      writeFileSync(source, `${readFileSync(source, "utf8")}\n# installed-core-dispatcher-one\n`);
      git(components.evozeus.repo, "add", "scripts/evozeus-coevolve-dispatcher.py");
      git(components.evozeus.repo, "commit", "-m", "fixture dispatcher one");
      components.evozeus.commit = git(components.evozeus.repo, "rev-parse", "HEAD");

      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(root, "uat-dispatcher-one.json", uatManifest(components)),
        smokeRunner: noSmoke
      });
      assert.match(
        readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8"),
        /installed-core-dispatcher-one/
      );

      writeFileSync(
        source,
        readFileSync(source, "utf8").replace("installed-core-dispatcher-one", "installed-core-dispatcher-two")
      );
      git(components.evozeus.repo, "add", "scripts/evozeus-coevolve-dispatcher.py");
      git(components.evozeus.repo, "commit", "-m", "fixture dispatcher two");
      components.evozeus.commit = git(components.evozeus.repo, "rev-parse", "HEAD");

      const updated = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: writeManifest(
          root,
          "uat-dispatcher-two.json",
          uatManifest(components, "v0.4.1")
        ),
        smokeRunner: noSmoke
      });
      const installed = readFileSync(join(home, "hooks", "evozeus_wrapper_dispatcher.py"), "utf8");
      const installedSource = readFileSync(
        join(updated.component_roots.evozeus, "scripts", "evozeus-coevolve-dispatcher.py"),
        "utf8"
      );

      assert.equal(installed, installedSource);
      assert.match(installed, /installed-core-dispatcher-two/);
      assert.doesNotMatch(installed, /installed-core-dispatcher-one/);
      assert.equal(updated.active.dispatcher_reconciliation.repaired, true);
      assert.equal(readJsonReport(join(home, "hooks", "state.json")).core_version, "v0.4.1");
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

  it("uses the active core to repair a missing skeleton host module", async () =>
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
      assert.equal(existsSync(bootstrapHostModule), true);
      assert.equal(
        readFileSync(bootstrapHostModule, "utf8"),
        readFileSync(
          join(readChannelState(home).channels.uat.component_roots.evozeus, "scripts", "evozeus-hosts.mjs"),
          "utf8"
        )
      );
      assert.equal(readChannelState(home).channels.uat.manifest.product_version, "v0.4.1");
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

  it("reports recovery required when an isolated repair fails before switching roots", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "stable-pre-switch-repair"), "v0.4.0", "1");
      const manifestPath = writeManifest(root, "stable-pre-switch-repair.json", manifest);
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const beforeEntry = readChannelState(home).channels.stable;
      const missingSkill = join(beforeEntry.component_roots.evozeus, "SKILL.md");
      rmSync(missingSkill);
      writeFileSync(new URL(manifest.components.evozeus.source.url), "corrupted archive\n");

      const result = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          EVOZEUS_HOME: home,
          EVOZEUS_STABLE_MANIFEST: manifestPath,
          EVOZEUS_HOSTS_AVAILABLE: "none",
          EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
        }
      });

      assert.equal(result.status, 0, result.stderr);
      const afterEntry = readChannelState(home).channels.stable;
      const report = readJsonReport(join(home, "state", "stable", "auto-update-last.json"));
      assert.equal(afterEntry.install_root, beforeEntry.install_root);
      assert.equal(existsSync(missingSkill), false);
      assert.equal(report.status, "failed_recovery_required");
      assert.equal(report.recovery.status, "incomplete");
      assert.equal(report.recovery.product, "damaged_previous_retained");
      assert.equal(report.recovery.plugin, "unchanged");
      assert.equal(report.recovery.error.code, "REPAIR_FAILED_BEFORE_SWITCH");
      assert.equal(report.error.code, "ARCHIVE_CHECKSUM_MISMATCH");
      assert.match(result.stderr, /恢复未完成/);
    }));

  it("reports recovery required when an update fails before replacing a damaged install", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const current = stableManifest(join(root, "damaged-update-current"), "v0.4.0", "1");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "damaged-update-current.json", current),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const beforeEntry = readChannelState(home).channels.stable;
      const missingSkill = join(beforeEntry.component_roots.evozeus, "SKILL.md");
      rmSync(missingSkill);
      const target = stableManifest(join(root, "damaged-update-target"), "v0.4.1", "4");
      writeFileSync(new URL(target.components.evozeus.source.url), "corrupted archive\n");
      const targetPath = writeManifest(root, "damaged-update-target.json", target);

      const result = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          EVOZEUS_HOME: home,
          EVOZEUS_STABLE_MANIFEST: targetPath,
          EVOZEUS_HOSTS_AVAILABLE: "none",
          EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
        }
      });

      assert.equal(result.status, 0, result.stderr);
      const afterEntry = readChannelState(home).channels.stable;
      const report = readJsonReport(join(home, "state", "stable", "auto-update-last.json"));
      assert.equal(afterEntry.install_root, beforeEntry.install_root);
      assert.equal(afterEntry.manifest.product_version, "v0.4.0");
      assert.equal(existsSync(missingSkill), false);
      assert.equal(report.status, "failed_recovery_required");
      assert.equal(report.recovery.status, "incomplete");
      assert.equal(report.recovery.product, "damaged_previous_retained");
      assert.equal(report.recovery.plugin, "unchanged");
      assert.equal(report.recovery.error.code, "UPDATE_FAILED_WITH_DAMAGED_PREVIOUS");
      assert.equal(report.error.code, "ARCHIVE_CHECKSUM_MISMATCH");
      assert.match(result.stderr, /恢复未完成/);
      assert.doesNotMatch(result.stderr, /继续使用Stable/);
    }));

  it("rolls back a cross-version auto-update and Plugin after real host registration fails", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const first = stableManifest(join(root, "stable-plugin-rollback-one"), "v0.4.0", "1");
      const firstPath = writeManifest(root, "stable-plugin-rollback-one.json", first);
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: firstPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const beforeEntry = readChannelState(home).channels.stable;
      primeCodexPlugin(home, beforeEntry);
      const currentLink = join(home, "releases", "stable", "current");
      const bootstrapPath = join(home, "skeleton", "scripts", "evozeus-launcher.mjs");
      const pluginSkillPath = join(
        home,
        "hosts",
        "codex-marketplace",
        "plugins",
        "evozeus",
        "skills",
        "using-evozeus",
        "SKILL.md"
      );
      const beforeBootstrap = readFileSync(bootstrapPath, "utf8");
      const beforePluginSkill = readFileSync(pluginSkillPath, "utf8");
      const beforeLink = resolve(dirname(currentLink), readlinkSync(currentLink));
      const beforeDispatcherState = readJsonReport(join(home, "hooks", "state.json"));
      const fakeCodex = flakyCodexCommand(root);
      const second = stableManifest(join(root, "stable-plugin-rollback-two"), "v0.4.1", "4");
      second.components.coevolve.version = "v0.14.0";
      second.components.coevolve.commit = "5".repeat(40);
      const secondPath = writeManifest(root, "stable-plugin-rollback-two.json", second);

      const result = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeCodex.bin}:${process.env.PATH}`,
          EVOZEUS_HOME: home,
          EVOZEUS_STABLE_MANIFEST: secondPath,
          EVOZEUS_HOSTS_AVAILABLE: "codex",
          EVOZEUS_TEST_HOST_COUNTER: fakeCodex.counter,
          EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
        }
      });

      assert.equal(result.status, 0, result.stderr);
      const afterEntry = readChannelState(home).channels.stable;
      const report = readJsonReport(join(home, "state", "stable", "auto-update-last.json"));
      const pluginState = readJsonReport(join(home, "hosts", "plugin-state.json"));
      assert.equal(afterEntry.install_root, beforeEntry.install_root);
      assert.equal(afterEntry.manifest_digest, beforeEntry.manifest_digest);
      assert.equal(resolve(dirname(currentLink), readlinkSync(currentLink)), beforeLink);
      assert.equal(readFileSync(bootstrapPath, "utf8"), beforeBootstrap);
      assert.match(beforeBootstrap, /fixture bootstrap: v0\.4\.0-evozeus/);
      assert.doesNotMatch(beforeBootstrap, /fixture bootstrap: v0\.4\.1-evozeus/);
      assert.equal(readFileSync(pluginSkillPath, "utf8"), beforePluginSkill);
      assert.match(beforePluginSkill, /v0\.4\.0-evozeus/);
      assert.equal(pluginState.product_version, "v0.4.0");
      assert.equal(pluginState.commit, beforeEntry.manifest.components.evozeus.commit);
      assert.equal(readActiveChannel(home).channel, "stable");
      assert.equal(beforeDispatcherState.installed_version, "v0.13.0");
      assert.equal(readJsonReport(join(home, "hooks", "state.json")).installed_version, beforeDispatcherState.installed_version);
      assert.equal(channelSnapshot(home).dispatcher.status, "ready");
      assert.equal(report.status, "failed_continuing_previous");
      assert.equal(report.product_version, "v0.4.0");
      assert.equal(report.recovery.status, "restored_previous");
      assert.equal(report.recovery.product, "rolled_back");
      assert.equal(report.recovery.plugin, "realigned_previous");
      assert.match(report.error.message, /injected Plugin registration failure/);
      assert.equal(readFileSync(fakeCodex.counter, "utf8").trim(), "3");
      assert.match(result.stderr, /继续使用Stable v0\.4\.0/);
    }));

  it("keeps a verified repair active when its damaged predecessor cannot be rolled back", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const manifest = stableManifest(join(root, "stable-repair-plugin-rollback"), "v0.4.0", "1");
      const manifestPath = writeManifest(root, "stable-repair-plugin-rollback.json", manifest);
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: manifestPath,
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const beforeEntry = readChannelState(home).channels.stable;
      primeCodexPlugin(home, beforeEntry);
      rmSync(join(beforeEntry.component_roots.evozeus, "SKILL.md"));
      const pluginStatePath = join(home, "hosts", "plugin-state.json");
      const mismatchedPluginState = readJsonReport(pluginStatePath);
      mismatchedPluginState.commit = "f".repeat(40);
      writeFileSync(pluginStatePath, `${JSON.stringify(mismatchedPluginState, null, 2)}\n`);
      const currentLink = join(home, "releases", "stable", "current");
      const beforeLink = resolve(dirname(currentLink), readlinkSync(currentLink));
      const fakeCodex = flakyCodexCommand(root);

      const result = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeCodex.bin}:${process.env.PATH}`,
          EVOZEUS_HOME: home,
          EVOZEUS_STABLE_MANIFEST: manifestPath,
          EVOZEUS_HOSTS_AVAILABLE: "codex",
          EVOZEUS_TEST_HOST_COUNTER: fakeCodex.counter,
          EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
        }
      });

      assert.equal(result.status, 0, result.stderr);
      const afterEntry = readChannelState(home).channels.stable;
      const report = readJsonReport(join(home, "state", "stable", "auto-update-last.json"));
      const restoredPluginState = readJsonReport(pluginStatePath);
      assert.notEqual(afterEntry.install_root, beforeEntry.install_root);
      assert.equal(afterEntry.previous.install_root, beforeEntry.install_root);
      assert.equal(afterEntry.manifest_digest, beforeEntry.manifest_digest);
      assert.notEqual(resolve(dirname(currentLink), readlinkSync(currentLink)), beforeLink);
      assert.equal(resolve(dirname(currentLink), readlinkSync(currentLink)), afterEntry.install_root);
      assert.equal(existsSync(join(afterEntry.component_roots.evozeus, "SKILL.md")), true);
      assert.equal(restoredPluginState.commit, "f".repeat(40));
      assert.equal(report.status, "failed_recovery_required");
      assert.equal(report.product_version, "v0.4.0");
      assert.equal(report.recovery.status, "incomplete");
      assert.equal(report.recovery.product, "unchanged");
      assert.equal(report.recovery.plugin, "pending");
      assert.equal(report.recovery.error.code, "ROLLBACK_STATE_UNHEALTHY");
      assert.match(report.recovery.error.message, /not healthy enough to activate/);
      assert.match(report.error.message, /injected Plugin registration failure/);
      assert.match(result.stderr, /恢复未完成/);
    }));

  it("reports recovery required when the previous Plugin cannot be re-registered", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const first = stableManifest(join(root, "stable-plugin-recovery-one"), "v0.4.0", "1");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "stable-plugin-recovery-one.json", first),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const beforeEntry = readChannelState(home).channels.stable;
      primeCodexPlugin(home, beforeEntry);
      const bootstrapPath = join(home, "skeleton", "scripts", "evozeus-launcher.mjs");
      const beforeBootstrap = readFileSync(bootstrapPath, "utf8");
      const fakeCodex = flakyCodexCommand(root);
      const second = stableManifest(join(root, "stable-plugin-recovery-two"), "v0.4.1", "4");

      const result = spawnSync(process.execPath, [LAUNCHER, "version", "--json"], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${fakeCodex.bin}:${process.env.PATH}`,
          EVOZEUS_HOME: home,
          EVOZEUS_STABLE_MANIFEST: writeManifest(root, "stable-plugin-recovery-two.json", second),
          EVOZEUS_HOSTS_AVAILABLE: "codex",
          EVOZEUS_TEST_HOST_COUNTER: fakeCodex.counter,
          EVOZEUS_TEST_HOST_FAILURES: "99",
          EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS: "0"
        }
      });

      assert.equal(result.status, 0, result.stderr);
      const afterEntry = readChannelState(home).channels.stable;
      const report = readJsonReport(join(home, "state", "stable", "auto-update-last.json"));
      assert.equal(afterEntry.install_root, beforeEntry.install_root);
      assert.equal(afterEntry.manifest_digest, beforeEntry.manifest_digest);
      assert.equal(readFileSync(bootstrapPath, "utf8"), beforeBootstrap);
      assert.equal(report.status, "failed_recovery_required");
      assert.equal(report.product_version, "v0.4.0");
      assert.equal(report.recovery.status, "incomplete");
      assert.equal(report.recovery.product, "rolled_back");
      assert.equal(report.recovery.plugin, "pending");
      assert.match(report.recovery.error.message, /injected Plugin registration failure/);
      assert.match(result.stderr, /恢复未完成/);
    }));

  it("reactivates the prior product and Plugin when manual channel activation alignment fails", async () =>
    fixture(async (root) => {
      const home = join(root, "home");
      const stable = stableManifest(join(root, "stable-activation-rollback"), "v0.4.0", "1");
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "stable",
        manifestSource: writeManifest(root, "stable-activation-rollback.json", stable),
        fetchImpl: fileFetch,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [componentId, initComponent(root, componentId)])
      );
      const uat = uatManifest(components, "v0.4.1");
      uat.components.coevolve.version = "v0.14.0";
      const uatPath = writeManifest(root, "uat-activation-rollback.json", uat);
      await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: uatPath,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      activateInstalledChannel(home, "stable");
      const stableEntry = readChannelState(home).channels.stable;
      refreshChannelBootstrap(home, stableEntry.component_roots.evozeus);
      primeCodexPlugin(home, stableEntry);
      const bootstrapPath = join(home, "skeleton", "scripts", "evozeus-launcher.mjs");
      const beforeBootstrap = readFileSync(bootstrapPath, "utf8");
      const fakeCodex = flakyCodexCommand(root);

      const result = runInstalledCli(
        join(stableEntry.component_roots.evozeus, "scripts", "evozeus-cli.mjs"),
        ["align", "--channel", "uat", "--host", "codex", "--manifest", uatPath, "--approve-write", "--json"],
        {
          home,
          path: `${fakeCodex.bin}:${process.env.PATH}`,
          env: { EVOZEUS_TEST_HOST_COUNTER: fakeCodex.counter }
        }
      );

      assert.equal(result.status, 1, result.stderr);
      const pluginState = readJsonReport(join(home, "hosts", "plugin-state.json"));
      assert.match(`${result.stdout}\n${result.stderr}`, /PLUGIN_ALIGNMENT_FAILED/);
      assert.equal(readActiveChannel(home).channel, "stable");
      assert.equal(readFileSync(bootstrapPath, "utf8"), beforeBootstrap);
      assert.equal(readJsonReport(join(home, "hooks", "state.json")).installed_version, "v0.13.0");
      assert.equal(pluginState.active_channel, "stable");
      assert.equal(pluginState.product_version, "v0.4.0");
      assert.equal(pluginState.commit, stableEntry.manifest.components.evozeus.commit);
      assert.equal(readFileSync(fakeCodex.counter, "utf8").trim(), "3");
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
  it("plans and applies a recognized v1 channel migration without retaining it as rollback", async () =>
    fixture(async (root) => {
      const home = join(root, ".evozeus");
      const legacyRoot = join(home, "worktrees", "uat", "legacy");
      const currentLink = join(home, "worktrees", "uat", "current");
      mkdirSync(legacyRoot, { recursive: true });
      writeFileSync(join(legacyRoot, "legacy-marker.txt"), "preserved\n");
      symlinkSync(relative(dirname(currentLink), legacyRoot), currentLink, "dir");
      writeFileSync(
        join(home, "active-channel.json"),
        `${JSON.stringify({ schema_version: "evozeus.active-channel.v1", channel: "uat", auto_refresh: false })}\n`
      );
      const legacyEntry = {
        manifest: {
          schema_version: "evozeus.product-channel.v1",
          product_version: "v0.3.5",
          channel: "uat",
          components: {
            evozeus: { version: "v0.3.5", commit: "a".repeat(40) },
            coevolve: { version: "v0.13.1", commit: "b".repeat(40) }
          }
        },
        manifest_digest: `sha256:${"e".repeat(64)}`,
        install_root: legacyRoot,
        component_roots: {}
      };
      writeFileSync(
        join(home, "channel-state.json"),
        `${JSON.stringify({
          schema_version: "evozeus.channel-state.v1",
          channels: { stable: null, uat: legacyEntry },
          last_transaction: null
        }, null, 2)}\n`
      );
      const components = Object.fromEntries(
        Object.keys(COMPONENT_PATHS).map((componentId) => [
          componentId,
          initComponent(join(root, "migration-components"), componentId)
        ])
      );
      const manifestPath = writeManifest(root, "uat-v1-migration.json", uatManifest(components, "v0.4.1"));
      const stateBefore = readFileSync(join(home, "channel-state.json"), "utf8");

      const plan = await prepareChannelUpdate({ evozeusHome: home, channel: "uat", manifestSource: manifestPath });
      assert.equal(plan.decision, "migrate");
      assert.equal(plan.migration_required, true);
      assert.equal(plan.current_integrity.status, "migration_required");
      assert.equal(plan.writes_now, false);
      assert.equal(readFileSync(join(home, "channel-state.json"), "utf8"), stateBefore);

      const migrated = await applyChannelUpdate({
        evozeusHome: home,
        channel: "uat",
        manifestSource: manifestPath,
        smokeRunner: noSmoke,
        embeddedSmokeRunner: noSmoke
      });
      const current = readChannelState(home).channels.uat;
      assert.equal(migrated.status, "migrated");
      assert.equal(migrated.rollback, null);
      assert.equal(current.manifest.schema_version, "evozeus.product-channel.v2");
      assert.equal(current.previous, null);
      assert.equal(existsSync(join(legacyRoot, "legacy-marker.txt")), true);
      assert.equal(channelSnapshot(home).health, "healthy");
    }));

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
