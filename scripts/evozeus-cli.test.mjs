import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const SCRIPT = fileURLToPath(new URL("./evozeus-cli.mjs", import.meta.url));

function stableManifest() {
  const versions = { evozeus: "v0.4.0", coevolve: "v0.13.0" };
  return {
    schema_version: "evozeus.product-channel.v2",
    product_version: "v0.4.0",
    channel: "stable",
    generated_at: "2026-07-26T00:00:00Z",
    components: Object.fromEntries(Object.entries(versions).map(([id, version], index) => [
      id,
      {
        version,
        commit: String(index + 1).repeat(40),
        source: {
          kind: "release_archive",
          url: `https://example.invalid/${id}.tar.gz`,
          ref: version,
          sha256: `sha256:${String(index + 1).repeat(64)}`
        },
        required_paths: ["SKILL.md"]
      }
    ])),
    embedded: {
      runtime: {
        version: "v0.2.0",
        path: "packages/runtime",
        required_paths: ["src/evozeus_runtime/cli/main.py"]
      },
      session_signal: {
        version: "v0.1.0",
        path: "packs/session-signal",
        required_paths: ["scripts/validate_official_factor_spec.py"]
      }
    },
    compatibility: {
      runtime_min_inclusive: "0.1.0",
      runtime_max_exclusive: "0.3.0",
      coevolve_contract: "v1.0.0"
    }
  };
}

function withTempWorkspace(callback) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "evozeus-cli-")));
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runCli(args, options = {}) {
  const evozeusHome = options.evozeusHome ?? (options.cwd ? join(options.cwd, "home", ".evozeus") : join(tmpdir(), "evozeus-cli-test-missing-home"));
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: options.cwd,
    input: options.input,
    encoding: "utf8",
    env: {
      ...process.env,
      EVOZEUS_HOSTS_AVAILABLE: "none",
      ...options.env,
      EVOZEUS_HOME: evozeusHome
    }
  });
}

