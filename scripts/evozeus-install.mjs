#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { inspectLocalInstallState } from "./evozeus-install-preflight.mjs";

const REGISTRATION_VERSION = 1;
const IDENTITY_VERSION = "device-runtime-v1";
const DEFAULT_RUNTIME_FAMILY = "codex";
const DEFAULT_UPDATE_POLICY = {
  schema_version: "evozeus.update-policy.v1",
  enabled: true,
  check_interval_seconds: 3600,
  channels: { stable: true, uat: true }
};
const PREFLIGHT_MAX_AGE_MS = 60 * 60 * 1000;
const PREFLIGHT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const DEFAULT_SKELETON_ENTRIES = [
  "SKILL.md",
  "README.md",
  ".codex-plugin",
  ".claude-plugin",
  "skills",
  "hooks",
  "assets/icons",
  "packages/runtime",
  "packs/session-signal",
  "docs/reference",
  "docs/governance/privacy-and-redaction.md",
  "docs/governance/terminology-glossary.md",
  "schemas/install-preflight.schema.json",
  "scripts/evozeus-cli.mjs",
  "scripts/evozeus-channels.mjs",
  "scripts/evozeus-hosts.mjs",
  "scripts/evozeus-coevolve-dispatcher.py",
  "scripts/evozeus-launcher.mjs",
  "scripts/evozeus-doctor.mjs",
  "scripts/evozeus-install-prefetch.sh",
  "scripts/evozeus-install-preflight.mjs",
  "scripts/evozeus-install.mjs"
];

