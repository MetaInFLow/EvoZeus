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
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const REGISTRATION_VERSION = 1;
const IDENTITY_VERSION = "device-runtime-v1";
const DEFAULT_RUNTIME_FAMILY = "codex";
const DEFAULT_SKELETON_ENTRIES = [
  "SKILL.md",
  "README.md",
  "skills",
  "docs/reference",
  "docs/governance/privacy-and-redaction.md",
  "docs/governance/terminology-glossary.md",
  "scripts/evozeus-cli.mjs",
  "scripts/evozeus-channels.mjs",
  "scripts/evozeus-coevolve-dispatcher.py",
  "scripts/evozeus-launcher.mjs",
  "scripts/evozeus-doctor.mjs",
  "scripts/evozeus-install.mjs"
];

function parseArgs(argv) {
  const options = {
    workspace: process.cwd(),
    evozeusHome: process.env.EVOZEUS_HOME || join(homedir(), ".evozeus"),
    sourceRoot: resolve(fileURLToPath(new URL("..", import.meta.url))),
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
    } else if (arg === "--approve-write") {
      options.approveWrite = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/evozeus-install.mjs [--workspace <path>] [--evozeus-home <path>] [--source-root <path>] [--approve-write]

Creates or reconciles the user-level EvoZeus installation under ~/.evozeus.
The selected workspace is runtime context only; registration state is not written inside the workspace.

By default this is a dry run. Pass --approve-write only after the user approves
local writes to ~/.evozeus/.`);
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

function buildSourceInfo(sourceRoot) {
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

function buildManifest(sourceRoot, skillInventory, evozeusRoot, now, existingManifest) {
  const cliPath = join(sourceRoot, "scripts/evozeus-cli.mjs");
  const source = buildSourceInfo(sourceRoot);

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
exec node "$SCRIPT_DIR/../skeleton/scripts/evozeus-launcher.mjs" "$@"
`
  );
  chmodSync(shimPath, 0o755);
  filesWritten.push(shimPath);
}

function install(options) {
  const workspaceRoot = resolve(options.workspace);
  const sourceRoot = resolve(options.sourceRoot);
  const evozeusRoot = resolve(options.evozeusHome);
  const hadEvozeus = existsSync(evozeusRoot);
  const legacyWorkspaceEvozeus = join(workspaceRoot, ".evozeus");
  const skeletonRoot = join(evozeusRoot, "skeleton");
  const registrationPath = join(evozeusRoot, "registration.json");
  const manifestPath = join(evozeusRoot, "install-manifest.json");
  const existingRegistration = existsSync(registrationPath) ? readJson(registrationPath) : null;
  const existingManifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
  const now = new Date().toISOString();
  const filesWritten = [];
  const skillInventory = listSkillInventory(sourceRoot);
  const registration = buildRegistration(existingRegistration, workspaceRoot, evozeusRoot, now);
  const manifest = buildManifest(sourceRoot, skillInventory, evozeusRoot, now, existingManifest);

  if (options.approveWrite) {
    mkdirSync(evozeusRoot, { recursive: true });
    mkdirSync(skeletonRoot, { recursive: true });

    writeFileSync(registrationPath, `${JSON.stringify(registration, null, 2)}\n`);
    filesWritten.push(registrationPath);

    for (const entry of DEFAULT_SKELETON_ENTRIES) {
      copyEntry(sourceRoot, skeletonRoot, entry, filesWritten);
    }

    writeCliShim(evozeusRoot, filesWritten);

    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    filesWritten.push(manifestPath);
  }

  return {
    registration_status: existingRegistration
      ? options.approveWrite
        ? "reconciled"
        : "would_reconcile"
      : options.approveWrite
        ? "created"
        : "would_create",
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
      release_artifact_downloaded: manifest.source.release_artifact_downloaded
    },
    cli: manifest.cli,
    skills_inventory: skillInventory.map(({ name, path }) => ({ name, path })),
    files_written: filesWritten,
    files_planned: options.approveWrite ? [] : plannedFiles(evozeusRoot),
    next_command:
      "Run ~/.evozeus/bin/evozeus version --json and ~/.evozeus/bin/evozeus doctor --json first. After channel health is ready, run ~/.evozeus/bin/evozeus features --json and ~/.evozeus/bin/evozeus capabilities --json. Do not scan local sessions, write files, or submit to GitHub unless the user explicitly approves the specific action.",
    approval_needed: options.approveWrite
      ? "Ask before session analysis, runtime, scanner, factor execution, report file generation, wrapper handoff writes, GitHub issue/PR/public artifact, update, or uninstall."
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

  console.log(JSON.stringify(install(options), null, 2));
} catch (error) {
  console.error(`evozeus-install: ${error.message}`);
  process.exit(1);
}
