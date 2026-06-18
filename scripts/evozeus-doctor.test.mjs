import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const SCRIPT = new URL("./evozeus-doctor.mjs", import.meta.url);

const READY_CHECKS = {
  infra: {
    release: { status: "up_to_date", source: "main_fallback", resolved_ref: "main" },
    download: { status: "complete" },
    smoke: { status: "passed", command: "npm run test:infra-components" }
  },
  factors: {
    release: { status: "up_to_date", source: "main_fallback", resolved_ref: "main" },
    download: { status: "complete" },
    smoke: { status: "passed", command: "npm run test:official-factor-runner" }
  }
};

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
  it("guides outdated bootstrap reports toward user-approved update", () => {
    const result = runDoctor({
      release: {
        status: "outdated",
        source: "main_fallback",
        resolved_ref: "main",
        resolved_url: "https://github.com/MetaInFLow/EvoZeus/tree/main",
        local_ref: "feature@abc123"
      },
      next_action: {
        requires_user_approval: true,
        reason: "install_or_update"
      }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /doctor_verdict: install_or_update/);
    assert.match(result.stdout, /requires_user_approval: true/);
    assert.match(result.stdout, /Ask the user before updating local EvoZeus to main/);
  });

  it("guides ready bootstrap reports toward protocol-only judgment", () => {
    const result = runDoctor({
      release: {
        status: "up_to_date",
        source: "release",
        resolved_ref: "v1.0.0",
        resolved_url: "https://github.com/MetaInFLow/EvoZeus/releases/tag/v1.0.0",
        local_ref: "main@abc123"
      },
      ...READY_CHECKS,
      next_action: {
        requires_user_approval: true,
        reason: "run_judgment"
      }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /doctor_verdict: ready_for_protocol_judgment/);
    assert.match(result.stdout, /available_capabilities: .*protocol-only judgment/);
    assert.match(result.stdout, /available_capabilities: .*health doctor diagnostics/);
    assert.match(result.stdout, /available_capabilities: .*fixture-only scanner\/runner infra smoke/);
    assert.match(result.stdout, /available_capabilities: .*fixture-only official factor runner smoke/);
    assert.match(result.stdout, /approval_required_capabilities: .*workspace scan/);
    assert.match(result.stdout, /approval_required_capabilities: .*factor execution on user data/);
    assert.match(result.stdout, /Session Verdict Card/);
  });

  it("reports complete component downloads before protocol judgment", () => {
    const result = withTempWorkspace(
      [
        "SKILL.md",
        "skills/index/SKILL.md",
        "skills/evozeus-install-registration/SKILL.md",
        "scripts/evozeus-doctor.mjs"
      ],
      (cwd) =>
        runDoctor(
          {
            release: { status: "up_to_date", resolved_ref: "main" },
            ...READY_CHECKS,
            next_action: { requires_user_approval: true, reason: "run_judgment" }
          },
          { cwd }
        )
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /components_status: complete/);
    assert.match(result.stdout, /doctor_verdict: ready_for_protocol_judgment/);
  });

  it("blocks protocol judgment when required components are missing", () => {
    const result = withTempWorkspace(["SKILL.md", "scripts/evozeus-doctor.mjs"], (cwd) =>
      runDoctor(
        {
          release: { status: "up_to_date", resolved_ref: "main" },
          next_action: { requires_user_approval: true, reason: "run_judgment" }
        },
        { cwd }
      )
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /components_status: incomplete/);
    assert.match(result.stdout, /missing_components: skills\/index\/SKILL\.md, skills\/evozeus-install-registration\/SKILL\.md/);
    assert.match(result.stdout, /doctor_verdict: install_or_update/);
    assert.doesNotMatch(result.stdout, /ready_for_protocol_judgment/);
  });

  it("collects runtime evidence before protocol judgment when infra and factor checks are missing", () => {
    const result = withTempWorkspace(
      [
        "SKILL.md",
        "skills/index/SKILL.md",
        "skills/evozeus-install-registration/SKILL.md",
        "scripts/evozeus-doctor.mjs"
      ],
      (cwd) =>
        runDoctor(
          {
            release: { status: "up_to_date", resolved_ref: "main" },
            next_action: { requires_user_approval: true, reason: "run_judgment" }
          },
          { cwd }
        )
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /infra_release_status: unknown/);
    assert.match(result.stdout, /factor_release_status: unknown/);
    assert.match(result.stdout, /doctor_verdict: collect_runtime_evidence/);
    assert.match(result.stdout, /scanner\/runner infra and official factor checks/);
    assert.doesNotMatch(result.stdout, /ready_for_protocol_judgment/);
  });

  it("asks for update when scanner and runner infra is behind the resolved source", () => {
    const result = withTempWorkspace(
      [
        "SKILL.md",
        "skills/index/SKILL.md",
        "skills/evozeus-install-registration/SKILL.md",
        "scripts/evozeus-doctor.mjs"
      ],
      (cwd) =>
        runDoctor(
          {
            release: { status: "up_to_date", resolved_ref: "main" },
            infra: {
              release: { status: "outdated", source: "release", resolved_ref: "runtime-v0.2.0" },
              download: { status: "complete" },
              smoke: { status: "passed", command: "npm run test:infra-components" }
            },
            factors: READY_CHECKS.factors,
            next_action: { requires_user_approval: true, reason: "run_judgment" }
          },
          { cwd }
        )
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /infra_release_status: outdated/);
    assert.match(result.stdout, /doctor_verdict: install_or_update/);
    assert.match(result.stdout, /Ask the user before updating scanner\/runner infra to runtime-v0\.2\.0/);
  });

  it("asks for official factor download when the resolved factor release is missing locally", () => {
    const result = withTempWorkspace(
      [
        "SKILL.md",
        "skills/index/SKILL.md",
        "skills/evozeus-install-registration/SKILL.md",
        "scripts/evozeus-doctor.mjs"
      ],
      (cwd) =>
        runDoctor(
          {
            release: { status: "up_to_date", resolved_ref: "main" },
            infra: READY_CHECKS.infra,
            factors: {
              release: { status: "up_to_date", source: "main_fallback", resolved_ref: "main" },
              download: { status: "missing" },
              smoke: { status: "skipped", command: "npm run test:official-factor-runner" }
            },
            next_action: { requires_user_approval: true, reason: "run_judgment" }
          },
          { cwd }
        )
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /factor_release_status: up_to_date/);
    assert.match(result.stdout, /factor_download_status: missing/);
    assert.match(result.stdout, /doctor_verdict: install_or_update/);
    assert.match(result.stdout, /Ask the user before downloading official factors from main/);
  });

  it("blocks on infra smoke failures before protocol judgment", () => {
    const result = withTempWorkspace(
      [
        "SKILL.md",
        "skills/index/SKILL.md",
        "skills/evozeus-install-registration/SKILL.md",
        "scripts/evozeus-doctor.mjs"
      ],
      (cwd) =>
        runDoctor(
          {
            release: { status: "up_to_date", resolved_ref: "main" },
            infra: {
              release: { status: "up_to_date", source: "main_fallback", resolved_ref: "main" },
              download: { status: "complete" },
              smoke: { status: "failed", command: "npm run test:infra-components", summary: "factor-runner failed" }
            },
            factors: READY_CHECKS.factors,
            next_action: { requires_user_approval: true, reason: "run_judgment" }
          },
          { cwd }
        )
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /infra_smoke_status: failed/);
    assert.match(result.stdout, /doctor_verdict: fix_environment/);
    assert.match(result.stdout, /Fix scanner\/runner infra smoke failure: factor-runner failed/);
  });

  it("blocks on downloaded factor smoke failures before protocol judgment", () => {
    const result = withTempWorkspace(
      [
        "SKILL.md",
        "skills/index/SKILL.md",
        "skills/evozeus-install-registration/SKILL.md",
        "scripts/evozeus-doctor.mjs"
      ],
      (cwd) =>
        runDoctor(
          {
            release: { status: "up_to_date", resolved_ref: "main" },
            infra: READY_CHECKS.infra,
            factors: {
              release: { status: "up_to_date", source: "main_fallback", resolved_ref: "main" },
              download: { status: "complete" },
              smoke: { status: "failed", command: "npm run test:official-factor-runner", summary: "missing factor id" }
            },
            next_action: { requires_user_approval: true, reason: "run_judgment" }
          },
          { cwd }
        )
    );

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /factor_smoke_status: failed/);
    assert.match(result.stdout, /doctor_verdict: fix_environment/);
    assert.match(result.stdout, /Fix downloaded official factor smoke failure: missing factor id/);
  });
});