function parseArgs(argv) {
  const options = {
    workspace: process.cwd(),
    evozeusHome: process.env.EVOZEUS_HOME || join(homedir(), ".evozeus"),
    sourceRoot: resolve(fileURLToPath(new URL("..", import.meta.url))),
    releaseTag: null,
    releaseCommit: null,
    releaseArchiveSha256: null,
    preflightStdin: false,
    preflightReport: null,
    approveWrite: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") {
      options.workspace = argv[++index];
    } else if (arg === "--evozeus-home") {
      options.evozeusHome = argv[++index];
    } else if (arg === "--source-root") {
      options.sourceRoot = argv[++index];
    } else if (arg === "--release-tag") {
      options.releaseTag = argv[++index];
    } else if (arg === "--release-commit") {
      options.releaseCommit = argv[++index];
    } else if (arg === "--release-archive-sha256") {
      options.releaseArchiveSha256 = argv[++index];
    } else if (arg === "--preflight-stdin") {
      options.preflightStdin = true;
    } else if (arg === "--approve-write") {
      options.approveWrite = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const releaseMetadata = [options.releaseTag, options.releaseCommit, options.releaseArchiveSha256];
  if (releaseMetadata.some(Boolean) && !releaseMetadata.every(Boolean)) {
    throw new Error("--release-tag, --release-commit, and --release-archive-sha256 must be provided together");
  }
  if (options.releaseTag && !/^v\d+\.\d+\.\d+$/.test(options.releaseTag)) {
    throw new Error("--release-tag must be a semantic version such as v0.3.1");
  }
  if (options.releaseCommit && !/^[0-9a-f]{40}$/i.test(options.releaseCommit)) {
    throw new Error("--release-commit must be a full 40-character Git commit");
  }
  if (options.releaseArchiveSha256 && !/^(?:sha256:)?[0-9a-f]{64}$/i.test(options.releaseArchiveSha256)) {
    throw new Error("--release-archive-sha256 must be a 64-character SHA-256 digest");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/evozeus-install.mjs [--workspace <path>] [--evozeus-home <path>] [--source-root <path>] [--release-tag <vX.Y.Z> --release-commit <40-hex> --release-archive-sha256 <64-hex>] [--preflight-stdin] [--approve-write]

Creates a fresh user-level EvoZeus installation under ~/.evozeus.
Existing installations use their update, repair, migration, or no-op route.
The selected workspace is runtime context only; registration state is not written inside the workspace.

By default this is a dry run. Pass --approve-write only after the user approves
local writes to ~/.evozeus/. Both modes require a fresh full preflight report.`);
}

function readPreflightReport() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    throw new Error("--preflight-stdin requires one valid install preflight JSON object on stdin");
  }
}

function validatePreflight(options) {
  const report = options.preflightReport;
  if (!report) {
    throw new Error("fresh installer requires a full preflight report via --preflight-stdin");
  }
  if (
    report.ok !== true ||
    report.operation !== "system.installPreflight" ||
    report.schema_version !== "evozeus.install-preflight.v1" ||
    report.stage !== "full" ||
    report.writes !== false ||
    !["ready", "ready_with_fallbacks"].includes(report.status)
  ) {
    throw new Error("install preflight must be full, read-only, and ready before installation");
  }
  const networkCounts = ["head_requests", "asset_get_count", "payloads_saved", "product_assets_downloaded"];
  if (
    !Array.isArray(report.checks) ||
    !Array.isArray(report.fallbacks) ||
    !Array.isArray(report.blockers) ||
    !Array.isArray(report.remediation) ||
    !Array.isArray(report.local_state?.evidence) ||
    !networkCounts.every((key) => Number.isInteger(report.network?.[key]) && report.network[key] >= 0)
  ) {
    throw new Error("install preflight report is missing its required schema fields");
  }
  const githubChecks = report.checks.filter((item) => item?.id === "github_network");
  const latestRelease = githubChecks[0]?.detected?.latest_release;
  if (
    githubChecks.length !== 1 ||
    githubChecks[0]?.status !== "pass" ||
    !/^v\d+\.\d+\.\d+$/.test(latestRelease || "")
  ) {
    throw new Error("fresh install requires one passing github_network check with a Stable semantic release tag");
  }
  if (options.releaseTag && latestRelease !== options.releaseTag) {
    throw new Error(`install preflight Stable tag ${latestRelease} does not match --release-tag ${options.releaseTag}`);
  }
  if (
    report.target?.channel !== "stable" ||
    typeof report.target?.evozeus_home !== "string" ||
    !isAbsolute(report.target.evozeus_home) ||
    resolve(report.target.evozeus_home) !== resolve(options.evozeusHome)
  ) {
    throw new Error("install preflight target must match the Stable channel and requested EVOZEUS_HOME");
  }
  const checkedAt = typeof report.checked_at === "string" ? Date.parse(report.checked_at) : Number.NaN;
  const age = Date.now() - checkedAt;
  if (!Number.isFinite(checkedAt) || age > PREFLIGHT_MAX_AGE_MS || age < -PREFLIGHT_FUTURE_TOLERANCE_MS) {
    throw new Error("install preflight report is stale or has an invalid checked_at timestamp");
  }
  if (report.network?.product_assets_downloaded !== 0) {
    throw new Error("install preflight must complete before product assets are downloaded");
  }
  const localState = report.local_state?.status;
  if (localState !== "not_installed") {
    throw new Error(`fresh install is allowed only for not_installed; ${localState || "unknown"} must use its state-specific route`);
  }
  if (report.local_state?.preliminary !== false) {
    throw new Error("fresh install requires a final local-state decision, not a preliminary result");
  }
  if (!Array.isArray(report.blockers) || report.blockers.length !== 0) {
    throw new Error("fresh install requires an empty preflight blocker list");
  }
  if (
    report.next_action?.action !== "request_fresh_install_approval" ||
    report.next_action?.allowed !== true ||
    report.next_action?.approval_required !== true ||
    report.next_action?.writes_now !== false ||
    report.next_action?.product_asset_download_now !== false ||
    report.next_action?.registration_now !== false
  ) {
    throw new Error("fresh install requires the exact approved preflight next action");
  }
  return {
    schema_version: report.schema_version,
    status: report.status,
    local_state: localState,
    route: "fresh_install",
    writes: false,
    checked_at: report.checked_at,
    target: report.target,
    latest_release: latestRelease
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmacSha256(key, value) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function gitCommit(sourceRoot) {
  const result = spawnSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return "unknown";
  }
  return result.stdout.trim() || "unknown";
}

function gitExactTag(sourceRoot) {
  const result = spawnSync("git", ["-C", sourceRoot, "describe", "--tags", "--exact-match", "HEAD"], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim() || null;
}

function buildSourceInfo(sourceRoot, releaseMetadata = null) {
  if (releaseMetadata) {
    const digest = releaseMetadata.archiveSha256.replace(/^sha256:/i, "").toLowerCase();
    return {
      repository: "MetaInFLow/EvoZeus",
      install_material: "release_archive",
      local_source: false,
      local_source_path: sourceRoot,
      resolved_ref: releaseMetadata.tag,
      resolved_commit: releaseMetadata.commit.toLowerCase(),
      git_commit: releaseMetadata.commit.toLowerCase(),
      exact_tag: releaseMetadata.tag,
      release_archive_sha256: `sha256:${digest}`,
      release_artifact_downloaded: true
    };
  }

  const commit = gitCommit(sourceRoot);
  const exactTag = gitExactTag(sourceRoot);

  return {
    repository: "MetaInFLow/EvoZeus",
    install_material: "local_source_checkout",
    local_source: true,
    local_source_path: sourceRoot,
    resolved_ref: exactTag ?? commit,
    resolved_commit: commit,
    git_commit: commit,
    exact_tag: exactTag,
    release_archive_sha256: null,
    release_artifact_downloaded: false
  };
}

function listSkillInventory(sourceRoot) {
  const skillsRoot = join(sourceRoot, "skills");
  if (!existsSync(skillsRoot)) {
    return [];
  }

  return walkSkillFiles(skillsRoot).map((skillPath) => {
    const content = readFileSync(skillPath, "utf8");
    const name = content.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? "unknown";
    return {
      name,
      path: relative(sourceRoot, skillPath),
      sha256: sha256File(skillPath)
    };
  });
}

function walkSkillFiles(root) {
  const entries = [];
  for (const entry of readdirSorted(root)) {
    const path = join(root, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      entries.push(...walkSkillFiles(path));
    } else if (entry === "SKILL.md") {
      entries.push(path);
    }
  }
  return entries;
}

function readdirSorted(root) {
  return existsSync(root) ? readdirSync(root).sort() : [];
}

function copyEntry(sourceRoot, targetRoot, entry, filesWritten) {
  const source = join(sourceRoot, entry);
  if (!existsSync(source)) {
    return;
  }

  const target = join(targetRoot, entry);
  mkdirSync(dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  filesWritten.push(target);
}

function plannedFiles(evozeusRoot) {
  return [
    join(evozeusRoot, "registration.json"),
    join(evozeusRoot, "install-manifest.json"),
    join(evozeusRoot, "update-policy.json"),
    join(evozeusRoot, "bin/evozeus"),
    join(evozeusRoot, "skeleton")
  ];
}

function normalizeMachineId(value) {
  return String(value ?? "")
    .trim()
    .replace(/^"|"$/g, "")
    .toLowerCase();
}

function readCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

function readLinuxMachineId() {
  for (const path of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
    if (existsSync(path)) {
      const value = normalizeMachineId(readFileSync(path, "utf8"));
      if (/^[a-f0-9]{32}$/.test(value) && !/^0+$/.test(value)) {
        return { source: path, raw_id: value };
      }
    }
  }
  return null;
}

function readMacMachineId() {
  const output = readCommand("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
  const value = normalizeMachineId(output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)?.[1]);
  return value ? { source: "IOPlatformUUID", raw_id: value } : null;
}

function readWindowsMachineId() {
  const output = readCommand("reg", ["query", "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"]);
  const value = normalizeMachineId(output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i)?.[1]);
  return value ? { source: "MachineGuid", raw_id: value } : null;
}

function readOsMachineId() {
  const override = normalizeMachineId(process.env.EVOZEUS_MACHINE_ID_OVERRIDE);
  if (override) {
    return { source: "env:EVOZEUS_MACHINE_ID_OVERRIDE", raw_id: override, quality: "test_override" };
  }

  try {
    if (process.platform === "darwin") {
      return readMacMachineId();
    }
    if (process.platform === "win32") {
      return readWindowsMachineId();
    }
    if (process.platform === "linux") {
      return readLinuxMachineId();
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeRuntimeHash(value) {
  const hash = String(value ?? "").trim().replace(/^sha256:/i, "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : "";
}

function stablePathMaterial(path) {
  return existsSync(path) ? realpathSync(path) : resolve(path);
}

function deriveDeviceRuntimeIdentity(identityRoot, existingRegistration) {
  const runtimeFamily = DEFAULT_RUNTIME_FAMILY;
  const machine = readOsMachineId();
  const existingRuntimeHash = normalizeRuntimeHash(
    existingRegistration?.identity?.runtime_instance_hash ?? existingRegistration?.runtime_instance_hash
  );
  const legacyRuntimeHashes = new Set(
    [existingRuntimeHash, ...(Array.isArray(existingRegistration?.identity?.legacy_runtime_instance_hashes)
      ? existingRegistration.identity.legacy_runtime_instance_hashes.map(normalizeRuntimeHash)
      : [])].filter(Boolean)
  );

  if (!machine?.raw_id) {
    const fallbackHash = existingRuntimeHash || sha256(`evozeus-runtime-fallback-v1\0${stablePathMaterial(identityRoot)}`);
    return {
      version: IDENTITY_VERSION,
      source: "unavailable",
      source_quality: "fallback_workspace_hash",
      recovery_capable: Boolean(existingRuntimeHash),
      device_id_hash: "",
      runtime_family: runtimeFamily,
      runtime_instance_hash: fallbackHash,
      legacy_runtime_instance_hashes: [...legacyRuntimeHashes].filter((hash) => hash !== fallbackHash)
    };
  }

  const machineMaterial = [process.platform, machine.source, normalizeMachineId(machine.raw_id)].join("\0");
  const deviceHash = hmacSha256(machineMaterial, "com.metainflow.evozeus.device.v1");
  const runtimeHash = hmacSha256(
    machineMaterial,
    `com.metainflow.evozeus.runtime.v1\0${runtimeFamily}`
  );

  return {
    version: IDENTITY_VERSION,
    source: machine.source,
    source_quality: machine.quality ?? "os_native_machine_id",
    recovery_capable: true,
    device_id_hash: deviceHash,
    runtime_family: runtimeFamily,
    runtime_instance_hash: runtimeHash,
    legacy_runtime_instance_hashes: [...legacyRuntimeHashes].filter((hash) => hash !== runtimeHash)
  };
}

function buildRegistration(existingRegistration, workspaceRoot, evozeusRoot, now) {
  const workspaceHash = sha256(realpathSync(workspaceRoot));
  const identity = deriveDeviceRuntimeIdentity(evozeusRoot, existingRegistration);
  const registrationId =
    existingRegistration?.registration_id ?? `evozeus-local-${identity.runtime_instance_hash.slice(0, 16)}`;

  return {
    schema_version: REGISTRATION_VERSION,
    registration_id: registrationId,
    status: "registered",
    runtime_instance_hash: identity.runtime_instance_hash,
    identity,
    workspace_hash: workspaceHash,
    created_at: existingRegistration?.created_at ?? now,
    updated_at: now,
    local_only: true
  };
}

function buildManifest(sourceRoot, skillInventory, evozeusRoot, now, existingManifest, releaseMetadata) {
  const cliPath = join(sourceRoot, "scripts/evozeus-cli.mjs");
  const source = buildSourceInfo(sourceRoot, releaseMetadata);

  return {
    schema_version: REGISTRATION_VERSION,
    status: "installed",
    source,
    cli: {
      command: "~/.evozeus/bin/evozeus",
      path: join(evozeusRoot, "bin/evozeus"),
      script: "scripts/evozeus-cli.mjs",
      capabilities_hash: existsSync(cliPath) ? sha256File(cliPath) : "missing"
    },
    skeleton_entries: DEFAULT_SKELETON_ENTRIES.filter((entry) => existsSync(join(sourceRoot, entry))),
    skills_inventory: skillInventory,
    created_at: existingManifest?.created_at ?? now,
    updated_at: now,
    not_enabled: [
      "runtime scanner",
      "FactorRunner",
      "workspace scan",
      "cloud sync",
      "GitHub issue/PR/public artifact",
      "EvoZeus-CoEvolve repo writes"
    ]
  };
}

function writeCliShim(evozeusRoot, filesWritten) {
  const binRoot = join(evozeusRoot, "bin");
  const shimPath = join(binRoot, "evozeus");
  mkdirSync(binRoot, { recursive: true });
  writeFileSync(
    shimPath,
    `#!/bin/sh
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
EVOZEUS_HOME="\${EVOZEUS_HOME:-$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)}"
export EVOZEUS_HOME
ACTIVE_LAUNCHER=$(
  node - "$EVOZEUS_HOME" 2>/dev/null <<'EVOZEUS_RESOLVE'
const fs = require("node:fs");
const path = require("node:path");

function readControl(home, name) {
  const target = path.join(home, name);
  const stats = fs.lstatSync(target);
  if (stats.isSymbolicLink() || !stats.isFile()) throw new Error("unsafe control file");
  return JSON.parse(fs.readFileSync(target, "utf8"));
}

function isSafePath(root, target, finalKind) {
  if (!path.isAbsolute(target)) return false;
  const relative = path.relative(root, target);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) return false;
  const rootStats = fs.lstatSync(root);
  if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) return false;
  let current = root;
  const segments = relative.split(path.sep).filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const stats = fs.lstatSync(current);
    if (stats.isSymbolicLink()) return false;
    const final = index === segments.length - 1;
    if (!final && !stats.isDirectory()) return false;
    if (final && finalKind === "directory" && !stats.isDirectory()) return false;
    if (final && finalKind === "file" && !stats.isFile()) return false;
  }
  return true;
}

try {
  const home = fs.realpathSync(path.resolve(process.argv[2]));
  const active = readControl(home, "active-channel.json");
  const state = readControl(home, "channel-state.json");
  if (active.schema_version !== "evozeus.active-channel.v1" || !["stable", "uat"].includes(active.channel)) {
    throw new Error("invalid active channel");
  }
  if (state.schema_version !== "evozeus.channel-state.v1") throw new Error("invalid channel state");
  const entry = state.channels && state.channels[active.channel];
  const installRoot = entry && entry.install_root;
  const coreRoot = entry && entry.component_roots && entry.component_roots.evozeus;
  if (!entry || entry.manifest?.schema_version !== "evozeus.product-channel.v2" || entry.manifest.channel !== active.channel) {
    throw new Error("invalid active entry");
  }
  if (typeof installRoot !== "string" || typeof coreRoot !== "string") throw new Error("missing active roots");
  if (path.resolve(coreRoot) !== path.resolve(path.join(installRoot, "evozeus"))) throw new Error("invalid core root");
  const launcher = path.join(coreRoot, "scripts", "evozeus-launcher.mjs");
  const channels = path.join(coreRoot, "scripts", "evozeus-channels.mjs");
  if (!isSafePath(home, installRoot, "directory")) throw new Error("unsafe install root");
  if (!isSafePath(installRoot, coreRoot, "directory")) throw new Error("unsafe core root");
  if (!isSafePath(coreRoot, launcher, "file") || !isSafePath(coreRoot, channels, "file")) {
    throw new Error("active launcher is unavailable");
  }
  process.stdout.write(launcher);
} catch {
  process.exit(1);
}
EVOZEUS_RESOLVE
) || ACTIVE_LAUNCHER=
if [ -n "$ACTIVE_LAUNCHER" ]; then
  exec node "$ACTIVE_LAUNCHER" "$@"
