#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  ChannelError,
  activateInstalledChannel,
  applyChannelUpdate,
  channelSnapshot,
  prepareChannelUpdate,
  readActiveChannel,
  rollbackChannel,
  resolveInstalledComponentRoot
} from "./evozeus-channels.mjs";

const SCHEMA_VERSION = 1;
const CLI_VERSION = "0.3.1";
const SOURCE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const CAPABILITIES = [
  {
    name: "system.version",
    domain: "system",
    summary: "Describe the active EvoZeus channel, product manifest, component versions, commits, and health.",
    input_schema: { type: "object", properties: {} },
    output_schema: { type: "object", required: ["active_channel", "health", "channels"] },
    write_mode: "read_only",
    risk_level: "low",
    required_permissions: ["system.read"],
    requires_approval: false,
    examples: ["evozeus version --json"]
  },
  {
    name: "system.channelStatus",
    domain: "system",
    summary: "Inspect installed Stable and UAT channels without changing the active channel.",
    input_schema: { type: "object", properties: {} },
    output_schema: { type: "object", required: ["channels"] },
    write_mode: "read_only",
    risk_level: "low",
    required_permissions: ["system.read"],
    requires_approval: false,
    examples: ["evozeus channel status --json"]
  },
  {
    name: "system.channelUse",
    domain: "system",
    summary: "Plan or approve switching between an already installed Stable channel and the single UAT channel.",
    input_schema: { type: "object", required: ["channel"], properties: { channel: { enum: ["stable", "uat"] } } },
    output_schema: { type: "object", required: ["channel"] },
    write_mode: "approved_write",
    risk_level: "medium",
    required_permissions: ["system.writeLocal"],
    requires_approval: true,
    examples: ["evozeus channel use uat --approve-write --auto-refresh --json"]
  },
  {
    name: "system.channelRollback",
    domain: "system",
    summary: "Plan or approve restoring the previous verified Stable or single-UAT product installation.",
    input_schema: { type: "object", required: ["channel"], properties: { channel: { enum: ["stable", "uat"] } } },
    output_schema: { type: "object", required: ["rollback"] },
    write_mode: "approved_write",
    risk_level: "medium",
    required_permissions: ["system.writeLocal"],
    requires_approval: true,
    examples: ["evozeus channel rollback uat --approve-write --json"]
  },
  {
    name: "features.describe",
    domain: "features",
    summary: "Describe EvoZeus product features by lifecycle stage and map them to executable capabilities.",
    input_schema: { type: "object", properties: {} },
    output_schema: { type: "object", required: ["features"] },
    write_mode: "read_only",
    risk_level: "low",
    required_permissions: ["system.read"],
    requires_approval: false,
    examples: ["evozeus features --json"]
  },
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
    name: "insights.plan",
    domain: "insights",
    summary: "Plan a session insights run through EvoZeus-infra without reading raw stores.",
    input_schema: { type: "object", properties: { source: { type: "string" } } },
    output_schema: { type: "object", required: ["insights_plan", "backend"] },
    write_mode: "plan_only",
    risk_level: "medium",
    required_permissions: ["system.read"],
    requires_approval: false,
    examples: ["evozeus insights plan --source codex --json"]
  },
  {
    name: "insights.sessions",
    domain: "insights",
    summary: "Route approved session insights execution to EvoZeus-infra.",
    input_schema: { type: "object", properties: { source: { type: "string" }, project: { type: "string" } } },
    output_schema: { type: "object", required: ["execution", "backend"] },
    write_mode: "plan_only",
    risk_level: "high",
    required_permissions: ["session.scanLocalStore"],
    requires_approval: true,
    examples: ["evozeus insights sessions --source codex --reuse-factors --html --json"]
  },
  {
    name: "harness.attachPlan",
    domain: "harness",
    summary: "Create a Co-evolve plan for attaching EvoZeus-CoEvolve to a specified Skill, plugin, or repo.",
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
    name: "preserve.draft",
    domain: "preserve",
    summary: "Create a privacy-preserving artifact draft from an existing local report.",
    input_schema: { type: "object", required: ["from_report"], properties: { from_report: { type: "string" } } },
    output_schema: { type: "object", required: ["artifact_candidates", "privacy"] },
    write_mode: "read_only",
    risk_level: "medium",
    required_permissions: ["report.readExplicitInput"],
    requires_approval: false,
    examples: ["evozeus preserve draft --from-report analysis.json --json"]
  },
  {
    name: "coevolve.status",
    domain: "coevolve",
    summary: "Inspect local wrapper manifest status for a Skill, plugin, or repo target.",
    input_schema: { type: "object", required: ["target"], properties: { target: { type: "string" } } },
    output_schema: { type: "object", required: ["target", "wrapper", "backend"] },
    write_mode: "read_only",
    risk_level: "medium",
    required_permissions: ["repo.inspectTarget"],
    requires_approval: false,
    examples: ["evozeus coevolve status --target ./skills/my-skill --json"]
  },
  {
    name: "coevolve.auditFeedback",
    domain: "coevolve",
    summary: "Plan a wrapper feedback audit without writing GitHub issues or target repo files.",
    input_schema: { type: "object", required: ["target", "user_input"], properties: { target: { type: "string" }, user_input: { type: "string" } } },
    output_schema: { type: "object", required: ["execution", "backend"] },
    write_mode: "plan_only",
    risk_level: "medium",
    required_permissions: ["repo.inspectTarget"],
    requires_approval: false,
    examples: ["evozeus coevolve audit --target ./skills/my-skill --user-input '<feedback>' --json"]
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
    summary: "Plan or approve a manifest-pinned Stable or single-UAT transaction.",
    input_schema: { type: "object", properties: { channel: { enum: ["stable", "uat"] } } },
    output_schema: { type: "object", required: ["update_plan"] },
    write_mode: "plan_only",
    risk_level: "medium",
    required_permissions: ["system.writeLocal"],
    requires_approval: true,
    examples: ["evozeus update --channel stable --dry-run --json", "evozeus update --channel uat --approve-write --json"]
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

const PRODUCT_FEATURES = [
  {
    id: "activate",
    title: "Activate workspace",
    title_zh: "激活并检查本地 EvoZeus 工作区",
    lifecycle_stage: "activate",
    user_goal: "确认本地 EvoZeus 是否已安装、注册和可继续使用。",
    command: "evozeus activate --json",
    backend_owner: "evozeus",
    status: "available",
    approval_boundary: "Reads EvoZeus local state only.",
    related_capabilities: ["workspace.activate"],
    aliases: []
  },
  {
    id: "review.session",
    title: "Review one explicit session",
    title_zh: "分析一个用户显式提供的 session",
    lifecycle_stage: "interact",
    user_goal: "把一次用户提供的 Agent Session 转成 Evidence、Signals、Verdict Card 和 Artifact Route。",
    command: "evozeus review session --input <path|-> --json",
    backend_owner: "evozeus",
    status: "alias",
    approval_boundary: "Reads only the file or stdin explicitly provided by the user.",
    related_capabilities: ["session.analyze"],
    aliases: ["evozeus session analyze --input <path|-> --json"]
  },
  {
    id: "insights.sessions",
    title: "Generate session insights report",
    title_zh: "扫描历史 sessions 并生成项目洞察报告",
    lifecycle_stage: "interact",
    user_goal: "从历史 session 中发现可复用 insight、重复表达、项目差异和可进化点。",
    command: "evozeus insights plan --source codex --json",
    backend_owner: "EvoZeus-infra",
    status: "available",
    approval_boundary: "Plan is read-only; raw session scan, factor execution, report write, and HTML open require explicit approval.",
    related_capabilities: ["insights.plan", "insights.sessions", "session.scanPlan"],
    aliases: ["evozeus session scan --dry-run --json"]
  },
  {
    id: "preserve.artifact",
    title: "Preserve a Verdict / report as an artifact draft",
    title_zh: "把 Verdict 或报告沉淀为 Artifact 草稿",
    lifecycle_stage: "decide",
    user_goal: "从已有本地报告生成 Case、Factor、Habit 或 Rule 的隐私安全草稿。",
    command: "evozeus preserve draft --from-report <path> --json",
    backend_owner: "evozeus",
    status: "available",
    approval_boundary: "Reads only the explicit report path and does not publish or upload.",
    related_capabilities: ["preserve.draft"],
    aliases: []
  },
  {
    id: "coevolve.target",
    title: "Co-evolve a Skill / plugin / repo",
    title_zh: "让 Skill / plugin / repo 接入协同进化机制",
    lifecycle_stage: "coevolve",
    user_goal: "把已接受或值得长期沉淀的 Skill、plugin、repo 接入 feedback、issue、design doc、PR、CHANGELOG、release 循环。",
    command: "evozeus coevolve attach --target <path|url> --json",
    backend_owner: "EvoZeus-CoEvolve",
    status: "alias",
    approval_boundary: "Plan only by default; repo writes and GitHub actions require explicit approval.",
    related_capabilities: ["harness.attachPlan"],
    aliases: ["evozeus harness attach --target <path|url> --json"]
  },
  {
    id: "maintain",
    title: "Maintain EvoZeus",
    title_zh: "诊断、更新和维护 EvoZeus",
    lifecycle_stage: "maintain",
    user_goal: "检查安装状态、组件状态、更新计划和修复路径。",
    command: "evozeus doctor --json",
    backend_owner: "evozeus",
    status: "available",
    approval_boundary: "Doctor is read-only; update writes require explicit approval.",
    related_capabilities: ["system.doctor", "system.updatePlan", "system.channelRollback"],
    aliases: ["evozeus update --dry-run --json", "evozeus channel rollback uat --json"]
  },
  {
    id: "uninstall",
    title: "Uninstall or archive EvoZeus",
    title_zh: "卸载或归档 EvoZeus 本地状态",
    lifecycle_stage: "uninstall",
    user_goal: "规划停用、删除、归档或保留本地 EvoZeus 状态与报告。",
    command: "evozeus uninstall --dry-run --json",
    backend_owner: "evozeus",
    status: "available",
    approval_boundary: "Dry-run only by default; destructive cleanup requires explicit approval.",
    related_capabilities: ["system.uninstallPlan"],
    aliases: []
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
    target: null,
    source: "codex",
    project: null,
    projectMode: "auto",
    fromReport: null,
    userInput: null,
    context: null,
    html: false,
    open: false,
    latest: false,
    reuseFactors: false,
    force: false,
    plan: false,
    checkNetwork: false,
    channel: null,
    manifest: null,
    autoRefresh: false
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
    } else if (arg === "--source") {
      options.source = argv[++index];
    } else if (arg === "--project") {
      options.project = argv[++index];
    } else if (arg === "--project-mode") {
      options.projectMode = argv[++index];
    } else if (arg === "--from-report") {
      options.fromReport = argv[++index];
    } else if (arg === "--user-input") {
      options.userInput = argv[++index];
    } else if (arg === "--context") {
      options.context = argv[++index];
    } else if (arg === "--html") {
      options.html = true;
    } else if (arg === "--open") {
      options.open = true;
    } else if (arg === "--latest") {
      options.latest = true;
    } else if (arg === "--reuse-factors") {
      options.reuseFactors = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--plan") {
      options.plan = true;
    } else if (arg === "--check-network") {
      options.checkNetwork = true;
    } else if (arg === "--channel") {
      options.channel = argv[++index];
    } else if (arg === "--manifest") {
      options.manifest = argv[++index];
    } else if (arg === "--auto-refresh") {
      options.autoRefresh = true;
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
  const version = channelSnapshot(workspaceInfo(options).evozeus_root);
  return {
    ok: true,
    operation,
    schema_version: SCHEMA_VERSION,
    runtime: {
      channel: version.active_channel,
      product_version: version.product_version ?? null,
      manifest_digest: version.manifest_digest ?? null,
      health: version.health
    },
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

  if (result.runtime?.channel) {
    console.log(`[EvoZeus ${result.runtime.channel.toUpperCase()}] ${result.runtime.product_version || "unknown version"}`);
  }

  if (result.operation === "capabilities.describe") {
    for (const capability of result.data.capabilities) {
      console.log(`${capability.name} [${capability.risk_level}] ${capability.summary}`);
    }
    return;
  }

  if (result.operation === "features.describe") {
    console.log("EvoZeus Features");
    console.log("");
    result.data.features.forEach((feature, index) => {
      console.log(`${index + 1}. ${feature.title}`);
      console.log(`   Command: ${feature.command}`);
      console.log(`   Stage: ${feature.lifecycle_stage}`);
      console.log(`   Owner: ${feature.backend_owner}`);
      console.log(`   Boundary: ${feature.approval_boundary}`);
      if (index < result.data.features.length - 1) {
        console.log("");
      }
    });
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

function resolveWorkspacePath(options, ref) {
  return resolve(workspaceInfo(options).root, ref);
}

function siblingRepo(name) {
  return resolve(dirname(SOURCE_ROOT), name);
}

function pythonCommandForPackage(root, moduleName, args, extraEnv = {}) {
  return {
    cwd: root,
    env: {
      PYTHONPATH: join(root, "src"),
      ...extraEnv
    },
    argv: ["python3", "-m", moduleName, ...args]
  };
}

function wrapperCommand(root, args, extraEnv = {}) {
  return {
    cwd: root,
    env: extraEnv,
    argv: ["python3", join(root, "scripts/evozeus_wrapper.py"), ...args]
  };
}

function componentReadiness(options) {
  const home = workspaceInfo(options).evozeus_root;
  const infra = resolveInstalledComponentRoot({ evozeusHome: home, componentId: "infra", sourceRoot: SOURCE_ROOT });
  const wrapper = resolveInstalledComponentRoot({ evozeusHome: home, componentId: "coevolve", sourceRoot: SOURCE_ROOT });
  const official = resolveInstalledComponentRoot({ evozeusHome: home, componentId: "session_signal", sourceRoot: SOURCE_ROOT });
  const infraRoot = infra.root;
  const wrapperRoot = wrapper.root;
  const officialRoot = official.root;
  const infraCli = join(infraRoot, "src/evozeus_runtime/cli/main.py");
  const wrapperCli = join(wrapperRoot, "scripts/evozeus_wrapper.py");
  const officialSkill = join(officialRoot, "SKILL.md");

  return {
    evozeus: {
      owner: "evozeus",
      available: existsSync(join(SOURCE_ROOT, "scripts/evozeus-cli.mjs")),
      detected_path: SOURCE_ROOT,
      executable_command: ["node", join(SOURCE_ROOT, "scripts/evozeus-cli.mjs"), "--help"],
      repair_hint: null
    },
    "EvoZeus-infra": {
      owner: "EvoZeus-infra",
      available: existsSync(infraCli),
      detected_path: infraRoot,
      resolution_source: infra.source,
      executable_command: ["python3", "-m", "evozeus_runtime.cli.main", "status"],
      repair_hint: existsSync(infraCli)
        ? null
        : "Set EVOZEUS_INFRA_ROOT to a local EvoZeus-infra checkout or install evozeus-runtime."
    },
    "EvoZeus-CoEvolve": {
      owner: "EvoZeus-CoEvolve",
      available: existsSync(wrapperCli),
      detected_path: wrapperRoot,
      resolution_source: wrapper.source,
      executable_command: ["python3", wrapperCli, "--help"],
      repair_hint: existsSync(wrapperCli)
        ? null
        : "Set EVOZEUS_WRAPPER_ROOT to a local EvoZeus-CoEvolve checkout."
    },
    "EvoZeus-session-signal-skill": {
      owner: "EvoZeus-session-signal-skill",
      available: existsSync(officialSkill),
      detected_path: officialRoot,
      resolution_source: official.source,
      executable_command: null,
      repair_hint: existsSync(officialSkill)
        ? null
        : "Set EVOZEUS_OFFICIAL_REPO_ROOT to a local EvoZeus-session-signal-skill checkout."
    }
  };
}

function infraBackendCommand(options, mode) {
  const readiness = componentReadiness(options)["EvoZeus-infra"];
  const official = componentReadiness(options)["EvoZeus-session-signal-skill"];
  const workspace = workspaceInfo(options).root;
  const active = readActiveChannel(workspaceInfo(options).evozeus_root);
  const runtimeStateRoot = active
    ? join(workspaceInfo(options).evozeus_root, "state", active.channel)
    : null;
  const args =
    mode === "project"
      ? [
          "project-insights",
          "--workspace",
          workspace,
          "--project",
          options.project,
          "--format",
          "markdown",
          "--format",
          "json",
          "--format",
          "html",
          ...(options.projectMode === "keyword" || options.projectMode === "contains" ? ["--contains"] : [])
        ]
      : [
          "session-insights",
          "--workspace",
          workspace,
          "--official-repo-root",
          official.detected_path,
          ...(options.force ? ["--force"] : [])
        ];

  return {
    owner: "EvoZeus-infra",
    available: readiness.available,
    detected_path: readiness.detected_path,
    command: pythonCommandForPackage(readiness.detected_path, "evozeus_runtime.cli.main", args, {
      ...(active ? { EVOZEUS_ACTIVE_CHANNEL: active.channel } : {}),
      ...(runtimeStateRoot ? { EVOZEUS_RUNTIME_STATE_ROOT: runtimeStateRoot } : {})
    }),
    repair_hint: readiness.repair_hint
  };
}

function wrapperBackendCommand(options, args) {
  const readiness = componentReadiness(options)["EvoZeus-CoEvolve"];
  const active = readActiveChannel(workspaceInfo(options).evozeus_root);
  const runtimeStateRoot = active
    ? join(workspaceInfo(options).evozeus_root, "state", active.channel)
    : null;
  return {
    owner: "EvoZeus-CoEvolve",
    available: readiness.available,
    detected_path: readiness.detected_path,
    command: wrapperCommand(readiness.detected_path, args, {
      ...(active ? { EVOZEUS_ACTIVE_CHANNEL: active.channel } : {}),
      ...(runtimeStateRoot ? { EVOZEUS_RUNTIME_STATE_ROOT: runtimeStateRoot } : {})
    }),
    repair_hint: readiness.repair_hint
  };
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
    "features.describe": ["capability.used", "features.describe", "Checked available EvoZeus product features."],
    "capabilities.describe": ["capability.used", "capabilities.describe", "Checked available EvoZeus capabilities."],
    "workspace.activate": ["workspace.activated", "workspace.activate", "Checked local EvoZeus workspace readiness."],
    "insights.plan": ["capability.used", "insights.plan", "Prepared a session insights route plan without reading raw stores."],
    "insights.sessions": ["capability.used", "insights.sessions", "Prepared a session insights execution plan."],
    "insights.projectSessions": ["capability.used", "insights.projectSessions", "Prepared a project-scoped session insights execution plan."],
    "insights.openReport": ["capability.used", "insights.openReport", "Prepared a local report open command."],
    "preserve.draft": ["capability.used", "preserve.draft", "Prepared a privacy-preserving artifact draft from a local report."],
    "coevolve.status": ["capability.used", "coevolve.status", "Checked local co-evolution wrapper status."],
    "coevolve.auditFeedback": ["capability.used", "coevolve.auditFeedback", "Prepared a co-evolution feedback audit plan."],
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

function buildFeatures(options) {
  return envelope("features.describe", options, {
    product_version: "0.3",
    cli_version: CLI_VERSION,
    source_root: SOURCE_ROOT,
    features: PRODUCT_FEATURES
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
      "~/.evozeus/bin/evozeus features --json && ~/.evozeus/bin/evozeus capabilities --json",
    next_action:
      "Show the EvoZeus product features to the user, use capabilities for risk and permission facts, then ask which path to take. Do not scan local sessions, write files, or submit to GitHub without explicit approval."
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

function insightsPlan(options) {
  const backend = infraBackendCommand(options, "session");
  return envelope("insights.plan", options, {
    insights_plan: {
      source: options.source || "codex",
      reads_raw_store_now: false,
      writes_report_now: false,
      runs_factor_now: false,
      opens_browser_now: false,
      required_before_execution: [
        "specific source path or approved provider",
        "redaction policy",
        "factor reuse policy",
        "artifact write destination",
        "user approval"
      ],
      forbidden_in_this_command: [
        "reading raw session files",
        "running scanner",
        "running FactorRunner",
        "writing reports",
        "opening browser"
      ]
    },
    backend
  });
}

function insightsSessions(options) {
  const isProject = Boolean(options.project);
  const backend = infraBackendCommand(options, isProject ? "project" : "session");
  const operation = isProject ? "insights.projectSessions" : "insights.sessions";

  return envelope(
    operation,
    options,
    {
      project: isProject
        ? {
            project_key: options.project,
            project_mode: options.projectMode || "auto"
          }
        : null,
      execution: {
        source: options.source || "codex",
        runs_backend_now: false,
        reads_raw_store_now: false,
        writes_now: false,
        opens_browser_now: false,
        reuse_factors: Boolean(options.reuseFactors),
        html: Boolean(options.html),
        force: Boolean(options.force)
      },
      backend,
      approval_required_for: [
        "reading raw session files",
        "running scanner",
        "running FactorRunner",
        "writing local reports",
        "opening generated HTML"
      ]
    },
    {
      required: true,
      reason: "Session insights execution reads local runtime/session stores and writes reports; review the route plan before approving."
    }
  );
}

function insightsOpen(options) {
  const workspace = workspaceInfo(options).root;
  const reportPath = join(workspace, ".evozeus/runtime/reports/ai-usage-profile/index.html");
  return envelope("insights.openReport", options, {
    report: {
      latest: Boolean(options.latest),
      html_path: reportPath,
      exists: existsSync(reportPath)
    },
    execution: {
      opens_browser_now: false,
      reads_raw_store_now: false,
      writes_now: false
    },
    open_command: ["open", reportPath]
  });
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
        recommended_route: "EvoZeus-CoEvolve",
        global_evozeus_home: "~/.evozeus",
        target_infra_dir: ".evozeus_evoinfra",
        legacy_target_infra_dir: ".evozeus",
        manifest_path: ".evozeus_evoinfra/wrapper.json",
        feedback_policy_path: ".evozeus_evoinfra/feedback-policy.json",
        audit_rule_path: ".evozeus_evoinfra/audit-rule.md",
        source_contract: {
          global_project_pointer: "~/.evozeus/.projects/OWNER/REPO",
          runtime_install: "~/.codex/skills/<skill> or ~/.agents/skills/<skill>",
          runtime_install_policy: "runtime installs should point to the canonical repo and must not become a second source of truth"
        },
        writes_now: false,
        next_actions: [
          "confirm target owner",
          "route target repo-local harness files under .evozeus_evoinfra/",
          "redact private examples",
          "run EvoZeus-CoEvolve harness upgrade-check",
          "generate feedback issue draft",
          "prepare design doc / PR plan"
        ],
        approval_required_for: ["repo write", "GitHub issue", "pull request", "release"]
      }
    },
    approval
  );
}

function coevolveStatus(options) {
  if (!options.target) {
    throw new CliError("MISSING_TARGET", "coevolve.status requires --target <path|url>.", "coevolve.status");
  }

  const target = classifyTarget(options.target, options);
  const targetPath = resolveWorkspacePath(options, options.target);
  const manifestPath = join(targetPath, ".evozeus_evoinfra/wrapper.json");
  const manifest = readJsonFile(manifestPath);
  const backend = wrapperBackendCommand(options, ["skill", "diagnose", "--target", targetPath, "--json"]);

  return envelope("coevolve.status", options, {
    target,
    wrapper: {
      manifest_path: manifestPath,
      manifest_exists: Boolean(manifest),
      wrapper_version: manifest?.wrapper_version || manifest?.version || null,
      integration_mode: manifest?.integration?.mode || null
    },
    execution: {
      reads_target_manifest_now: true,
      writes_now: false,
      github_writes_now: false
    },
    backend
  });
}

function coevolveAudit(options) {
  if (!options.target) {
    throw new CliError("MISSING_TARGET", "coevolve.audit requires --target <path|url>.", "coevolve.auditFeedback");
  }
  if (!options.userInput) {
    throw new CliError("MISSING_USER_INPUT", "coevolve.audit requires --user-input <feedback>.", "coevolve.auditFeedback");
  }

  const targetPath = resolveWorkspacePath(options, options.target);
  const userInputHash = sha256(options.userInput);
  const backend = wrapperBackendCommand(options, [
    "loop",
    "audit",
    "--target",
    targetPath,
    "--user-input",
    "<redacted-user-input>",
    "--json"
  ]);

  return envelope("coevolve.auditFeedback", options, {
    target: classifyTarget(options.target, options),
    feedback: {
      sha256: userInputHash,
      bytes: Buffer.byteLength(options.userInput, "utf8"),
      raw_content_included: false
    },
    execution: {
      writes_now: false,
      github_writes_now: false,
      target_repo_writes_now: false
    },
    backend,
    next_action:
      "Review the redacted feedback audit plan with the user before creating any GitHub issue, PR, or target repo change."
  });
}

function summarizeReportForDraft(report) {
  const projects = reportProjects(report);
  const candidates = [];

  for (const [index, project] of projects.entries()) {
    candidates.push({
      artifact_type: "Accepted Case",
      title: `Project insight case: ${project.project_key || project.project_label || `project-${index + 1}`}`,
      evidence_refs: [`report://projects/${index}`],
      source_sessions: projectSessionCount(project)
    });

    const phrases = projectRepeatedPhrases(project);
    for (const [phraseIndex, phrase] of phrases.entries()) {
      candidates.push({
        artifact_type: "Habit or Factor Candidate",
        title: `Repeated user phrase candidate #${phraseIndex + 1}`,
        evidence_refs: [`report://projects/${index}/user_repeated_phrases/${phraseIndex}`],
        occurrence_count: Number(phrase.count || phrase.occurrence_count || phrase.occurrences?.length || 0),
        text_sha256: phrase.text ? sha256(String(phrase.text)) : null
      });
    }
  }

  if (candidates.length === 0) {
    candidates.push({
      artifact_type: "Open Case",
      title: "Report requires human review before preservation",
      evidence_refs: ["report://root"],
      source_sessions: Number(report?.session_count || report?.sessions || 0)
    });
  }

  return candidates;
}

function reportProjects(report) {
  if (Array.isArray(report?.projects)) {
    return report.projects;
  }
  if (Array.isArray(report?.reports)) {
    return report.reports;
  }
  if (report && typeof report === "object" && (report.project || report.project_key || report.user_repeated_phrases || report.exact_phrases)) {
    return [report];
  }
  return [];
}

function projectSessionCount(project) {
  if (Array.isArray(project.source_sessions)) {
    return project.source_sessions.length;
  }
  return Number(project.source_sessions || project.session_count || project.sessions || 0);
}

function projectRepeatedPhrases(project) {
  if (Array.isArray(project.user_repeated_phrases)) {
    return project.user_repeated_phrases;
  }
  return Array.isArray(project.exact_phrases) ? project.exact_phrases : [];
}

function preserveDraft(options) {
  if (!options.fromReport) {
    throw new CliError("MISSING_REPORT", "preserve.draft requires --from-report <path>.", "preserve.draft");
  }

  const reportPath = resolveWorkspacePath(options, options.fromReport);
  const report = readJsonFile(reportPath);
  if (!report) {
    throw new CliError("REPORT_READ_FAILED", "Unable to read the explicit report JSON file.", "preserve.draft");
  }

  return envelope("preserve.draft", options, {
    source_report: {
      path: options.fromReport,
      sha256: sha256(JSON.stringify(report))
    },
    artifact_candidates: summarizeReportForDraft(report),
    execution: {
      writes_now: false,
      external_writes_now: false
    },
    privacy: {
      raw_report_embedded: false,
      raw_session_included: false,
      phrase_text_redacted: true
    },
    next_action:
      "Review artifact candidates with the user, then choose Case, Factor, Habit, Rule, wrapper co-evolution, or no preservation."
  });
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
  const version = channelSnapshot(workspace.evozeus_root);
  const componentStatus = version.health === "healthy" && missing.length === 0
    ? "complete"
    : version.health === "migration_required"
      ? "migration_required"
      : "incomplete";

  return envelope("system.doctor", options, {
    install_state: {
      registered: Boolean(registration),
      installed: Boolean(manifest),
      local_cli_available: existsSync(join(workspace.evozeus_root, "bin/evozeus"))
    },
    components: {
      source_root: SOURCE_ROOT,
      status: componentStatus,
      missing
    },
    version,
    component_readiness: componentReadiness(options),
    optional_paths: {
      session_scan: "approval_required",
      infra_runtime: "approval_required",
      wrapper_github_write: "forbidden_in_p0"
    },
    doctor_verdict:
      version.health === "migration_required"
        ? "migration_required"
        : componentStatus === "complete"
          ? "ready"
          : "repair_required",
    next_command:
      version.health === "migration_required"
        ? "~/.evozeus/bin/evozeus update --channel stable --dry-run --json"
        : "~/.evozeus/bin/evozeus features --json && ~/.evozeus/bin/evozeus capabilities --json"
  });
}

function versionInfo(options) {
  return envelope("system.version", options, channelSnapshot(workspaceInfo(options).evozeus_root));
}

function channelStatus(options) {
  return envelope("system.channelStatus", options, channelSnapshot(workspaceInfo(options).evozeus_root));
}

function channelUse(options) {
  if (!options.channel || !["stable", "uat"].includes(options.channel)) {
    throw new CliError("INVALID_CHANNEL", "channel use requires stable or uat.", "system.channelUse");
  }
  if (!options.approveWrite) {
    const snapshot = channelSnapshot(workspaceInfo(options).evozeus_root);
    const installed = Boolean(snapshot.channels?.[options.channel]);
    return envelope(
      "system.channelUsePlan",
      options,
      {
        channel: options.channel,
        installed,
        writes_now: false,
        auto_refresh: options.channel === "uat" && options.autoRefresh,
        next_command: installed
          ? `evozeus channel use ${options.channel} --approve-write${options.autoRefresh ? " --auto-refresh" : ""} --json`
          : `evozeus update --channel ${options.channel} --dry-run --json`
      },
      { required: true, reason: "Changing the active EvoZeus channel writes ~/.evozeus/active-channel.json." }
    );
  }
  try {
    const active = activateInstalledChannel(
      workspaceInfo(options).evozeus_root,
      options.channel,
      options.autoRefresh
    );
    return envelope("system.channelUse", options, { channel: options.channel, active, writes_now: true });
  } catch (error) {
    throw channelCliError(error, "system.channelUse");
  }
}

function channelRollback(options) {
  if (!options.channel || !["stable", "uat"].includes(options.channel)) {
    throw new CliError("INVALID_CHANNEL", "channel rollback requires stable or uat.", "system.channelRollback");
  }
  if (!options.approveWrite) {
    return envelope(
      "system.channelRollbackPlan",
      options,
      {
        channel: options.channel,
        writes_now: false,
        next_command: `evozeus channel rollback ${options.channel} --approve-write --json`
      },
      { required: true, reason: `Rolling back ${options.channel} changes the active product installation.` }
    );
  }
  try {
    return envelope(
      "system.channelRollback",
      options,
      { rollback: rollbackChannel(workspaceInfo(options).evozeus_root, options.channel) }
    );
  } catch (error) {
    throw channelCliError(error, "system.channelRollback");
  }
}

function manifestSourceFor(options, channel) {
  if (options.manifest) return options.manifest;
  return channel === "stable" ? process.env.EVOZEUS_STABLE_MANIFEST : process.env.EVOZEUS_UAT_MANIFEST;
}

function channelCliError(error, operation) {
  if (error instanceof ChannelError) {
    return new CliError(error.code, `${error.message}${error.details?.issues ? `: ${error.details.issues.join("; ")}` : ""}`, operation);
  }
  return new CliError("CHANNEL_OPERATION_FAILED", error.message || "Channel operation failed.", operation);
}

async function updateChannel(options) {
  const snapshot = channelSnapshot(workspaceInfo(options).evozeus_root);
  const channel = options.channel || snapshot.active_channel || "stable";
  if (!["stable", "uat"].includes(channel)) {
    throw new CliError("INVALID_CHANNEL", "update --channel must be stable or uat.", "system.updatePlan");
  }
  try {
    if (!options.approveWrite) {
      const plan = await prepareChannelUpdate({
        evozeusHome: workspaceInfo(options).evozeus_root,
        channel,
        manifestSource: manifestSourceFor(options, channel)
      });
      return envelope(
        "system.updatePlan",
        options,
        { update_plan: plan },
        { required: true, reason: `Updating the ${channel} channel writes isolated EvoZeus component state.` }
      );
    }
    const result = await applyChannelUpdate({
      evozeusHome: workspaceInfo(options).evozeus_root,
      channel,
      manifestSource: manifestSourceFor(options, channel),
      autoRefresh: channel === "uat" && options.autoRefresh
    });
    return envelope("system.updateApply", options, { update: result });
  } catch (error) {
    throw channelCliError(error, options.approveWrite ? "system.updateApply" : "system.updatePlan");
  }
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
  version --json
  channel status --json
  channel use stable|uat [--approve-write] [--auto-refresh] --json
  channel rollback stable|uat [--approve-write] --json
  features --json
  capabilities --json
  activate --json
  review session --input <path|-> --json
  insights plan --source codex --json
  insights sessions --source codex --reuse-factors --html --json
  insights open --latest --json
  preserve draft --from-report <path> --json
  session analyze --input <path|-> --json
  session scan --dry-run --json
  coevolve attach --target <path|url> --json
  coevolve status --target <path|url> --json
  coevolve audit --target <path|url> --user-input <feedback> --json
  harness attach --target <path|url> --json
  doctor --json
  update --channel stable|uat [--manifest <path-or-url>] --dry-run --json
  update --channel stable|uat [--manifest <path-or-url>] --approve-write --json
  uninstall --dry-run --json

Global options:
  --workspace <path>
  --evozeus-home <path>
  --json
  --approve-feedback
  --approve-write
  --channel stable|uat
  --manifest <path-or-url>
  --auto-refresh
  --target-visibility public|private
`);
}

async function route(parsed) {
  const { options, positionals } = parsed;
  const [command, subcommand] = positionals;

  if (options.help || !command) {
    printHelp();
    return null;
  }

  if (command === "version") {
    return versionInfo(options);
  }

  if (command === "channel" && subcommand === "status") {
    return channelStatus(options);
  }

  if (command === "channel" && subcommand === "use") {
    options.channel = positionals[2] || options.channel;
    return channelUse(options);
  }

  if (command === "channel" && subcommand === "rollback") {
    options.channel = positionals[2] || options.channel;
    return channelRollback(options);
  }

  if (command === "capabilities") {
    return buildCapabilities(options);
  }

  if (command === "features") {
    return buildFeatures(options);
  }

  if (command === "activate") {
    return activate(options);
  }

  if (command === "review" && subcommand === "session") {
    return analyzeSession(options);
  }

  if (command === "session" && subcommand === "analyze") {
    return analyzeSession(options);
  }

  if (command === "session" && subcommand === "scan") {
    return scanPlan(options);
  }

  if (command === "insights" && subcommand === "plan") {
    return insightsPlan(options);
  }

  if (command === "insights" && subcommand === "sessions") {
    return insightsSessions(options);
  }

  if (command === "insights" && subcommand === "open") {
    return insightsOpen(options);
  }

  if (command === "preserve" && subcommand === "draft") {
    return preserveDraft(options);
  }

  if (command === "harness" && subcommand === "attach") {
    return attachHarness(options);
  }

  if (command === "coevolve" && subcommand === "attach") {
    return attachHarness(options);
  }

  if (command === "coevolve" && subcommand === "status") {
    return coevolveStatus(options);
  }

  if (command === "coevolve" && subcommand === "audit") {
    return coevolveAudit(options);
  }

  if (command === "doctor") {
    return doctor(options);
  }

  if (command === "update") {
    return updateChannel(options);
  }

  if (command === "uninstall") {
    return uninstallPlan(options);
  }

  throw new CliError("UNKNOWN_COMMAND", `Unknown EvoZeus command: ${positionals.join(" ") || command}`);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const result = await route(parsed);
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
