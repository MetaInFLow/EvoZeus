import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SCRIPT = fileURLToPath(new URL("./evozeus-cli.mjs", import.meta.url));

function withTempWorkspace(callback) {
  const root = mkdtempSync(join(tmpdir(), "evozeus-cli-"));
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: options.cwd,
    input: options.input,
    encoding: "utf8"
  });
}

function parseJson(result, expectedStatus = 0) {
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

describe("evozeus-cli", () => {
  it("describes P0 capabilities as JSON", () => {
    const result = runCli(["capabilities", "--json"]);
    const report = parseJson(result);
    const names = report.data.capabilities.map((capability) => capability.name);

    assert.equal(report.ok, true);
    assert.equal(report.operation, "capabilities.describe");
    assert.ok(names.includes("session.analyze"));
    assert.ok(names.includes("harness.attachPlan"));
    assert.ok(names.includes("system.updatePlan"));
    assert.ok(names.includes("system.uninstallPlan"));
    assert.equal(
      report.data.capabilities.find((capability) => capability.name === "session.scanPlan").requires_approval,
      true
    );
  });

  it("prints help without crashing", () => {
    const result = runCli(["--help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: evozeus/);
    assert.match(result.stdout, /session analyze/);
  });

  it("rejects session analysis without explicit input", () => {
    const result = runCli(["session", "analyze", "--json"]);
    const report = parseJson(result, 1);

    assert.equal(report.ok, false);
    assert.equal(report.operation, "session.analyze");
    assert.equal(report.error.code, "MISSING_EXPLICIT_INPUT");
  });

  it("analyzes only an explicit session file", () =>
    withTempWorkspace((workspace) => {
      const sessionPath = join(workspace, "session.md");
      writeFileSync(sessionPath, "User asks to fix a broken skill.\nAgent retries after a tool failure.\n");

      const result = runCli(["session", "analyze", "--input", sessionPath, "--json"], { cwd: workspace });
      const report = parseJson(result);

      assert.equal(report.ok, true);
      assert.equal(report.operation, "session.analyze");
      assert.equal(report.data.verdict_card.input.kind, "file");
      assert.equal(report.data.verdict_card.input.bytes > 0, true);
      assert.ok(report.data.verdict_card.signals.includes("tool_or_runtime_failure"));
      assert.ok(report.data.verdict_card.signals.includes("candidate_for_reusable_asset"));
      assert.equal(report.data.privacy.raw_session_stored, false);
      assert.equal(report.data.privacy.scanned_local_store, false);
      assert.equal(existsSync(join(workspace, ".evozeus/reports")), false);
    }));

  it("analyzes stdin when explicitly requested", () => {
    const result = runCli(["session", "analyze", "--input", "-", "--json"], {
      input: "Agent session from stdin with a retry.\n"
    });
    const report = parseJson(result);

    assert.equal(report.data.verdict_card.input.kind, "stdin");
    assert.ok(report.data.verdict_card.signals.includes("retry_or_rework"));
  });

  it("resolves relative session input from --workspace", () =>
    withTempWorkspace((workspace) => {
      writeFileSync(join(workspace, "relative-session.md"), "A session with a failed tool call.\n");

      const result = runCli(
        ["--workspace", workspace, "session", "analyze", "--input", "relative-session.md", "--json"],
        { cwd: "/" }
      );
      const report = parseJson(result);

      assert.equal(report.workspace.root, workspace);
      assert.equal(report.data.verdict_card.input.kind, "file");
      assert.ok(report.data.verdict_card.signals.includes("tool_or_runtime_failure"));
    }));

  it("requires dry-run for local session scan planning", () => {
    const result = runCli(["session", "scan", "--json"]);
    const report = parseJson(result, 1);

    assert.equal(report.ok, false);
    assert.equal(report.error.code, "DRY_RUN_REQUIRED");
    assert.equal(report.approval.required, true);
  });

  it("plans a local session scan without reading raw stores", () => {
    const result = runCli(["session", "scan", "--dry-run", "--json"]);
    const report = parseJson(result);

    assert.equal(report.operation, "session.scanPlan");
    assert.equal(report.approval.required, true);
    assert.equal(report.data.scan_plan.reads_raw_store_now, false);
    assert.ok(report.data.scan_plan.forbidden_in_this_command.includes("reading raw session files"));
  });

  it("creates a harness handoff plan without writing target repo files", () =>
    withTempWorkspace((workspace) => {
      const skillRoot = join(workspace, "skills/example");
      mkdirSync(skillRoot, { recursive: true });
      writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: example\n---\n");

      const result = runCli(["harness", "attach", "--target", "skills/example", "--json"], { cwd: workspace });
      const report = parseJson(result);

      assert.equal(report.operation, "harness.attachPlan");
      assert.equal(report.data.handoff_plan.target.kind, "skill");
      assert.equal(report.data.handoff_plan.writes_now, false);
      assert.equal(existsSync(join(skillRoot, ".evozeus-wrapper")), false);
    }));

  it("returns update and uninstall dry-run plans without writing", () =>
    withTempWorkspace((workspace) => {
      const update = parseJson(runCli(["update", "--dry-run", "--json"], { cwd: workspace }));
      const uninstall = parseJson(runCli(["uninstall", "--dry-run", "--json"], { cwd: workspace }));

      assert.equal(update.operation, "system.updatePlan");
      assert.equal(update.approval.required, true);
      assert.equal(update.data.update_plan.writes_now, false);
      assert.equal(uninstall.operation, "system.uninstallPlan");
      assert.equal(uninstall.approval.required, true);
      assert.equal(uninstall.data.uninstall_plan.writes_now, false);
      assert.equal(existsSync(join(workspace, ".evozeus")), false);
    }));
});