fi
exec node "$SCRIPT_DIR/../skeleton/scripts/evozeus-launcher.mjs" "$@"
`
  );
  chmodSync(shimPath, 0o755);
  filesWritten.push(shimPath);
}

function install(options) {
  const preflight = validatePreflight(options);
  const currentLocalState = inspectLocalInstallState({ evozeusHome: options.evozeusHome });
  if (currentLocalState.status !== "not_installed") {
    throw new Error(`local installation state changed after preflight; expected not_installed, found ${currentLocalState.status}`);
  }
  const workspaceRoot = resolve(options.workspace);
  const sourceRoot = resolve(options.sourceRoot);
  const evozeusRoot = resolve(options.evozeusHome);
  const hadEvozeus = existsSync(evozeusRoot);
  const legacyWorkspaceEvozeus = join(workspaceRoot, ".evozeus");
  const skeletonRoot = join(evozeusRoot, "skeleton");
  const registrationPath = join(evozeusRoot, "registration.json");
  const manifestPath = join(evozeusRoot, "install-manifest.json");
  const updatePolicyPath = join(evozeusRoot, "update-policy.json");
  const existingRegistration = existsSync(registrationPath) ? readJson(registrationPath) : null;
  const existingManifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
  const existingUpdatePolicy = existsSync(updatePolicyPath) ? readJson(updatePolicyPath) : null;
  const now = new Date().toISOString();
  const filesWritten = [];
  const skillInventory = listSkillInventory(sourceRoot);
  const registration = buildRegistration(existingRegistration, workspaceRoot, evozeusRoot, now);
  const releaseMetadata = options.releaseTag
    ? {
        tag: options.releaseTag,
        commit: options.releaseCommit,
        archiveSha256: options.releaseArchiveSha256
      }
    : null;
  const manifest = buildManifest(
    sourceRoot,
    skillInventory,
    evozeusRoot,
    now,
    existingManifest,
    releaseMetadata
  );

  if (options.approveWrite) {
    mkdirSync(evozeusRoot, { recursive: true });
    mkdirSync(skeletonRoot, { recursive: true });

    writeFileSync(registrationPath, `${JSON.stringify(registration, null, 2)}\n`);
    filesWritten.push(registrationPath);

    writeFileSync(
      updatePolicyPath,
      `${JSON.stringify(existingUpdatePolicy || DEFAULT_UPDATE_POLICY, null, 2)}\n`,
      { mode: 0o600 }
    );
    filesWritten.push(updatePolicyPath);

    for (const entry of DEFAULT_SKELETON_ENTRIES) {
      copyEntry(sourceRoot, skeletonRoot, entry, filesWritten);
    }

    writeCliShim(evozeusRoot, filesWritten);

    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    filesWritten.push(manifestPath);
  }

  return {
    preflight,
    registration_status: options.approveWrite ? "created" : "would_create",
    write_mode: options.approveWrite ? "approved_write" : "dry_run",
    evozeus_home: evozeusRoot,
    workspace_root: workspaceRoot,
    registration_home_state: hadEvozeus ? "existing_evozeus_home" : "no_evozeus_home",
    workspace_state: existsSync(legacyWorkspaceEvozeus)
      ? "legacy_workspace_evozeus_present_not_used"
      : "workspace_not_used_for_registration",
    legacy_workspace_evozeus: {
      path: legacyWorkspaceEvozeus,
      exists: existsSync(legacyWorkspaceEvozeus),
      used_for_registration: false
    },
    skeleton_source: {
      repository: manifest.source.repository,
      install_material: manifest.source.install_material,
      local_source_path: manifest.source.local_source_path,
      resolved_ref: manifest.source.resolved_ref,
      resolved_commit: manifest.source.resolved_commit,
      exact_tag: manifest.source.exact_tag,
      release_archive_sha256: manifest.source.release_archive_sha256,
      release_artifact_downloaded: manifest.source.release_artifact_downloaded
    },
    cli: manifest.cli,
    skills_inventory: skillInventory.map(({ name, path }) => ({ name, path })),
    files_written: filesWritten,
    files_planned: options.approveWrite ? [] : plannedFiles(evozeusRoot),
    next_command:
      "Run ~/.evozeus/bin/evozeus align --channel stable --host auto --json, ask for approval, rerun it with --approve-write, then start a new Agent chat. Do not scan local sessions, write project files, or submit to GitHub unless the user explicitly approves the specific action.",
    approval_needed: options.approveWrite
      ? "Automatic verified product updates are enabled by update-policy.json. Ask before session analysis, scanner/factor execution, report generation, repository writes, GitHub issue/PR/public artifacts, channel switching, policy changes, or uninstall."
      : "Ask the user before writing ~/.evozeus, then rerun with --approve-write.",
    not_enabled: manifest.not_enabled
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.preflightStdin) options.preflightReport = readPreflightReport();

  console.log(JSON.stringify(install(options), null, 2));
} catch (error) {
  console.error(`evozeus-install: ${error.message}`);
  process.exit(1);
}
