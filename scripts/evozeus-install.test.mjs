import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SCRIPT = fileURLToPath(new URL("./evozeus-install.mjs", import.meta.url));
const SOURCE_ROOT = fileURLToPath(new URL("..", import.meta.url));

function withTempInstall(callback) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "evozeus-install-")));
  const workspace = join(root, "workspace");
  const evozeusHome = join(root, "home", ".evozeus");
  try {
    mkdirSync(workspace, { recursive: true });
    return callback({ root, workspace, evozeusHome });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function preflightReport(evozeusHome, localState = "not_installed", latestRelease = "v0.4.1") {
  return {
    ok: true,
    operation: "system.installPreflight",
    schema_version: "evozeus.install-preflight.v1",
    stage: "full",
    checked_at: new Date().toISOString(),
    writes: false,
    status: "ready",
    target: { channel: "stable", evozeus_home: evozeusHome },
    network: { head_requests: 1, asset_get_count: 0, payloads_saved: 0, product_assets_downloaded: 0 },
    local_state: { status: localState, preliminary: false, evidence: [`fixture:${localState}`] },
    checks: [{
      id: "github_network",
      status: "pass",
      detected: { method: "HEAD", latest_release: latestRelease, payload_saved: false }
    }],
    fallbacks: [],
    blockers: [],
    remediation: [],
    next_action: {
      action: localState === "not_installed" ? "request_fresh_install_approval" : "report_noop",
      allowed: true,
      writes_now: false,
      product_asset_download_now: false,
      registration_now: false,
      approval_required: localState === "not_installed"
    }
  };
}

function runInstall(workspace, evozeusHome, args = [], options = {}) {
  const usePreflight = options.preflight !== false;
  const releaseTagIndex = args.indexOf("--release-tag");
  const latestRelease = releaseTagIndex >= 0 ? args[releaseTagIndex + 1] : "v0.4.1";
  return spawnSync(process.execPath, [SCRIPT, "--workspace", workspace, "--evozeus-home", evozeusHome, "--source-root", SOURCE_ROOT, ...args, ...(usePreflight ? ["--preflight-stdin"] : [])], {
    encoding: "utf8",
    input: usePreflight ? `${JSON.stringify(options.preflightReport || preflightReport(evozeusHome, "not_installed", latestRelease))}\n` : undefined,
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
      assert.ok(report.files_planned.includes(join(evozeusHome, "update-policy.json")));
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
      const updatePolicy = readJson(join(evozeusHome, "update-policy.json"));

      assert.equal(report.write_mode, "approved_write");
      assert.equal(report.preflight.local_state, "not_installed");
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
      assert.deepEqual(updatePolicy, {
        schema_version: "evozeus.update-policy.v1",
        enabled: true,
        check_interval_seconds: 3600,
        channels: { stable: true, uat: true }
      });
      assert.equal(typeof manifest.cli.capabilities_hash, "string");
      assert.ok(manifest.skills_inventory.some((skill) => skill.name === "using-evozeus"));
      assert.ok(manifest.skills_inventory.some((skill) => skill.name === "maintain-evozeus"));
      assert.ok(existsSync(join(evozeusHome, "skeleton/SKILL.md")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/skills/using-evozeus/SKILL.md")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/.codex-plugin/plugin.json")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/.claude-plugin/plugin.json")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/hooks/hooks.json")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/scripts/evozeus-hosts.mjs")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/packages/runtime/src/evozeus_runtime/cli/main.py")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/packs/session-signal/scripts/validate_official_factor_spec.py")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/scripts/evozeus-cli.mjs")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/scripts/evozeus-install-prefetch.sh")));
      assert.ok(existsSync(join(evozeusHome, "skeleton/scripts/evozeus-install-preflight.mjs")));
      assert.ok(existsSync(join(evozeusHome, "bin/evozeus")));
      assert.equal(existsSync(join(workspace, ".evozeus")), false);
      assert.ok(report.files_written.includes(join(evozeusHome, "registration.json")));
      assert.ok(report.files_written.includes(join(evozeusHome, "update-policy.json")));
      assert.ok(report.files_written.includes(join(evozeusHome, "bin/evozeus")));
      assert.ok(report.files_written.includes(join(evozeusHome, "install-manifest.json")));
      assert.match(report.approval_needed, /Ask before session analysis/);
      assert.match(report.next_command, /evozeus align --channel stable --host auto/i);
    }));

  it("rejects approved writes without a ready full preflight", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const missingDryRun = runInstall(workspace, evozeusHome, [], { preflight: false });
      assert.notEqual(missingDryRun.status, 0);
      assert.match(missingDryRun.stderr, /requires a full preflight report/);
      assert.doesNotMatch(missingDryRun.stdout, /would_reconcile/);

      const missing = runInstall(workspace, evozeusHome, ["--approve-write"], { preflight: false });
      assert.notEqual(missing.status, 0);
      assert.match(missing.stderr, /requires a full preflight report/);
      assert.equal(existsSync(evozeusHome), false);

      const healthy = runInstall(workspace, evozeusHome, ["--approve-write"], {
        preflightReport: preflightReport(evozeusHome, "healthy_current")
      });
      assert.notEqual(healthy.status, 0);
      assert.match(healthy.stderr, /fresh install is allowed only for not_installed/);
      assert.equal(existsSync(evozeusHome), false);
    }));

  it("binds the preflight Stable release tag to approved Release metadata", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const result = runInstall(workspace, evozeusHome, [
        "--release-tag", "v0.4.0",
        "--release-commit", "0123456789abcdef0123456789abcdef01234567",
        "--release-archive-sha256", "a".repeat(64),
        "--approve-write"
      ], {
        preflightReport: preflightReport(evozeusHome, "not_installed", "v0.4.1")
      });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /v0\.4\.1 does not match --release-tag v0\.4\.0/);
      assert.equal(existsSync(evozeusHome), false);
    }));

  it("rejects replayed, mismatched, preliminary, blocked, or wrong-route preflight reports", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const cases = [
        ["target", (report) => { report.target.evozeus_home = `${evozeusHome}-other`; }, /target must match/],
        ["stale", (report) => { report.checked_at = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); }, /stale/],
        ["preliminary", (report) => { report.local_state.preliminary = true; }, /final local-state decision/],
        ["blocker", (report) => { report.blockers.push({ check_id: "fixture", code: "FIXTURE", message: "blocked" }); }, /empty preflight blocker list/],
        ["route", (report) => { report.next_action.action = "request_repair_approval"; }, /exact approved preflight next action/],
        ["download", (report) => { report.network.product_assets_downloaded = 1; }, /before product assets are downloaded/],
        ["shape", (report) => { delete report.checks; }, /required schema fields/]
      ];

      for (const [name, mutate, expected] of cases) {
        const report = preflightReport(evozeusHome);
        mutate(report);
        const result = runInstall(workspace, evozeusHome, ["--approve-write"], { preflightReport: report });
        assert.notEqual(result.status, 0, name);
        assert.match(result.stderr, expected, name);
        assert.equal(existsSync(evozeusHome), false, name);
      }
    }));

  it("rechecks the target immediately before approved writes and stops when local state changed", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      const report = preflightReport(evozeusHome);
      const markerPath = join(evozeusHome, "registration.json");
      const marker = '{"status":"created-by-another-process"}\n';
      mkdirSync(evozeusHome, { recursive: true });
      writeFileSync(markerPath, marker);

      const result = runInstall(workspace, evozeusHome, ["--approve-write"], { preflightReport: report });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /local installation state changed after preflight/);
      assert.equal(readFileSync(markerPath, "utf8"), marker);
      assert.equal(existsSync(join(evozeusHome, "install-manifest.json")), false);
      assert.equal(existsSync(join(evozeusHome, "skeleton")), false);
    }));

  it("rejects a dangling CLI symlink without following it or writing fresh state", () =>
    withTempInstall(({ root, workspace, evozeusHome }) => {
      const report = preflightReport(evozeusHome);
      const cliPath = join(evozeusHome, "bin", "evozeus");
      mkdirSync(join(evozeusHome, "bin"), { recursive: true });
      symlinkSync(join(root, "outside-missing-target"), cliPath);

      const result = runInstall(workspace, evozeusHome, ["--approve-write"], { preflightReport: report });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /expected not_installed, found unknown_or_unverifiable/);
      assert.equal(lstatSync(cliPath).isSymbolicLink(), true);
      assert.equal(existsSync(join(evozeusHome, "registration.json")), false);
      assert.equal(existsSync(join(evozeusHome, "install-manifest.json")), false);
      assert.equal(existsSync(join(evozeusHome, "skeleton")), false);
    }));

  it("allows fresh writes only when EVOZEUS_HOME is missing or strictly empty", () => {
    withTempInstall(({ workspace, evozeusHome }) => {
      mkdirSync(evozeusHome, { recursive: true });
      const result = parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));
      assert.equal(result.write_mode, "approved_write");
      assert.equal(result.registration_home_state, "existing_evozeus_home");
    });

    for (const entry of ["skeleton", "update-policy.json"]) {
      withTempInstall(({ root, workspace, evozeusHome }) => {
        const report = preflightReport(evozeusHome);
        const path = join(evozeusHome, entry);
        mkdirSync(evozeusHome, { recursive: true });
        symlinkSync(join(root, `outside-${entry.replaceAll("/", "-")}`), path);

        const result = runInstall(workspace, evozeusHome, ["--approve-write"], { preflightReport: report });

        assert.notEqual(result.status, 0, entry);
        assert.match(result.stderr, /expected not_installed, found unknown_or_unverifiable/, entry);
        assert.equal(lstatSync(path).isSymbolicLink(), true, entry);
        assert.equal(existsSync(join(evozeusHome, "registration.json")), false, entry);
        assert.equal(existsSync(join(evozeusHome, "install-manifest.json")), false, entry);
      });
    }
  });

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

      const updatePolicyPath = join(evozeusHome, "update-policy.json");
      unlinkSync(updatePolicyPath);
      const preflightResult = spawnSync(join(evozeusHome, "bin/evozeus"), ["install", "preflight", "--json"], {
        cwd: workspace,
        encoding: "utf8",
        env: {
          ...process.env,
          NODE_ENV: "test",
          EVOZEUS_HOSTS_AVAILABLE: "codex",
          EVOZEUS_PREFLIGHT_TEST_RELEASE_TAG: "v0.4.1"
        }
      });
      const preflight = parseStdout(preflightResult);
      assert.equal(preflight.operation, "system.installPreflight");
      assert.equal(preflight.writes, false);
      assert.equal(preflight.local_state.status, "legacy_migration_required");
      assert.equal(existsSync(updatePolicyPath), false);
    }));

  it("rejects an existing installation instead of reconciling it through the fresh installer", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));
      const firstRegistration = readJson(join(evozeusHome, "registration.json"));

      const second = runInstall(workspace, evozeusHome, ["--approve-write"], {
        preflightReport: preflightReport(evozeusHome, "repair_required")
      });
      const secondRegistration = readJson(join(evozeusHome, "registration.json"));

      assert.notEqual(second.status, 0);
      assert.match(second.stderr, /fresh install is allowed only for not_installed/);
      assert.deepEqual(secondRegistration, firstRegistration);
    }));

  it("does not plan reconciliation for an existing installation in dry-run mode", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));

      const result = runInstall(workspace, evozeusHome);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /expected not_installed/);
      assert.doesNotMatch(result.stdout, /would_reconcile/);
    }));

  it("preserves a broken installation for the dedicated repair route", () =>
    withTempInstall(({ workspace, evozeusHome }) => {
      parseStdout(runInstall(workspace, evozeusHome, ["--approve-write"]));
      const installedSkill = join(evozeusHome, "skeleton/skills/using-evozeus/SKILL.md");
      unlinkSync(installedSkill);
      assert.equal(existsSync(installedSkill), false);

      const result = runInstall(workspace, evozeusHome, ["--approve-write"], {
        preflightReport: preflightReport(evozeusHome, "repair_required")
      });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /fresh install is allowed only for not_installed/);
      assert.equal(existsSync(installedSkill), false);
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
