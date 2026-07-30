import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SCRIPT = fileURLToPath(new URL("./evozeus-install.mjs", import.meta.url));
const SOURCE_ROOT = fileURLToPath(new URL("..", import.meta.url));

function withTempInstall(callback) {
  const root = mkdtempSync(join(tmpdir(), "evozeus-install-"));
  const workspace = join(root, "workspace");
  const evozeusHome = join(root, "home", ".evozeus");
  try {
    mkdirSync(workspace, { recursive: true });
    return callback({ root, workspace, evozeusHome });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runInstall(workspace, evozeusHome, args = []) {
  return spawnSync(process.execPath, [SCRIPT, "--workspace", workspace, "--evozeus-home", evozeusHome, "--source-root", SOURCE_ROOT, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      EVOZEUS_MACHINE_ID_OVERRIDE: "test-device-for-evozeus-install"
    }
  });
}

function parseStdout(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("evozeus-install", () => {
  it("records verified Release archive provenance", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const commit = "0123456789abcdef0123456789abcdef01234567";
      const digest = "a".repeat(64);
      const report = parseStdout(
        runInstall(workspace, evozeusHome, [
          "--release-tag",
          "v0.3.1",
          "--release-commit",
          commit,
          "--release-archive-sha256",
          digest,
          "--approve-write"
        ])
      );
      const manifest = readJson(join(evozeusHome, "install-manifest.json"));

      assert.equal(report.skeleton_source.install_material, "release_archive");
      assert.equal(report.skeleton_source.resolved_ref, "v0.3.1");
      assert.equal(report.skeleton_source.resolved_commit, commit);
      assert.equal(report.skeleton_source.release_archive_sha256, `sha256:${digest}`);
      assert.equal(report.skeleton_source.release_artifact_downloaded, true);
      assert.equal(manifest.source.local_source, false);
      assert.equal(manifest.source.install_material, "release_archive");
      assert.equal(manifest.source.exact_tag, "v0.3.1");
    }));

  it("rejects incomplete Release provenance before writing", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const result = runInstall(workspace, evozeusHome, ["--release-tag", "v0.3.1", "--approve-write"]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /must be provided together/);
      assert.equal(existsSync(evozeusHome), false);
    }));

  it("dry-runs without writing .evozeus", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const result = runInstall(workspace, evozeusHome);
      const report = parseStdout(result);

      assert.equal(report.write_mode, "dry_run");
      assert.equal(report.registration_status, "would_create");
      assert.equal(report.evozeus_home, evozeusHome);
      assert.equal(report.registration_home_state, "no_evozeus_home");
      assert.equal(report.workspace_state, "workspace_not_used_for_registration");
      assert.equal(report.skeleton_source.install_material, "local_source_checkout");
      assert.equal(report.skeleton_source.release_artifact_downloaded, false);
      assert.equal(typeof report.skeleton_source.resolved_ref, "string");
      assert.equal(typeof report.skeleton_source.resolved_commit, "string");
      assert.ok(report.files_planned.includes(join(evozeusHome, "registration.json")));
      assert.ok(report.files_planned.includes(join(evozeusHome, "bin/evozeus")));
      assert.equal(existsSync(evozeusHome), false);
      assert.equal(existsSync(join(workspace, ".evozeus")), false);
    }));

  it("creates registration, manifest, and skeleton after approval", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const result = runInstall(workspace, evozeusHome, ["--approve-write"]);
      const report = parseStdout(result);
      const registration = readJson(join(evozeusHome, "registration.json"));
      const manifest = readJson(join(evozeusHome, "install-manifest.json"));

      assert.equal(report.write_mode, "approved_write");
      assert.equal(report.registration_status, "created");
      assert.equal(report.evozeus_home, evozeusHome);
      assert.equal(report.workspace_state, "workspace_not_used_for_registration");
      assert.equal(registration.status, "registered");
      assert.equal(registration.local_only, true);
      assert.equal(registration.identity.version, "device-runtime-v1");
      assert.equal(registration.identity.source_quality, "test_override");
      assert.equal(registration.identity.recovery_capable, true);
      assert.equal(typeof registration.identity.device_id_hash, "string");
      assert.equal(registration.identity.device_id_hash.length, 64);
      assert.equal(typeof registration.runtime_instance_hash, "string");
      assert.equal(registration.runtime_instance_hash.length, 64);
      assert.equal(registration.runtime_instance_hash, registration.identity.runtime_instance_hash);
      assert.equal(typeof registration.workspace_hash, "string");
      assert.equal(manifest.status, "installed");
      assert.equal(manifest.source.repository, "MetaInFLow/EvoZeus");
      assert.equal(manifest.source.install_material, "local_source_checkout");
      assert.equal(manifest.source.local_source, true);
      assert.equal(typeof manifest.source.local_source_path, "string");
      assert.equal(manifest.source.release_artifact_downloaded, false);
      assert.equal(typeof manifest.source.resolved_ref, "string");
      assert.equal(typeof manifest.source.resolved_commit, "string");
      assert.equal(manifest.source.git_commit, manifest.source.resolved_commit);
      assert.equal(report.skeleton_source.install_material, "local_source_checkout");
      assert.equal(report.skeleton_source.release_artifact_downloaded, false);
      assert.equal(manifest.cli.command, "~/.evozeus/bin/evozeus");
      assert.equal(manifest.cli.path, join(evozeusHome, "bin/evozeus"));
      assert.equal(manifest.cli.script, "scripts/evozeus-cli.mjs");
      assert.equal(typeof manifest.cli.capabilities_hash, "string");
      assert.ok(manifest.skills_inventory.some((skill) => skill.name === "using-evozeus"));
      assert.ok(manifest.skills_inventory.some((skill) => skill.name === "maintain-evozeus"));
      assert.ok(existsSync(join(evozeusHome, "skeleton/SKILL.md")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/skills/using-evozeus/SKILL.md")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/scripts/evozeus-cli.mjs")));
      assert.ok(existsSync(join(evozeusHome, "bin/evozeus")));
      assert.equal(existsSync(join(workspace, ".evozeus")), false);
      assert.ok(report.files_written.includes(join(evozeusHome, "registration.json")));
      assert.ok(report.files_written.includes(join(evozeusHome, "bin/evozeus")));
      assert.ok(report.files_written.includes(join(evozeusHome, "install-manifest.json")));
      assert.match(report.approval_needed, /Ask before session analysis/);
      assert.match(report.next_command, /tell the EvoZeus plugin what you want/i);
    }));

  it("installs a local CLI shim that can describe features and capabilities", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));

      const featuresResult = spawnSync(join(evozeusHome, "bin/evozeus"), ["features", "--json"], {
        cwd: workspace,
        encoding: "utf8"
      });
      const featuresReport = parseStdout(featuresResult);

      assert.equal(featuresReport.operation, "features.describe");
      assert.ok(featuresReport.data.features.some((feature) => feature.id === "insights.sessions"));

      const result = spawnSync(join(evozeusHome, "bin/evozeus"), ["capabilities", "--json"], {
        cwd: workspace,
        encoding: "utf8"
      });
      const report = parseStdout(result);

      assert.equal(report.operation, "capabilities.describe");
      assert.ok(report.data.capabilities.some((capability) => capability.name === "session.analyze"));
      assert.ok(report.data.capabilities.some((capability) => capability.name === "harness.attachPlan"));
    }));

  it("reconciles an existing registration without changing the registration id", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const first = parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));
      const firstRegistration = readJson(join(evozeusHome, "registration.json"));

      const second = parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));
      const secondRegistration = readJson(join(evozeusHome, "registration.json"));

      assert.equal(first.registration_status, "created");
      assert.equal(second.registration_status, "reconciled");
      assert.equal(second.registration_home_state, "existing_evozeus_home");
      assert.equal(secondRegistration.registration_id, firstRegistration.registration_id);
      assert.equal(secondRegistration.runtime_instance_hash, firstRegistration.runtime_instance_hash);
      assert.equal(secondRegistration.created_at, firstRegistration.created_at);
    }));

  it("repairs missing installed skeleton files", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));
      const installedSkill = join(evozeusHome, "skeleton/skills/using-evozeus/SKILL.md");
      unlinkSync(installedSkill);
      assert.equal(existsSync(installedSkill), false);

      const report = parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));

      assert.equal(report.registration_status, "reconciled");
      assert.equal(existsSync(installedSkill), true);
      assert.ok(report.files_written.includes(join(evozeusHome, "skeleton/skills")));
    }));

  it("does not create runtime or report state during install", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const report = parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));

      assert.equal(existsSync(join(evozeusHome, "runtime")), false);
      assert.equal(existsSync(join(evozeusHome, "infra")), false);
      assert.equal(existsSync(join(evozeusHome, "reports")), false);
      assert.equal(existsSync(join(workspace, ".evozeus")), false);
      assert.ok(report.not_enabled.includes("workspace scan"));
      assert.ok(report.not_enabled.includes("GitHub issue/PR/public artifact"));
    }));
});
