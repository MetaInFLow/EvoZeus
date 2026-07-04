#!/usr/bin/env node

import { createHash } from "node:crypto";
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
import { fileURLToPath } from "node:url";

const REGISTRATION_VERSION = 1;
const DEFAULT_SKELETON_ENTRIES = [
  "SKILL.md",
  "README.md",
  "skills",
  "docs/reference",
  "docs/governance/privacy-and-redaction.md",
  "docs/governance/terminology-glossary.md",
  "scripts/evozeus-cli.mjs",
  "scripts/evozeus-doctor.mjs",
  "scripts/evozeus-install.mjs"
];

function parseArgs(argv) {
  const options = {
    workspace: process.cwd(),
    sourceRoot: resolve(fileURLToPath(new URL("..", import.meta.url))),
    approveWrite: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workspace") {
      options.workspace = argv[++index];
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
  console.log(`Usage: node scripts/evozeus-install.mjs [--workspace <path>] [--source-root <path>] [--approve-write]

Creates or reconciles a local .evozeus installation for the selected workspace.

By default this is a dry run. Pass --approve-write only after the user approves
local writes to .evozeus/.`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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
  filesWritten.push(join(".evozeus/skeleton", relative(targetRoot, target)));
}

function plannedFiles(workspaceRoot) {
  return [
    join(workspaceRoot, ".evozeus/registration.json"),
    join(workspaceRoot, ".evozeus/install-manifest.json"),
    join(workspaceRoot, ".evozeus/bin/evozeus"),
    join(workspaceRoot, ".evozeus/skeleton")
  ];
}

function buildRegistration(existingRegistration, workspaceRoot, now) {
  const workspaceHash = sha256(realpathSync(workspaceRoot));
  const registrationId = existingRegistration?.registration_id ?? `evozeus-local-${workspaceHash.slice(0, 16)}`;

  return {
    schema_version: REGISTRATION_VERSION,
    registration_id: registrationId,
    status: "registered",
    workspace_hash: workspaceHash,
    created_at: existingRegistration?.created_at ?? now,
    updated_at: now,
    local_only: true
  };
}

function buildManifest(sourceRoot, skillInventory, now, existingManifest) {
  const cliPath = join(sourceRoot, "scripts/evozeus-cli.mjs");

  return {
    schema_version: REGISTRATION_VERSION,
    status: "installed",
    source: {
      repository: "MetaInFLow/EvoZeus",
      local_source: true,
      git_commit: gitCommit(sourceRoot)
    },
    cli: {
      command: ".evozeus/bin/evozeus",
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
      "EvoZeus-wrapper repo writes"
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
exec node "$SCRIPT_DIR/../skeleton/scripts/evozeus-cli.mjs" "$@"
`
  );
  chmodSync(shimPath, 0o755);
  filesWritten.push(".evozeus/bin/evozeus");
}

function install(options) {
  const workspaceRoot = resolve(options.workspace);
  const sourceRoot = resolve(options.sourceRoot);
  const evozeusRoot = join(workspaceRoot, ".evozeus");
  const hadEvozeus = existsSync(evozeusRoot);
  const skeletonRoot = join(evozeusRoot, "skeleton");
  const registrationPath = join(evozeusRoot, "registration.json");
  const manifestPath = join(evozeusRoot, "install-manifest.json");
  const existingRegistration = existsSync(registrationPath) ? readJson(registrationPath) : null;
  const existingManifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
  const now = new Date().toISOString();
  const filesWritten = [];
  const skillInventory = listSkillInventory(sourceRoot);
  const registration = buildRegistration(existingRegistration, workspaceRoot, now);
  const manifest = buildManifest(sourceRoot, skillInventory, now, existingManifest);

  if (options.approveWrite) {
    mkdirSync(evozeusRoot, { recursive: true });
    mkdirSync(skeletonRoot, { recursive: true });

    writeFileSync(registrationPath, `${JSON.stringify(registration, null, 2)}\n`);
    filesWritten.push(".evozeus/registration.json");

    for (const entry of DEFAULT_SKELETON_ENTRIES) {
      copyEntry(sourceRoot, skeletonRoot, entry, filesWritten);
    }

    writeCliShim(evozeusRoot, filesWritten);

    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    filesWritten.push(".evozeus/install-manifest.json");
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
    workspace_state: hadEvozeus ? "existing_evozeus" : "no_evozeus",
    skeleton_source: {
      repository: "MetaInFLow/EvoZeus",
      git_commit: manifest.source.git_commit
    },
    cli: manifest.cli,
    skills_inventory: skillInventory.map(({ name, path }) => ({ name, path })),
    files_written: filesWritten,
    files_planned: options.approveWrite ? [] : plannedFiles(workspaceRoot).map((path) => relative(workspaceRoot, path)),
    next_command:
      "Run ./.evozeus/bin/evozeus capabilities --json, show the available EvoZeus capabilities, then ask the user which path to take. Do not scan local sessions, write files, or submit to GitHub unless the user explicitly approves the specific action.",
    approval_needed: options.approveWrite
      ? "Ask before session analysis, runtime, scanner, factor execution, report file generation, wrapper handoff writes, GitHub issue/PR/public artifact, update, or uninstall."
      : "Ask the user before writing .evozeus, then rerun with --approve-write.",
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
