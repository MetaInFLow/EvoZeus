#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const SCHEMA_VERSION = 1;
const CLI_VERSION = "0.2.0";
const SOURCE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const CAPABILITIES = [
  {
    name: "capabilities.describe",
    domain: "capabilities",
    summary: "Describe EvoZeus local capabilities, permissions, risk levels, and examples.",
    input_schema: { type: "object", properties: {} },
    output_schema: { type: "object", required: ["capabilities"] },
    write_mode: "read_only",
    risk_level: "low",
    required_permissions: ["system.read"],
    requires_approval: false,
    examples: ["evozeus capabilities --json"]
  },
  {
    name: "workspace.activate",
    domain: "workspace",
    summary: "Read local EvoZeus installation state and recommend the next capability selection step.",
    input_schema: { type: "object", properties: {} },
    output_schema: { type: "object", required: ["workspace_state", "next_command"] },
    write_mode: "read_only",
    risk_level: "low",
    required_permissions: ["system.read"],
    requires_approval: false,
    examples: ["evozeus activate --json"]
  },
  {
    name: "session.analyze",
    domain: "session",
    summary: "Analyze an explicit Agent Session input and produce a Session Verdict Card envelope.",
    input_schema: {
      type: "object",
      required: ["input"],
      properties: {
        input: { type: "string" },
        input_kind: { enum: ["stdin", "file"] }
      }
    },
    output_schema: {
      type: "object",
      required: ["verdict_card", "privacy", "artifact_route"]
    },
    write_mode: "read_only",
    risk_level: "medium",
    required_permissions: ["session.readExplicitInput"],
    requires_approval: false,
    examples: ["evozeus session analyze --input session.md --json", "cat session.md | evozeus session analyze --input - --json"]
  },
  {
    name: "session.scanPlan",
    domain: "session",
    summary: "Plan a local runtime/session store scan without reading raw stores.",
    input_schema: { type: "object", properties: { dry_run: { const: true } } },
    output_schema: { type: "object", required: ["scan_plan"] },
    write_mode: "plan_only",
    risk_level: "high",
    required_permissions: ["session.scanLocalStore"],
    requires_approval: true,
    examples: ["evozeus session scan --dry-run --json"]
  },
  {
    name: "harness.attachPlan",
    domain: "harness",
    summary: "Create a plan for attaching a co-evolution harness to a specified Skill, plugin, or repo.",
    input_schema: {
      type: "object",
      required: ["target"],
      properties: { target: { type: "string" } }
    },
    output_schema: { type: "object", required: ["handoff_plan"] },
    write_mode: "plan_only",
    risk_level: "medium",
    required_permissions: ["repo.inspectTarget"],
    requires_approval: false,
    examples: ["evozeus harness attach --target ./skills/my-skill --json"]
  },
  {
    name: "system.doctor",
    domain: "system",
    summary: "Check local EvoZeus installation and optional component readiness.",
    input_schema: { type: "object", properties: {} },
    output_schema: { type: "object", required: ["components"] },
    write_mode: "read_only",
    risk_level: "low",
    required_permissions: ["system.read"],
    requires_approval: false,
    examples: ["evozeus doctor --json"]
  },
  {
    name: "system.updatePlan",
    domain: "system",
    summary: "Plan an EvoZeus local skeleton and CLI update without writing files.",
    input_schema: { type: "object", properties: { dry_run: { const: true } } },
    output_schema: { type: "object", required: ["update_plan"] },
    write_mode: "plan_only",
    risk_level: "medium",
    required_permissions: ["system.writeLocal"],
    requires_approval: true,
    examples: ["evozeus update --dry-run --json"]
  },
  {
    name: "system.uninstallPlan",
    domain: "system",
    summary: "Plan EvoZeus uninstall or archive actions without deleting files.",
    input_schema: { type: "object", properties: { dry_run: { const: true } } },
    output_schema: { type: "object", required: ["uninstall_plan"] },
    write_mode: "plan_only",
    risk_level: "high",
    required_permissions: ["system.deleteLocal"],
    requires_approval: true,
    examples: ["evozeus uninstall --dry-run --json"]
  }
];

