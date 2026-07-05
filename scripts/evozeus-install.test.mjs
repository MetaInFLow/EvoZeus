import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
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

function withTempWorkspace(callback) {
  const root = mkdtempSync(join(tmpdir(), "evozeus-install-"));
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runInstall(workspace, args = []) {
  return spawnSync(process.execPath, [SCRIPT, "--workspace", workspace, "--source-root", SOURCE_ROOT, ...args], {
    encoding: "utf8"
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
  it("dry-runs without writing .evozeus", () =>
    withTempWorkspace((workspace) => {
      const result = runInstall(workspace);
      const report = parseStdout(result);

      assert.equal(report.write_mode, "dry_run");
      assert.equal(report.registration_status, "would_create");
      assert.equal(report.workspace_state, "no_evozeus");
      assert.equal(report.skeleton_source.install_material, "local_source_checkout");
      assert.equal(report.skeleton_source.release_artifact_downloaded, false);
      assert.equal(typeof report.skeleton_source.resolved_ref, "string");
      assert.equal(typeof report.skeleton_source.resolved_commit, "string");
      assert.ok(report.files_planned.includes(".evozeus/registration.json"));
      assert.ok(report.files_planned.includes(".evozeus/bin/evozeus"));
      assert.equal(existsSync(join(workspace, ".evozeus")), false);
    }));

  it("creates registration, manifest, and skeleton after approval", () =>
    withTempWorkspace((workspace) => {
      const result = runInstall(workspace, ["--approve-write"]);
      const report = parseStdout(result);
      const registration = readJson(join(workspace, ".evozeus/registration.json"));
      const manifest = readJson(join(workspace, ".evozeus/install-manifest.json"));

      assert.equal(report.write_mode, "approved_write");
      assert.equal(report.registration_status, "created");
      assert.equal(registration.status, "registered");
      assert.equal(registration.local_only, true);
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
      assert.equal(manifest.cli.command, ".evozeus/bin/evozeus");
      assert.equal(manifest.cli.script, "scripts/evozeus-cli.mjs");
      assert.equal(typeof manifest.cli.capabilities_hash, "string");
      assert.ok(manifest.skills_inventory.some((skill) => skill.name === "evozeus-install-registration"));
      assert.ok(existsSync(join(workspace, ".evozeus/skeleton/SKILL.md")));
      assert.ok(existsSync(join(workspace, ".evozeus/skeleton/skills/index/SKILL.md")));
      assert.ok(existsSync(join(workspace, ".evozeus/skeleton/scripts/evozeus-cli.mjs")));
      assert.ok(existsSync(join(workspace, ".evozeus/bin/evozeus")));
      assert.ok(report.files_written.includes(".evozeus/registration.json"));
      assert.ok(report.files_written.includes(".evozeus/bin/evozeus"));
      assert.ok(report.files_written.includes(".evozeus/install-manifest.json"));
      assert.match(report.approval_needed, /Ask before session analysis/);
      assert.match(report.next_command, /evozeus capabilities --json/);
    }));

  it("installs a local CLI shim that can describe capabilities", () =>
    withTempWorkspace((workspace) => {
      parseStdout(runInstall(workspace, ["--approve-write"]));

      const result = spawnSync(join(workspace, ".evozeus/bin/evozeus"), ["capabilities", "--json"], {
        cwd: workspace,
        encoding: "utf8"
      });
      const report = parseStdout(result);

      assert.equal(report.operation, "capabilities.describe");
      assert.ok(report.data.capabilities.some((capability) => capability.name === "session.analyze"));
      assert.ok(report.data.capabilities.some((capability) => capability.name === "harness.attachPlan"));
    }));

  it("reconciles an existing registration without changing the registration id", () =>
    withTempWorkspace((workspace) => {
      const first = parseStdout(runInstall(workspace, ["--approve-write"]));
      const firstRegistration = readJson(join(workspace, ".evozeus/registration.json"));

      const second = parseStdout(runInstall(workspace, ["--approve-write"]));
      const secondRegistration = readJson(join(workspace, ".evozeus/registration.json"));

      assert.equal(first.registration_status, "created");
      assert.equal(second.registration_status, "reconciled");
      assert.equal(second.workspace_state, "existing_evozeus");
      assert.equal(secondRegistration.registration_id, firstRegistration.registration_id);
      assert.equal(secondRegistration.created_at, firstRegistration.created_at);
    }));

  it("repairs missing installed skeleton files", () =>
    withTempWorkspace((workspace) => {
      parseStdout(runInstall(workspace, ["--approve-write"]));
      const installedSkill = join(workspace, ".evozeus/skeleton/skills/index/SKILL.md");
      unlinkSync(installedSkill);
      assert.equal(existsSync(installedSkill), false);

      const report = parseStdout(runInstall(workspace, ["--approve-write"]));

      assert.equal(report.registration_status, "reconciled");
      assert.equal(existsSync(installedSkill), true);
      assert.ok(report.files_written.includes(".evozeus/skeleton/skills"));
    }));

  it("does not create runtime or report state during install", () =>
    withTempWorkspace((workspace) => {
      const report = parseStdout(runInstall(workspace, ["--approve-write"]));

      assert.equal(existsSync(join(workspace, ".evozeus/runtime")), false);
      assert.equal(existsSync(join(workspace, ".evozeus/infra")), false);
      assert.equal(existsSync(join(workspace, ".evozeus/reports")), false);
      assert.ok(report.not_enabled.includes("workspace scan"));
      assert.ok(report.not_enabled.includes("GitHub issue/PR/public artifact"));
    }));
});