function parseJson(result, expectedStatus = 0) {
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function initGitRepo(root) {
  const result = spawnSync("git", ["init", "-b", "main"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

describe("evozeus-cli", () => {
  it("describes P0 capabilities as JSON", () => {
    const result = runCli(["capabilities", "--json"]);
    const report = parseJson(result);
    const names = report.data.capabilities.map((capability) => capability.name);

    assert.equal(report.ok, true);
    assert.equal(report.operation, "capabilities.describe");
    assert.ok(names.includes("session.analyze"));
    assert.ok(names.includes("system.installPreflight"));
    assert.ok(names.includes("harness.attachPlan"));
    assert.ok(names.includes("system.updatePlan"));
    assert.ok(names.includes("system.uninstallPlan"));
    assert.equal(
      report.data.capabilities.find((capability) => capability.name === "session.scanPlan").requires_approval,
      true
    );
    assert.equal(
      report.data.capabilities.find((capability) => capability.name === "system.installPreflight").input_schema.properties.channel.const,
      "stable"
    );
  });

  it("describes product features by lifecycle as JSON", () => {
    const result = runCli(["features", "--json"]);
    const report = parseJson(result);
    const orderedIds = report.data.features.map((feature) => feature.id);
    const features = new Map(report.data.features.map((feature) => [feature.id, feature]));

    assert.equal(report.ok, true);
    assert.equal(report.operation, "features.describe");
    assert.deepEqual(orderedIds.slice(0, 2), ["insights.sessions", "coevolve.target"]);
    assert.equal(features.get("insights.sessions").product_tier, "primary");
    assert.equal(features.get("coevolve.target").product_tier, "primary");
    assert.ok(report.data.features.slice(2).every((feature) => feature.product_tier === "supporting"));
    assert.ok(features.has("review.session"));
    assert.ok(features.has("insights.sessions"));
    assert.ok(features.has("preserve.artifact"));
    assert.ok(features.has("coevolve.target"));
    assert.equal(features.get("review.session").command, "evozeus review session --input <path|-> --json");
    assert.equal(features.get("insights.sessions").backend_owner, "EvoZeus");
    assert.equal(features.get("insights.sessions").command, "evozeus insights plan --source codex --json");
    assert.match(features.get("insights.sessions").user_goal, /当前只支持 Codex/);
    assert.match(features.get("insights.sessions").approval_boundary, /supports Codex history only/);
    assert.ok(features.get("insights.sessions").related_capabilities.includes("insights.plan"));
    assert.equal(features.get("preserve.artifact").command, "evozeus preserve draft --from-report <path> --json");
    assert.equal(features.get("coevolve.target").backend_owner, "EvoZeus-CoEvolve");
    assert.ok(features.get("coevolve.target").related_capabilities.includes("harness.attachPlan"));
  });

  it("prints a human-readable product feature menu", () => {
    const result = runCli(["features"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /EvoZeus Features/);
    assert.ok(
      result.stdout.indexOf("Build an AI usage profile from approved local Codex history") <
        result.stdout.indexOf("Review one explicit session")
    );
    assert.match(result.stdout, /Build an AI usage profile from approved local Codex history/);
    assert.match(result.stdout, /Attach a CoEvolve Harness to an independent Skillware repository/);
    assert.match(result.stdout, /Review one explicit session/);
    assert.match(result.stdout, /Preserve a Verdict \/ report as an artifact draft/);
  });

  it("prints help without crashing", () => {
    const result = runCli(["--help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: evozeus/);
    assert.match(result.stdout, /install preflight/);
    assert.match(result.stdout, /features --json/);
    assert.match(result.stdout, /review session/);
    assert.match(result.stdout, /insights plan/);
    assert.match(result.stdout, /preserve draft/);
    assert.match(result.stdout, /coevolve attach/);
    assert.match(result.stdout, /session analyze/);
    assert.match(result.stdout, /approve-feedback/);
  });

  it("exposes the read-only local-state-first install preflight", () =>
    withTempWorkspace((workspace) => {
      const evozeusHome = join(workspace, "home", ".evozeus");
      const result = runCli(["install", "preflight", "--channel", "stable", "--approve-feedback", "--json"], {
        cwd: workspace,
        evozeusHome,
        env: {
          NODE_ENV: "test",
          EVOZEUS_HOSTS_AVAILABLE: "codex",
          EVOZEUS_PREFLIGHT_TEST_RELEASE_TAG: "v0.4.1"
        }
      });
      const report = parseJson(result);

      assert.equal(report.operation, "system.installPreflight");
      assert.equal(report.schema_version, "evozeus.install-preflight.v1");
      assert.equal(report.status === "ready" || report.status === "ready_with_fallbacks", true);
      assert.equal(report.writes, false);
      assert.deepEqual(report.target, { channel: "stable", evozeus_home: evozeusHome });
      assert.equal(report.local_state.status, "not_installed");
      assert.equal(report.network.product_assets_downloaded, 0);
      assert.equal("activity" in report, false);
      assert.equal(existsSync(evozeusHome), false);
    }));

  it("fails closed on UAT install preflight without refresh, activity, or network", () =>
    withTempWorkspace((workspace) => {
      const evozeusHome = join(workspace, "home", ".evozeus");
      const result = runCli(["install", "preflight", "--channel", "uat", "--approve-feedback", "--json"], {
        cwd: workspace,
        evozeusHome
      });
      const report = parseJson(result, 2);

      assert.equal(report.status, "blocked");
      assert.deepEqual(report.target, { channel: "uat", evozeus_home: evozeusHome });
      assert.ok(report.blockers.some((item) => item.code === "PREFLIGHT_CHANNEL_UNSUPPORTED"));
      assert.equal(report.network.head_requests, 0);
      assert.equal("activity" in report, false);
      assert.equal(existsSync(evozeusHome), false);
    }));

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

  it("includes a privacy-preserving activity payload when a runtime identity exists", () =>
    withTempWorkspace((workspace) => {
      const evozeusHome = join(workspace, "home", ".evozeus");
      mkdirSync(evozeusHome, { recursive: true });
      writeFileSync(
        join(evozeusHome, "registration.json"),
        JSON.stringify(
          {
            status: "registered",
            agent_handle: "codex-test",
            identity: {
              runtime_instance_hash: "a".repeat(64)
            }
          },
          null,
          2
        )
      );
      writeFileSync(join(workspace, "session.md"), "A private session with a failed skill wrapper.\n");

      const result = runCli(["session", "analyze", "--input", "session.md", "--json"], { cwd: workspace, evozeusHome });
      const report = parseJson(result);

      assert.equal(report.activity.feedback_status, "pending_approval");
      assert.equal(report.activity.payload.runtime_instance_hash, "a".repeat(64));
      assert.equal(report.activity.payload.agent_handle, "codex-test");
      assert.equal(report.activity.payload.event_kind, "session.analyzed");
      assert.equal(report.activity.payload.target.label, "Private session");
      assert.doesNotMatch(JSON.stringify(report.activity.payload), /session\.md/);
    }));

  it("analyzes stdin when explicitly requested", () => {
    const result = runCli(["session", "analyze", "--input", "-", "--json"], {
      input: "Agent session from stdin with a retry.\n"
    });
    const report = parseJson(result);

    assert.equal(report.data.verdict_card.input.kind, "stdin");
    assert.ok(report.data.verdict_card.signals.includes("retry_or_rework"));
  });

  it("supports review session as the product alias for session analysis", () => {
    const result = runCli(["review", "session", "--input", "-", "--json"], {
      input: "Agent session from stdin with a retry.\n"
    });
    const report = parseJson(result);

    assert.equal(report.operation, "session.analyze");
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

  it("plans session insights through the embedded Runtime without reading raw stores", () => withTempWorkspace((workspace) => {
    const result = runCli(["insights", "plan", "--source", "codex", "--json"], {
      cwd: workspace
    });
    const report = parseJson(result);

    assert.equal(report.operation, "insights.plan");
    assert.equal(report.data.insights_plan.reads_raw_store_now, false);
    assert.equal(report.data.insights_plan.source, "codex");
    assert.equal(report.data.backend.owner, "EvoZeus");
    assert.equal(report.data.backend.available, true);
    assert.match(report.data.backend.detected_path, /packages\/runtime$/);
    assert.ok(report.data.backend.command.argv.includes("session-insights"));
    assert.ok(report.data.insights_plan.forbidden_in_this_command.includes("reading raw session files"));
  }));

  it("rejects unsupported insight providers before planning or backend execution", () =>
    withTempWorkspace((workspace) => {
      for (const args of [
        ["insights", "plan", "--source", "claude", "--json"],
        ["insights", "sessions", "--source", "claude", "--json"]
      ]) {
        const result = runCli(args, { cwd: workspace });
        const report = parseJson(result, 1);

        assert.equal(report.ok, false);
        assert.equal(report.error.code, "UNSUPPORTED_INSIGHTS_SOURCE");
        assert.match(report.error.message, /Codex history only/);
        assert.equal("data" in report, false);
        assert.equal(existsSync(join(workspace, ".evozeus")), false);
      }
    }));

  it("requires explicit approval before running session insights", () => {
    const result = runCli(["insights", "sessions", "--source", "codex", "--reuse-factors", "--html", "--json"]);
    const report = parseJson(result);

    assert.equal(report.operation, "insights.sessions");
    assert.equal(report.approval.required, true);
    assert.equal(report.data.execution.writes_now, false);
    assert.equal(report.data.execution.runs_backend_now, false);
    assert.ok(report.data.backend.command.argv.includes("session-insights"));
    assert.ok(report.data.approval_required_for.includes("reading raw session files"));
  });

  it("plans project-scoped insights with project parameters", () => {
    const result = runCli(["insights", "sessions", "--source", "codex", "--project", "daxing", "--project-mode", "keyword", "--json"]);
    const report = parseJson(result);

    assert.equal(report.operation, "insights.projectSessions");
    assert.equal(report.data.project.project_key, "daxing");
    assert.equal(report.data.project.project_mode, "keyword");
    assert.ok(report.data.backend.command.argv.includes("project-insights"));
    assert.ok(report.data.backend.command.argv.includes("--contains"));
  });

  it("opens the integrated AI usage profile report by default", () =>
    withTempWorkspace((workspace) => {
      const result = runCli(["insights", "open", "--latest", "--json"], { cwd: workspace });
      const report = parseJson(result);

      assert.equal(report.operation, "insights.openReport");
      assert.ok(report.data.report.html_path.endsWith(".evozeus/runtime/reports/ai-usage-profile/index.html"));
      assert.equal(report.data.open_command[0], "open");
      assert.ok(report.data.open_command[1].endsWith(".evozeus/runtime/reports/ai-usage-profile/index.html"));
    }));

  it("creates a harness handoff plan without writing target repo files", () =>
    withTempWorkspace((workspace) => {
      initGitRepo(workspace);
      const skillRoot = join(workspace, "skills/example");
      mkdirSync(skillRoot, { recursive: true });
      writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: example\n---\n");

      const result = runCli(["harness", "attach", "--target", "skills/example", "--json"], { cwd: workspace });
      const report = parseJson(result);

      assert.equal(report.operation, "harness.attachPlan");
      assert.equal(report.data.handoff_plan.target.kind, "skill");
      assert.equal(report.data.handoff_plan.target.harness_eligible, true);
      assert.equal(realpathSync(report.data.handoff_plan.target_harness_root), realpathSync(workspace));
      assert.equal(report.data.handoff_plan.writes_now, false);
      assert.equal(report.data.handoff_plan.global_evozeus_home, "~/.evozeus");
      assert.equal(report.data.handoff_plan.target_harness_dir, ".evozeus-wrapper");
      assert.equal(report.data.handoff_plan.legacy_target_infra_dir, ".evozeus_evoinfra");
      assert.equal(report.data.handoff_plan.oldest_target_infra_dir, ".evozeus");
      assert.equal(report.data.handoff_plan.manifest_path, ".evozeus-wrapper/wrapper.json");
      assert.equal(report.data.handoff_plan.maintenance_authority.required_permission, "ADMIN");
      assert.equal(report.data.handoff_plan.maintenance_authority.verified_now, false);
      assert.equal(existsSync(join(workspace, ".evozeus-wrapper")), false);
    }));

  it("refuses to assign a Harness to a directory without an independent Git repo", () =>
    withTempWorkspace((workspace) => {
      const skillRoot = join(workspace, "skills/example");
      mkdirSync(skillRoot, { recursive: true });
      writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: example\n---\n");

      const report = parseJson(runCli(["harness", "attach", "--target", "skills/example", "--json"], { cwd: workspace }));

      assert.equal(report.data.handoff_plan.eligible, false);
      assert.equal(report.data.handoff_plan.target_harness_root, null);
      assert.match(report.data.handoff_plan.next_actions[0], /independent Git repository/);
    }));

  it("refuses a second Harness when the repository already contains a nested Harness", () =>
    withTempWorkspace((workspace) => {
      initGitRepo(workspace);
      const skillRoot = join(workspace, "skills/example");
      const nestedHarness = join(skillRoot, ".evozeus-wrapper");
      mkdirSync(nestedHarness, { recursive: true });
      writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: example\n---\n");
      writeFileSync(join(nestedHarness, "wrapper.json"), "{}\n");

      const report = parseJson(
        runCli(["harness", "attach", "--target", "skills/example", "--json"], { cwd: workspace })
      );

      assert.equal(report.data.handoff_plan.eligible, false);
      assert.deepEqual(report.data.handoff_plan.target.nested_harness_manifests, [
        "skills/example/.evozeus-wrapper/wrapper.json"
      ]);
      assert.match(report.data.handoff_plan.next_actions[0], /nested Harness/);
    }));

  it("delegates coevolve status to the installed backend contract", () =>
    withTempWorkspace((workspace) => {
      initGitRepo(workspace);
      const skillRoot = join(workspace, "skills/example");
      const infraRoot = join(workspace, ".evozeus-wrapper");
      const wrapperRoot = join(workspace, "EvoZeus-CoEvolve");
      const wrapperScript = join(wrapperRoot, "scripts/evozeus_wrapper.py");
      mkdirSync(infraRoot, { recursive: true });
      mkdirSync(skillRoot, { recursive: true });
      mkdirSync(join(wrapperRoot, "scripts"), { recursive: true });
      writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: example\n---\n");
      writeFileSync(
        join(infraRoot, "wrapper.json"),
        JSON.stringify({ wrapper_version: "v0.12.0", integration: { mode: "prompt_runtime_check" } }, null, 2)
      );
      writeFileSync(
        wrapperScript,
        [
          "import json, pathlib, sys",
          "target = pathlib.Path(sys.argv[sys.argv.index('--target') + 1])",
          "manifest_path = target / '.evozeus-wrapper' / 'wrapper.json'",
          "manifest = json.loads(manifest_path.read_text())",
          "print(json.dumps({'stage': 'target_skill_diagnosis', 'harness': {'state': 'complete', 'wrapper_version': manifest['wrapper_version'], 'active_manifest_path': str(manifest_path), 'active_manifest_relpath': '.evozeus-wrapper/wrapper.json', 'manifest_source': 'current', 'current_manifest_detected': True, 'migration_required': False, 'conflict': False}, 'skill': {'integration': manifest['integration']}}))"
        ].join("\n")
      );

      const result = runCli(["coevolve", "status", "--target", "skills/example", "--json"], {
        cwd: workspace,
        env: { EVOZEUS_WRAPPER_ROOT: wrapperRoot }
      });
      const report = parseJson(result);

      assert.equal(report.operation, "coevolve.status");
      assert.equal(report.data.target.kind, "skill");
      assert.equal(report.data.wrapper.manifest_exists, true);
      assert.equal(realpathSync(report.data.wrapper.manifest_path), realpathSync(join(infraRoot, "wrapper.json")));
      assert.equal(report.data.wrapper.wrapper_version, "v0.12.0");
      assert.equal(report.data.wrapper.manifest_source, "current");
      assert.equal(report.data.wrapper.migration_required, false);
      assert.equal(report.data.execution.runs_backend_now, true);
      assert.equal(report.data.execution.writes_now, false);
      assert.ok(report.data.backend.command.argv.includes("diagnose"));
      assert.equal(report.data.backend.executed, true);
      assert.equal(report.data.diagnosis.harness.current_manifest_detected, true);
    }));

  it("plans coevolve feedback audit without writing GitHub", () =>
    withTempWorkspace((workspace) => {
      initGitRepo(workspace);
      const skillRoot = join(workspace, "skills/example");
      mkdirSync(skillRoot, { recursive: true });
      writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: example\n---\n");

      const result = runCli(
        ["coevolve", "audit", "--target", "skills/example", "--user-input", "这个 skill 总是忽略我的项目上下文", "--json"],
        { cwd: workspace }
      );
      const report = parseJson(result);

      assert.equal(report.operation, "coevolve.auditFeedback");
      assert.equal(report.data.execution.writes_now, false);
      assert.equal(report.data.execution.github_writes_now, false);
      assert.ok(report.data.backend.command.argv.includes("audit"));
      assert.doesNotMatch(JSON.stringify(report.data), /忽略我的项目上下文/);
    }));

  it("supports coevolve attach as the product alias for wrapper handoff planning", () =>
    withTempWorkspace((workspace) => {
      initGitRepo(workspace);
      const skillRoot = join(workspace, "skills/example");
      mkdirSync(skillRoot, { recursive: true });
      writeFileSync(join(skillRoot, "SKILL.md"), "---\nname: example\n---\n");

      const result = runCli(["coevolve", "attach", "--target", "skills/example", "--json"], { cwd: workspace });
      const report = parseJson(result);

      assert.equal(report.operation, "harness.attachPlan");
      assert.equal(report.data.handoff_plan.target.kind, "skill");
      assert.equal(report.data.handoff_plan.target.repo_relative_target, "skills/example");
      assert.equal(report.data.handoff_plan.recommended_route, "EvoZeus-CoEvolve");
      assert.equal(report.data.handoff_plan.writes_now, false);
      assert.equal(existsSync(join(workspace, ".evozeus-wrapper")), false);
    }));

  it("marks public GitHub wrapper targets only when explicitly requested", () =>
    withTempWorkspace((workspace) => {
      const evozeusHome = join(workspace, "home", ".evozeus");
      mkdirSync(evozeusHome, { recursive: true });
      writeFileSync(
        join(evozeusHome, "registration.json"),
        JSON.stringify({ identity: { runtime_instance_hash: "b".repeat(64) } }, null, 2)
      );

      const result = runCli(
        [
          "harness",
          "attach",
          "--target",
          "https://github.com/MetaInFLow/EvoZeus",
          "--target-visibility",
          "public",
          "--json"
        ],
        { cwd: workspace, evozeusHome }
      );
      const report = parseJson(result);

      assert.equal(report.activity.payload.privacy, "public");
      assert.equal(report.activity.payload.target.label, "MetaInFLow/EvoZeus");
      assert.equal(report.activity.payload.target.url, "https://github.com/MetaInFLow/EvoZeus");
    }));

  it("returns update and uninstall dry-run plans without writing", () =>
    withTempWorkspace((workspace) => {
      const manifestPath = join(workspace, "stable.json");
      writeFileSync(manifestPath, `${JSON.stringify(stableManifest(), null, 2)}\n`);
      const update = parseJson(runCli(["update", "--channel", "stable", "--manifest", manifestPath, "--dry-run", "--json"], { cwd: workspace }));
      const uninstall = parseJson(runCli(["uninstall", "--dry-run", "--json"], { cwd: workspace }));

      assert.equal(update.operation, "system.updatePlan");
      assert.equal(update.approval.required, true);
      assert.equal(update.data.update_plan.writes_now, false);
      assert.equal(uninstall.operation, "system.uninstallPlan");
      assert.equal(uninstall.approval.required, true);
      assert.equal(uninstall.data.uninstall_plan.writes_now, false);
      assert.equal(existsSync(join(workspace, "home", ".evozeus")), false);
    }));

  it("plans one-command product and Codex plugin alignment without writing", () =>
    withTempWorkspace((workspace) => {
      const manifestPath = join(workspace, "stable.json");
      writeFileSync(manifestPath, `${JSON.stringify(stableManifest(), null, 2)}\n`);
      const result = runCli(
        [
          "align",
          "--channel",
          "stable",
          "--host",
          "codex",
          "--manifest",
          manifestPath,
          "--json"
        ],
        { cwd: workspace, env: { EVOZEUS_HOSTS_AVAILABLE: "codex" } }
      );
      const report = parseJson(result);

      assert.equal(report.operation, "system.alignPlan");
      assert.equal(report.data.channel, "stable");
      assert.equal(report.data.writes_now, false);
      assert.equal(report.data.plugin.plugin_id, "evozeus");
      assert.deepEqual(Object.keys(report.data.plugin.hosts), ["codex"]);
      assert.equal(existsSync(join(workspace, "home", ".evozeus")), false);
    }));

  it("exposes only Stable and the single UAT through version and channel commands", () => {
    const version = parseJson(runCli(["version", "--json"]));
    const status = parseJson(runCli(["channel", "status", "--json"]));
    const plan = parseJson(runCli(["channel", "use", "uat", "--json"]));
    const rollback = parseJson(runCli(["channel", "rollback", "uat", "--json"]));

    assert.deepEqual(Object.keys(version.data.channels), ["stable", "uat"]);
    assert.deepEqual(Object.keys(status.data.channels), ["stable", "uat"]);
    assert.equal(plan.data.channel, "uat");
    assert.equal(plan.data.installed, false);
    assert.match(plan.data.next_command, /--channel uat/);
    assert.equal(rollback.operation, "system.channelRollbackPlan");
    assert.match(rollback.data.next_command, /channel rollback uat --approve-write/);
  });

  it("creates a privacy-preserving preserve draft from a report", () =>
    withTempWorkspace((workspace) => {
      const reportPath = join(workspace, "analysis.json");
      writeFileSync(
        reportPath,
        JSON.stringify(
          {
            projects: [
              {
                project_key: "daxing",
                source_sessions: 3,
                user_repeated_phrases: [
                  {
                    text: "这是不应该原样出现在草稿里的用户原话",
                    count: 7,
                    occurrences: [{ session_id: "s1", turn_id: "u1", speaker: "user" }]
                  }
                ]
              }
            ]
          },
          null,
          2
        )
      );

      const result = runCli(["preserve", "draft", "--from-report", "analysis.json", "--json"], { cwd: workspace });
      const report = parseJson(result);

      assert.equal(report.operation, "preserve.draft");
      assert.equal(report.data.execution.writes_now, false);
      assert.equal(report.data.privacy.raw_report_embedded, false);
      assert.equal(report.data.artifact_candidates.length > 0, true);
      assert.doesNotMatch(JSON.stringify(report.data), /这是不应该原样/);
    }));

  it("creates preserve candidates from infra project-insights summary reports", () =>
    withTempWorkspace((workspace) => {
      const reportPath = join(workspace, "project-analysis-summary.json");
      writeFileSync(
        reportPath,
        JSON.stringify(
          {
            reports: [
              {
                project_key: "daxing",
                project_label: "大兴项目",
                source_sessions: 2,
                exact_phrases: [
                  {
                    text: "这句原话不能泄露到草稿",
                    occurrence_count: 2,
                    occurrences: [
                      { session_id: "s1", turn_id: "u1", speaker: "user" },
                      { session_id: "s2", turn_id: "u1", speaker: "user" }
                    ]
                  }
                ]
              }
            ]
          },
          null,
          2
        )
      );

      const result = runCli(["preserve", "draft", "--from-report", "project-analysis-summary.json", "--json"], {
        cwd: workspace
      });
      const report = parseJson(result);

      assert.equal(report.operation, "preserve.draft");
      assert.ok(report.data.artifact_candidates.some((candidate) => candidate.artifact_type === "Accepted Case"));
      assert.ok(report.data.artifact_candidates.some((candidate) => candidate.artifact_type === "Habit or Factor Candidate"));
      assert.equal(report.data.artifact_candidates[0].source_sessions, 2);
      assert.doesNotMatch(JSON.stringify(report.data), /这句原话/);
    }));

  it("reports component readiness in doctor output", () => {
    const result = runCli(["doctor", "--json"]);
    const report = parseJson(result);

    assert.equal(report.operation, "system.doctor");
    assert.equal(report.data.component_readiness.evozeus.available, true);
    assert.equal(report.data.component_readiness["EvoZeus Runtime"].owner, "EvoZeus");
    assert.equal(report.data.component_readiness["EvoZeus-CoEvolve"].owner, "EvoZeus-CoEvolve");
    assert.equal(report.data.component_readiness["EvoZeus Session Signal"].owner, "EvoZeus");
  });
});