class CliError extends Error {
  constructor(code, message, operation = "unknown", recoverable = true, approval = null) {
    super(message);
    this.code = code;
    this.operation = operation;
    this.recoverable = recoverable;
    this.approval = approval;
  }
}

function parseArgs(argv) {
  const options = {
    json: false,
    dryRun: false,
    approveWrite: false,
    approveFeedback: process.env.EVOZEUS_APPROVE_FEEDBACK === "1",
    feedbackEndpoint: process.env.EVOZEUS_ACTIVITY_ENDPOINT || "https://evozeus-community.vercel.app/api/activity",
    targetVisibility: "private",
    evozeusHome: process.env.EVOZEUS_HOME || join(homedir(), ".evozeus"),
    workspace: process.cwd(),
    input: null,
    target: null
  };
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--approve-write") {
      options.approveWrite = true;
    } else if (arg === "--approve-feedback") {
      options.approveFeedback = true;
    } else if (arg === "--feedback-endpoint") {
      options.feedbackEndpoint = argv[++index];
    } else if (arg === "--target-visibility") {
      options.targetVisibility = argv[++index] === "public" ? "public" : "private";
    } else if (arg === "--evozeus-home") {
      options.evozeusHome = argv[++index];
    } else if (arg === "--workspace") {
      options.workspace = argv[++index];
    } else if (arg === "--input") {
      options.input = argv[++index];
    } else if (arg === "--target") {
      options.target = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--")) {
      throw new CliError("UNKNOWN_FLAG", `Unknown flag: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  return { options, positionals };
}

function workspaceInfo(options) {
  const root = resolve(options.workspace);
  const evozeusRoot = resolve(options.evozeusHome || process.env.EVOZEUS_HOME || join(homedir(), ".evozeus"));
  return {
    root,
    evozeus_root: evozeusRoot,
    evozeus_home: evozeusRoot
  };
}

function actorInfo() {
  return {
    type: "agent",
    id: process.env.EVOZEUS_ACTOR_ID || "unknown"
  };
}

function envelope(operation, options, data, approval = { required: false, reason: null }) {
  return {
    ok: true,
    operation,
    schema_version: SCHEMA_VERSION,
    actor: actorInfo(),
    workspace: workspaceInfo(options),
    approval,
    data
  };
}

function errorEnvelope(error, options) {
  return {
    ok: false,
    operation: error.operation || "unknown",
    schema_version: SCHEMA_VERSION,
    actor: actorInfo(),
    workspace: workspaceInfo(options),
    approval: error.approval || { required: false, reason: null },
    error: {
      code: error.code || "CLI_ERROR",
      message: error.message,
      recoverable: error.recoverable !== false
    }
  };
}

function printResult(result, options) {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.ok) {
    console.error(`${result.error.code}: ${result.error.message}`);
    return;
  }

  if (result.operation === "capabilities.describe") {
    for (const capability of result.data.capabilities) {
      console.log(`${capability.name} [${capability.risk_level}] ${capability.summary}`);
    }
    return;
  }

  console.log(`${result.operation}: ok`);
  if (result.approval?.required) {
    console.log(`approval_required: ${result.approval.reason}`);
  }
}

function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeRuntimeHash(value) {
  const hash = String(value ?? "").trim().replace(/^sha256:/i, "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : "";
}

function readRegistration(options) {
  return readJsonFile(join(workspaceInfo(options).evozeus_root, "registration.json"));
}

function registrationRuntimeHash(options) {
  const registration = readRegistration(options);
  return normalizeRuntimeHash(
    process.env.EVOZEUS_RUNTIME_INSTANCE_HASH ||
      registration?.identity?.runtime_instance_hash ||
      registration?.runtime_instance_hash
  );
}

function activityAgentHandle(options) {
  const registration = readRegistration(options);
  const handle = String(process.env.EVOZEUS_AGENT_HANDLE || registration?.agent_handle || process.env.EVOZEUS_ACTOR_ID || "").trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,62}$/.test(handle) ? handle : "local-agent";
}

function publicGithubTarget(target) {
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/i.test(target);
}

function activityTarget(kind, label, options, url = null) {
  if (options.targetVisibility === "public" && url && publicGithubTarget(url)) {
    return {
      kind,
      visibility: "public",
      label: url.replace(/^https:\/\/github\.com\//i, "").replace(/\/$/, ""),
      url: url.replace(/\/$/, "")
    };
  }

  return {
    kind,
    visibility: "private",
    label
  };
}

function buildActivityPayload(result, options) {
  const runtimeInstanceHash = registrationRuntimeHash(options);
  if (!result?.ok || !runtimeInstanceHash) {
    return null;
  }

  const base = {
    runtime_instance_hash: runtimeInstanceHash,
    agent_handle: activityAgentHandle(options),
    privacy: "private",
    occurred_at: new Date().toISOString()
  };

  if (result.operation === "session.analyze") {
    const input = result.data.verdict_card.input;
    return {
      ...base,
      event_kind: "session.analyzed",
      capability: "session.analyze",
      target: activityTarget("session", "Private session", options),
      summary: `Analyzed an explicit session with ${input.lines} line(s); raw content stayed local.`
    };
  }

  if (result.operation === "harness.attachPlan") {
    const target = result.data.handoff_plan.target;
    const isPublic = options.targetVisibility === "public" && publicGithubTarget(String(target.ref));
    return {
      ...base,
      privacy: isPublic ? "public" : "private",
      event_kind: "harness.wrapper_planned",
      capability: "harness.attachPlan",
      target: activityTarget(target.kind === "github_repo" ? "github_repo" : target.kind, "Private target", options, String(target.ref)),
      summary: "Planned a wrapper handoff for skillware evolution."
    };
  }

  const eventByOperation = {
    "capabilities.describe": ["capability.used", "capabilities.describe", "Checked available EvoZeus capabilities."],
    "workspace.activate": ["workspace.activated", "workspace.activate", "Checked local EvoZeus workspace readiness."],
    "session.scanPlan": ["capability.used", "session.scanPlan", "Prepared a local session scan plan without reading raw stores."],
    "system.doctor": ["system.doctor", "system.doctor", "Ran an EvoZeus local health check."],
    "system.updatePlan": ["system.update_planned", "system.updatePlan", "Prepared an EvoZeus update plan."],
    "system.uninstallPlan": ["system.uninstall_planned", "system.uninstallPlan", "Prepared an EvoZeus uninstall/archive plan."]
  };
  const mapped = eventByOperation[result.operation];

  if (!mapped) {
    return null;
  }

  return {
    ...base,
    event_kind: mapped[0],
    capability: mapped[1],
    target: activityTarget("workspace", "Private workspace", options),
    summary: mapped[2]
  };
}

async function maybeSendActivity(result, options) {
  const payload = buildActivityPayload(result, options);
  if (!payload) {
    return result;
  }

  result.activity = {
    feedback_status: "pending_approval",
    endpoint: options.feedbackEndpoint,
    payload
  };

  if (!options.approveFeedback) {
    return result;
  }

  try {
    const response = await fetch(options.feedbackEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    result.activity.feedback_status = response.ok ? "sent" : "failed";
    result.activity.response_status = response.status;
  } catch {
    result.activity.feedback_status = "failed";
  }

  return result;
}

function buildCapabilities(options) {
  return envelope("capabilities.describe", options, {
    cli_version: CLI_VERSION,
    source_root: SOURCE_ROOT,
    capabilities: CAPABILITIES
  });
}

function activate(options) {
  const workspace = workspaceInfo(options);
  const registration = readJsonFile(join(workspace.evozeus_root, "registration.json"));
  const manifest = readJsonFile(join(workspace.evozeus_root, "install-manifest.json"));

  return envelope("workspace.activate", options, {
    workspace_state: {
      registered: Boolean(registration),
      installed: Boolean(manifest),
      registration_status: registration?.status ?? "missing",
      install_status: manifest?.status ?? "missing"
    },
    next_command:
      "~/.evozeus/bin/evozeus capabilities --json",
    next_action:
      "Show the EvoZeus capabilities to the user, then ask which path to take. Do not scan local sessions, write files, or submit to GitHub without explicit approval."
  });
}

function readExplicitSessionInput(options) {
  if (!options.input) {
    throw new CliError(
      "MISSING_EXPLICIT_INPUT",
      "session.analyze requires --input <path|->.",
      "session.analyze"
    );
  }

  if (options.input === "-") {
    return {
      input_kind: "stdin",
      label: "stdin",
      content: readFileSync(0, "utf8")
    };
  }

  try {
    const path = resolve(workspaceInfo(options).root, options.input);
    return {
      input_kind: "file",
      label: options.input,
      content: readFileSync(path, "utf8")
    };
  } catch {
    throw new CliError(
      "INPUT_READ_FAILED",
      "Unable to read the explicit session input file.",
      "session.analyze"
    );
  }
}

function detectSignals(content) {
  const signals = [];
  const checks = [
    [/error|failed|failure|exception|traceback/i, "tool_or_runtime_failure"],
    [/retry|again|rerun|重新|重试/i, "retry_or_rework"],
    [/skill|plugin|workflow|harness/i, "candidate_for_reusable_asset"],
    [/approve|permission|scan|private|secret/i, "privacy_or_permission_boundary"],
    [/fix|bug|broken|blocked|blocker/i, "fix_or_blocker_signal"]
  ];

  for (const [pattern, signal] of checks) {
    if (pattern.test(content)) {
      signals.push(signal);
    }
  }

  return signals.length > 0 ? signals : ["explicit_session_input_received"];
}

function analyzeSession(options) {
  const input = readExplicitSessionInput(options);
  const content = input.content;
  const bytes = Buffer.byteLength(content, "utf8");
  const lines = content.length === 0 ? 0 : content.split(/\r?\n/).length;
  const signals = detectSignals(content);
  const verdict = signals.includes("candidate_for_reusable_asset") ? "Open Case" : "Preserve";

  return envelope("session.analyze", options, {
    verdict_card: {
      schema_version: 1,
      input: {
        kind: input.input_kind,
        label: input.label,
        sha256: sha256(content),
        bytes,
        lines
      },
      evidence: [
        {
          type: "explicit_input",
          summary: `Received explicit session input with ${lines} line(s) and ${bytes} byte(s).`,
          raw_content_included: false
        }
      ],
      signals,
      verdict: {
        value: verdict,
        reason:
          "P0 CLI structured the explicit input into a review card. Human review is still required before preserving, promoting, or routing artifacts."
      }
    },
    artifact_route: {
      route: "local_review_only",
      next_action:
        "Review the verdict card with the user. Ask before writing reports, scanning local stores, or routing to wrapper/GitHub."
    },
    privacy: {
      raw_session_stored: false,
      scanned_local_store: false,
      external_write: false
    }
  });
}

function scanPlan(options) {
  if (!options.dryRun) {
    throw new CliError(
      "DRY_RUN_REQUIRED",
      "session.scan is high risk and requires --dry-run in P0.",
      "session.scanPlan",
      true,
      {
        required: true,
        reason: "Local runtime/session store scanning needs explicit approval and a scan plan first."
      }
    );
  }

  return envelope(
    "session.scanPlan",
    options,
    {
      scan_plan: {
        reads_raw_store_now: false,
        candidate_sources: ["agent runtime/session store", "user-selected exported session file"],
        required_before_execution: [
          "specific source path",
          "redaction policy",
          "artifact write destination",
          "user approval"
        ],
        forbidden_in_this_command: [
          "reading raw session files",
          "running scanner",
          "running FactorRunner",
          "writing reports"
        ]
      }
    },
    {
      required: true,
      reason: "This command only plans a scan. Actual local store access requires a separate approval."
    }
  );
}

function classifyTarget(target, options) {
  if (/^https?:\/\/github\.com\//i.test(target)) {
    return { kind: "github_repo", ref: target, inside_workspace: false, exists: null };
  }

  const workspace = workspaceInfo(options).root;
  const resolved = resolve(workspace, target);
  const relativePath = relative(workspace, resolved);
  const insideWorkspace =
    relativePath === "" || (relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath));
  const exists = existsSync(resolved);
  let kind = "unknown";

  if (basename(resolved) === "SKILL.md") {
    kind = "skill";
  } else if (exists) {
    const stats = statSync(resolved);
    if (stats.isDirectory() && existsSync(join(resolved, "SKILL.md"))) {
      kind = "skill";
    } else if (stats.isDirectory() && existsSync(join(resolved, ".git"))) {
      kind = "repo";
    } else if (stats.isDirectory()) {
      kind = "local_directory";
    } else {
      kind = "local_file";
    }
  }

  return {
    kind,
    ref: target,
    inside_workspace: insideWorkspace,
    exists
  };
}

function attachHarness(options) {
  if (!options.target) {
    throw new CliError("MISSING_TARGET", "harness.attach requires --target <path|url>.", "harness.attachPlan");
  }

  const target = classifyTarget(options.target, options);
  const approval = target.inside_workspace
    ? { required: false, reason: null }
    : {
        required: true,
        reason: "Target is outside the current workspace or remote; inspect/write/publish actions require explicit approval."
      };

  return envelope(
    "harness.attachPlan",
    options,
    {
      handoff_plan: {
        target,
        recommended_route: "EvoZeus-wrapper",
        writes_now: false,
        next_actions: [
          "confirm target owner",
          "redact private examples",
          "generate feedback issue draft",
          "prepare design doc / PR plan"
        ],
        approval_required_for: ["repo write", "GitHub issue", "pull request", "release"]
      }
    },
    approval
  );
}

function doctor(options) {
  const workspace = workspaceInfo(options);
  const registration = readJsonFile(join(workspace.evozeus_root, "registration.json"));
  const manifest = readJsonFile(join(workspace.evozeus_root, "install-manifest.json"));
  const required = [
    "SKILL.md",
    "skills/index/SKILL.md",
    "skills/evozeus-install-registration/SKILL.md",
    "scripts/evozeus-install.mjs",
    "scripts/evozeus-doctor.mjs",
    "scripts/evozeus-cli.mjs"
  ];
  const missing = required.filter((entry) => !existsSync(join(SOURCE_ROOT, entry)));

  return envelope("system.doctor", options, {
    install_state: {
      registered: Boolean(registration),
      installed: Boolean(manifest),
      local_cli_available: existsSync(join(workspace.evozeus_root, "bin/evozeus"))
    },
    components: {
      source_root: SOURCE_ROOT,
      status: missing.length === 0 ? "complete" : "incomplete",
      missing
    },
    optional_paths: {
      session_scan: "approval_required",
      infra_runtime: "approval_required",
      wrapper_github_write: "forbidden_in_p0"
    },
    next_command: "~/.evozeus/bin/evozeus capabilities --json"
  });
}

function updatePlan(options) {
  if (options.approveWrite) {
    throw new CliError(
      "UPDATE_APPLY_NOT_IMPLEMENTED_IN_P0",
      "update --approve-write is not implemented in P0; run the installer reconcile flow after reviewing the dry-run plan.",
      "system.updateApply",
      true,
      {
        required: true,
        reason: "Local update writes require an approved installer reconcile flow."
      }
    );
  }

  return envelope(
    "system.updatePlan",
    options,
    {
      update_plan: {
        dry_run: true,
        writes_now: false,
        source_root: SOURCE_ROOT,
        planned_actions: [
          "reconcile ~/.evozeus/registration.json",
          "refresh ~/.evozeus/skeleton",
          "refresh ~/.evozeus/bin/evozeus shim",
          "update install-manifest.json"
        ],
        apply_hint: "After user approval, run node scripts/evozeus-install.mjs --workspace <workspace> --approve-write."
      }
    },
    {
      required: true,
      reason: "Updating local EvoZeus writes ~/.evozeus and requires explicit approval."
    }
  );
}

function uninstallPlan(options) {
  const workspace = workspaceInfo(options);

  if (options.approveWrite) {
    const archivePath = join(dirname(workspace.evozeus_root), `.evozeus-archive-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    if (existsSync(workspace.evozeus_root)) {
      mkdirSync(dirname(archivePath), { recursive: true });
      rmSync(archivePath, { recursive: true, force: true });
      writeFileSync(
        join(workspace.evozeus_root, "uninstall-report.json"),
        `${JSON.stringify({ archived_to: archivePath, created_at: new Date().toISOString() }, null, 2)}\n`
      );
    }

    return envelope(
      "system.uninstallApply",
      options,
      {
        uninstall_report: {
          writes_now: existsSync(workspace.evozeus_root),
          deleted_now: false,
          archived_now: false,
          note: "P0 writes only an uninstall report. Deleting or moving ~/.evozeus remains a manual, user-confirmed action."
        }
      },
      { required: true, reason: "Destructive deletion is not automatic in P0." }
    );
  }

  return envelope(
    "system.uninstallPlan",
    options,
    {
      uninstall_plan: {
        dry_run: true,
        writes_now: false,
        delete_candidates: ["~/.evozeus/bin/evozeus", "~/.evozeus/skeleton", "~/.evozeus/registration.json", "~/.evozeus/install-manifest.json"],
        preserve_candidates: ["~/.evozeus/audit.ndjson", "~/.evozeus/handoffs", "~/.evozeus/reports"],
        required_before_execution: ["user approval", "archive/delete choice", "privacy review"]
      }
    },
    {
      required: true,
      reason: "Uninstall is destructive and requires explicit approval."
    }
  );
}

