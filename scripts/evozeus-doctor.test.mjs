import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const SCRIPT = new URL("./evozeus-doctor.mjs", import.meta.url);

const READY_CHECKS = {
  runtime: {
    smoke: { status: "passed", command: "python -m pytest packages/runtime" }
  },
  session_signal: {
    smoke: { status: "passed", command: "python -m pytest packs/session-signal" }
  }
};

const COMPLETE_COMPONENTS = [
  "SKILL.md",
  "skills/using-evozeus/SKILL.md",
  "skills/maintain-evozeus/SKILL.md",
  "packages/runtime/src/evozeus_runtime/cli/main.py",
  "packs/session-signal/scripts/validate_official_factor_spec.py",
  "scripts/evozeus-cli.mjs",
  "scripts/evozeus-install.mjs",
  "scripts/evozeus-doctor.mjs"
];

function runDoctor(report, options = {}) {
  return spawnSync(process.execPath, [SCRIPT.pathname], {
    cwd: options.cwd,
    input: `${JSON.stringify(report)}\n`,
    encoding: "utf8"
  });
}

function withTempWorkspace(files, callback) {
  const root = mkdtempSync(join(tmpdir(), "evozeus-doctor-"));
  try {
    for (const file of files) {
      const path = join(root, file);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, "placeholder\n");
    }
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("evozeus-doctor", () => {
  it("guides an outdated product toward a user-approved update", () => {
    const result = runDoctor({
      release: { status: "outdated", resolved_ref: "v0.4.0" },
      next_action: { reason: "install_or_update" }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /doctor_verdict: install_or_update/);
    assert.match(result.stdout, /Ask the user before updating local EvoZeus to v0\.4\.0/);
  });

  it("reports a ready plugin product with embedded Runtime and Session Signal", () =>
    withTempWorkspace(COMPLETE_COMPONENTS, (cwd) => {
      const result = runDoctor(
        {
          release: { status: "up_to_date", resolved_ref: "v0.4.0" },
          ...READY_CHECKS,
          next_action: { reason: "run_judgment" }
        },
        { cwd }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /components_status: complete/);
      assert.match(result.stdout, /runtime_distribution: embedded_in_evozeus/);
      assert.match(result.stdout, /session_signal_distribution: embedded_in_evozeus/);
      assert.match(result.stdout, /available_capabilities: .*built-in Runtime health check/);
      assert.match(result.stdout, /available_capabilities: .*built-in Session Signal health check/);
      assert.match(result.stdout, /doctor_verdict: ready_for_protocol_judgment/);
      assert.match(result.stdout, /ask for the user's real task in normal language/);
    }));

  it("blocks when required embedded product files are missing", () =>
    withTempWorkspace(["SKILL.md", "scripts/evozeus-doctor.mjs"], (cwd) => {
      const result = runDoctor(
        {
          release: { status: "up_to_date", resolved_ref: "v0.4.0" },
          next_action: { reason: "run_judgment" }
        },
        { cwd }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /components_status: incomplete/);
      assert.match(result.stdout, /packages\/runtime\/src\/evozeus_runtime\/cli\/main\.py/);
      assert.match(result.stdout, /packs\/session-signal\/scripts\/validate_official_factor_spec\.py/);
      assert.match(result.stdout, /doctor_verdict: install_or_update/);
    }));

  it("reports missing embedded smoke evidence without inventing separate updates", () =>
    withTempWorkspace(COMPLETE_COMPONENTS, (cwd) => {
      const result = runDoctor(
        {
          release: { status: "up_to_date", resolved_ref: "v0.4.0" },
          next_action: { reason: "run_judgment" }
        },
        { cwd }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /runtime_smoke_status: unknown/);
      assert.match(result.stdout, /session_signal_smoke_status: unknown/);
      assert.match(result.stdout, /built-in Runtime needs smoke evidence/);
      assert.match(result.stdout, /built-in Session Signal needs smoke evidence/);
      assert.doesNotMatch(result.stdout, /download.*factor/i);
    }));

  it("ignores obsolete separate Runtime release metadata", () =>
    withTempWorkspace(COMPLETE_COMPONENTS, (cwd) => {
      const result = runDoctor(
        {
          release: { status: "up_to_date", resolved_ref: "v0.4.0" },
          runtime: {
            release: { status: "outdated", resolved_ref: "v0.2.0" },
            smoke: READY_CHECKS.runtime.smoke
          },
          session_signal: READY_CHECKS.session_signal,
          next_action: { reason: "runtime" }
        },
        { cwd }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /doctor_verdict: ready_for_protocol_judgment/);
      assert.doesNotMatch(result.stdout, /updating scanner\/runner infra/);
    }));

  it("collects embedded smoke evidence before Runtime use", () =>
    withTempWorkspace(COMPLETE_COMPONENTS, (cwd) => {
      const result = runDoctor(
        {
          release: { status: "up_to_date", resolved_ref: "v0.4.0" },
          runtime: READY_CHECKS.runtime,
          session_signal: { smoke: { status: "skipped" } },
          next_action: { reason: "runtime" }
        },
        { cwd }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /doctor_verdict: collect_runtime_evidence/);
      assert.match(result.stdout, /Run the built-in Runtime and Session Signal smoke checks/);
    }));

  it("blocks on a built-in Runtime smoke failure", () =>
    withTempWorkspace(COMPLETE_COMPONENTS, (cwd) => {
      const result = runDoctor(
        {
          release: { status: "up_to_date", resolved_ref: "v0.4.0" },
          runtime: { smoke: { status: "failed", summary: "factor-runner failed" } },
          session_signal: READY_CHECKS.session_signal,
          next_action: { reason: "runtime" }
        },
        { cwd }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /runtime_smoke_status: failed/);
      assert.match(result.stdout, /doctor_verdict: fix_environment/);
      assert.match(result.stdout, /Fix the built-in Runtime smoke failure: factor-runner failed/);
    }));

  it("blocks on a built-in Session Signal smoke failure", () =>
    withTempWorkspace(COMPLETE_COMPONENTS, (cwd) => {
      const result = runDoctor(
        {
          release: { status: "up_to_date", resolved_ref: "v0.4.0" },
          runtime: READY_CHECKS.runtime,
          session_signal: { smoke: { status: "failed", summary: "missing factor id" } },
          next_action: { reason: "runtime" }
        },
        { cwd }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /session_signal_smoke_status: failed/);
      assert.match(result.stdout, /doctor_verdict: fix_environment/);
      assert.match(result.stdout, /Fix the built-in Session Signal smoke failure: missing factor id/);
    }));
});