function printHelp() {
  console.log(`Usage: evozeus <command> [options]

Commands:
  capabilities --json
  activate --json
  session analyze --input <path|-> --json
  session scan --dry-run --json
  harness attach --target <path|url> --json
  doctor --json
  update --dry-run --json
  uninstall --dry-run --json

Global options:
  --workspace <path>
  --evozeus-home <path>
  --json
  --approve-feedback
  --target-visibility public|private
`);
}

function route(parsed) {
  const { options, positionals } = parsed;
  const [command, subcommand] = positionals;

  if (options.help || !command) {
    printHelp();
    return null;
  }

  if (command === "capabilities") {
    return buildCapabilities(options);
  }

  if (command === "activate") {
    return activate(options);
  }

  if (command === "session" && subcommand === "analyze") {
    return analyzeSession(options);
  }

  if (command === "session" && subcommand === "scan") {
    return scanPlan(options);
  }

  if (command === "harness" && subcommand === "attach") {
    return attachHarness(options);
  }

  if (command === "doctor") {
    return doctor(options);
  }

  if (command === "update") {
    return updatePlan(options);
  }

  if (command === "uninstall") {
    return uninstallPlan(options);
  }

  throw new CliError("UNKNOWN_COMMAND", `Unknown EvoZeus command: ${positionals.join(" ") || command}`);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const result = route(parsed);
  if (result) {
    printResult(await maybeSendActivity(result, parsed.options), parsed.options);
  }
}

main().catch((error) => {
  const wantsJson = process.argv.includes("--json");
  const fallbackOptions = { json: wantsJson, workspace: process.cwd() };
  const cliError =
    error instanceof CliError
      ? error
      : new CliError("CLI_ERROR", error.message || "Unexpected CLI error.", "unknown");
  printResult(errorEnvelope(cliError, fallbackOptions), fallbackOptions);
  process.exit(1);
});
