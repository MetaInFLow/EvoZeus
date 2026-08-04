import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PRODUCT_COMPONENTS = ["evozeus", "coevolve"];
export const EMBEDDED_COMPONENTS = ["runtime", "session_signal"];
export const CHANNELS = ["stable", "uat"];
export const DEFAULT_MANIFEST_SOURCES = {
  stable:
    "https://github.com/MetaInFLow/EvoZeus/releases/latest/download/evozeus-product-stable.json",
  uat: "https://raw.githubusercontent.com/MetaInFLow/EvoZeus/uat/current/channels/uat.json"
};

const CHANNEL_RECOVERY_FAILURE_CODES = new Set([
  "UPDATE_ROLLBACK_FAILED",
  "ACTIVATION_ROLLBACK_FAILED",
  "BOOTSTRAP_ROLLBACK_FAILED",
  "ROLLBACK_TRANSACTION_FAILED"
]);

export function channelRecoveryIncomplete(error) {
  return CHANNEL_RECOVERY_FAILURE_CODES.has(error?.code);
}

const COMPONENT_ENV = {
  evozeus: "EVOZEUS_CORE_ROOT",
  coevolve: "EVOZEUS_WRAPPER_ROOT"
};

const COMPONENT_SIBLING = {
  evozeus: "EvoZeus",
  coevolve: "EvoZeus-CoEvolve"
};
const EMBEDDED_FALLBACK = {
  runtime: "packages/runtime",
  session_signal: "packs/session-signal"
};
const CHANNEL_BOOTSTRAP_FILES = [
  "evozeus-channels.mjs",
  "evozeus-hosts.mjs",
  "evozeus-coevolve-dispatcher.py",
  "evozeus-install-prefetch.sh",
  "evozeus-install-preflight.mjs",
  "evozeus-launcher.mjs"
];
const CHANNEL_DISPATCHER = fileURLToPath(new URL("./evozeus-coevolve-dispatcher.py", import.meta.url));
const MANAGED_CLI_SHIM_V1 = `#!/bin/sh
# evozeus.managed-cli.v1
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
EVOZEUS_HOME="\${EVOZEUS_HOME:-$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)}"
export EVOZEUS_HOME
ACTIVE_LAUNCHER=$(
  node - "$EVOZEUS_HOME" 2>/dev/null <<'EVOZEUS_RESOLVE'
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function productManifestDigest(manifest) {
  return "sha256:" + crypto.createHash("sha256").update(JSON.stringify(canonicalize(manifest))).digest("hex");
}

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
  if (entry.manifest_digest !== productManifestDigest(entry.manifest)) {
    throw new Error("invalid active manifest digest");
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
`;

export function buildManagedCliShimContent() {
  return MANAGED_CLI_SHIM_V1;
}

export class ChannelError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function privateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
  return path;
}

function atomicWriteJson(path, payload) {
  privateDirectory(dirname(path));
  const temporary = join(dirname(path), `.${path.split(sep).at(-1)}.${randomUUID()}.tmp`);
  writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
  chmodSync(path, 0o600);
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (!isObject(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function productManifestDigest(manifest) {
  return `sha256:${sha256(JSON.stringify(canonicalize(manifest)))}`;
}

function exactKeys(value, allowed, prefix, issues) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      issues.push(`${prefix}.${key} is not allowed`);
    }
  }
}

function validUrl(value) {
  try {
    const parsed = new URL(value);
    return ["https:", "file:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function validRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || isAbsolute(value)) {
    return false;
  }
  return !value.split(/[\\/]+/).includes("..");
}

export function validateProductManifest(manifest, expectedChannel = null) {
  const issues = [];
  if (!isObject(manifest)) {
    return ["manifest must be an object"];
  }
  exactKeys(
    manifest,
    ["schema_version", "product_version", "channel", "generated_at", "components", "embedded", "compatibility"],
    "manifest",
    issues
  );
  if (manifest.schema_version !== "evozeus.product-channel.v2") {
    issues.push("schema_version must be evozeus.product-channel.v2");
  }
  if (!/^v\d+\.\d+\.\d+$/.test(String(manifest.product_version ?? ""))) {
    issues.push("product_version must use vMAJOR.MINOR.PATCH");
  }
  if (!CHANNELS.includes(manifest.channel)) {
    issues.push("channel must be stable or uat");
  }
  if (expectedChannel && manifest.channel !== expectedChannel) {
    issues.push(`manifest channel ${manifest.channel} does not match requested channel ${expectedChannel}`);
  }
  if (Number.isNaN(Date.parse(String(manifest.generated_at ?? "")))) {
    issues.push("generated_at must be an RFC3339 timestamp");
  }
  if (!isObject(manifest.components)) {
    issues.push("components must be an object");
    return issues;
  }
  exactKeys(manifest.components, PRODUCT_COMPONENTS, "components", issues);
  for (const componentId of PRODUCT_COMPONENTS) {
    const component = manifest.components[componentId];
    const prefix = `components.${componentId}`;
    if (!isObject(component)) {
      issues.push(`${prefix} is required`);
      continue;
    }
    exactKeys(component, ["version", "commit", "source", "required_paths"], prefix, issues);
    if (!/^v\d+\.\d+\.\d+$/.test(String(component.version ?? ""))) {
      issues.push(`${prefix}.version must use vMAJOR.MINOR.PATCH`);
    }
    if (!/^[a-f0-9]{40}$/.test(String(component.commit ?? ""))) {
      issues.push(`${prefix}.commit must be a full lowercase Git SHA`);
    }
    if (!isObject(component.source)) {
      issues.push(`${prefix}.source is required`);
    } else {
      exactKeys(component.source, ["kind", "url", "ref", "sha256"], `${prefix}.source`, issues);
      const expectedKind = manifest.channel === "stable" ? "release_archive" : "git";
      if (component.source.kind !== expectedKind) {
        issues.push(`${prefix}.source.kind must be ${expectedKind} for ${manifest.channel}`);
      }
      if (!validUrl(component.source.url)) {
        issues.push(`${prefix}.source.url must be an https or file URL`);
      }
      if (typeof component.source.ref !== "string" || component.source.ref.length === 0) {
        issues.push(`${prefix}.source.ref is required`);
      }
      if (
        manifest.channel === "stable" &&
        !/^sha256:[a-f0-9]{64}$/.test(String(component.source.sha256 ?? ""))
      ) {
        issues.push(`${prefix}.source.sha256 is required for stable archives`);
      }
    }
    if (
      !Array.isArray(component.required_paths) ||
      component.required_paths.length === 0 ||
      component.required_paths.some((entry) => !validRelativePath(entry))
    ) {
      issues.push(`${prefix}.required_paths must contain safe relative paths`);
    }
  }
  if (!isObject(manifest.embedded)) {
    issues.push("embedded must be an object");
  } else {
    exactKeys(manifest.embedded, EMBEDDED_COMPONENTS, "embedded", issues);
    for (const componentId of EMBEDDED_COMPONENTS) {
      const component = manifest.embedded[componentId];
      const prefix = `embedded.${componentId}`;
      if (!isObject(component)) {
        issues.push(`${prefix} is required`);
        continue;
      }
      exactKeys(component, ["version", "path", "required_paths"], prefix, issues);
      if (!/^v\d+\.\d+\.\d+$/.test(String(component.version ?? ""))) {
        issues.push(`${prefix}.version must use vMAJOR.MINOR.PATCH`);
      }
      if (!validRelativePath(component.path)) {
        issues.push(`${prefix}.path must be a safe relative path`);
      }
      if (
        !Array.isArray(component.required_paths) ||
        component.required_paths.length === 0 ||
        component.required_paths.some((entry) => !validRelativePath(entry))
      ) {
        issues.push(`${prefix}.required_paths must contain safe relative paths`);
      }
    }
  }
  if (!isObject(manifest.compatibility)) {
    issues.push("compatibility is required");
  } else {
    exactKeys(
      manifest.compatibility,
      ["runtime_min_inclusive", "runtime_max_exclusive", "coevolve_contract"],
      "compatibility",
      issues
    );
    const minimum = semverTuple(manifest.compatibility.runtime_min_inclusive);
    const maximum = semverTuple(manifest.compatibility.runtime_max_exclusive);
    const runtime = semverTuple(manifest.embedded?.runtime?.version);
    if (!minimum) issues.push("compatibility.runtime_min_inclusive must use SemVer");
    if (!maximum) issues.push("compatibility.runtime_max_exclusive must use SemVer");
    if (!/^v\d+\.\d+\.\d+$/.test(String(manifest.compatibility.coevolve_contract ?? ""))) {
      issues.push("compatibility.coevolve_contract must use vMAJOR.MINOR.PATCH");
    }
    if (minimum && maximum && compareSemver(minimum, maximum) >= 0) {
      issues.push("compatibility runtime range must be non-empty");
    }
    if (runtime && minimum && maximum && (compareSemver(runtime, minimum) < 0 || compareSemver(runtime, maximum) >= 0)) {
      issues.push("embedded.runtime.version is outside the product compatibility range");
    }
  }
  return issues;
}

function semverTuple(value) {
  const match = String(value ?? "").match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareSemver(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export async function loadProductManifest(source, expectedChannel, fetchImpl = globalThis.fetch) {
  let manifest;
  if (/^https:\/\//.test(source)) {
    const response = await fetchImpl(source, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new ChannelError("MANIFEST_FETCH_FAILED", `manifest fetch failed with HTTP ${response.status}`, {
        source
      });
    }
    manifest = await response.json();
  } else if (/^file:\/\//.test(source)) {
    manifest = readJson(new URL(source));
  } else {
    manifest = readJson(resolve(source));
  }
  const issues = validateProductManifest(manifest, expectedChannel);
  if (issues.length > 0) {
    throw new ChannelError("MANIFEST_INVALID", "product channel manifest is invalid", { issues, source });
  }
  return manifest;
}

function defaultChannelState() {
  return {
    schema_version: "evozeus.channel-state.v1",
    channels: { stable: null, uat: null },
    last_transaction: null
  };
}

export function readChannelState(evozeusHome) {
  const state = readJson(join(resolve(evozeusHome), "channel-state.json"));
  if (!isObject(state) || state.schema_version !== "evozeus.channel-state.v1") {
    return defaultChannelState();
  }
  return {
    ...defaultChannelState(),
    ...state,
    channels: { stable: state.channels?.stable ?? null, uat: state.channels?.uat ?? null }
  };
}

export function readActiveChannel(evozeusHome) {
  const active = readJson(join(resolve(evozeusHome), "active-channel.json"));
  if (!isObject(active) || !CHANNELS.includes(active.channel)) {
    return null;
  }
  return active;
}

function gitCommit(root) {
  if (!root || !existsSync(root)) {
    return null;
  }
  const result = spawnSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function inspectInstalledComponent(componentId, root, expected) {
  const missing = [];
  if (!root || !existsSync(root)) {
    return { status: "missing", root, missing: expected?.required_paths ?? [], actual_commit: null };
  }
  for (const entry of expected?.required_paths ?? []) {
    if (!existsSync(join(root, entry))) {
      missing.push(entry);
    }
  }
  const actualCommit = gitCommit(root);
  const commitMismatch = Boolean(actualCommit && expected?.commit && actualCommit !== expected.commit);
  return {
    status: missing.length > 0 || commitMismatch ? "invalid" : "ready",
    health: missing.length > 0 || commitMismatch ? "invalid" : "healthy",
    root,
    expected_version: expected?.version ?? null,
    expected_commit: expected?.commit ?? null,
    source: expected?.source ?? null,
    actual_commit: actualCommit,
    commit_mismatch: commitMismatch,
    missing
  };
}

function inspectEmbeddedComponent(componentId, coreRoot, expected) {
  const root = coreRoot && expected?.path ? join(coreRoot, expected.path) : null;
  const missing = [];
  if (!root || !existsSync(root)) {
    return {
      status: "missing",
      health: "missing",
      root,
      expected_version: expected?.version ?? null,
      missing: expected?.required_paths ?? []
    };
  }
  for (const entry of expected?.required_paths ?? []) {
    if (!existsSync(join(root, entry))) missing.push(entry);
  }
  return {
    status: missing.length > 0 ? "invalid" : "ready",
    health: missing.length > 0 ? "invalid" : "healthy",
    root,
    expected_version: expected?.version ?? null,
    source: "embedded_in_evozeus",
    missing
  };
}

function legacySnapshot(evozeusHome) {
  const home = resolve(evozeusHome);
  const install = readJson(join(home, "install-manifest.json"));
  const hook = readJson(join(home, "hooks", "state.json"));
  if (!install && !hook) {
    return null;
  }
  const commit = install?.source?.resolved_commit ?? install?.source?.git_commit ?? null;
  const exactTag = install?.source?.exact_tag ?? null;
  const installedCli = join(home, "skeleton", "scripts", "evozeus-cli.mjs");
  const hasFeatures = existsSync(installedCli)
    ? readFileSync(installedCli, "utf8").includes('name: "features.describe"')
    : false;
  const issues = [];
  if (!exactTag) issues.push("core source is not an exact release tag");
  if (!hasFeatures) issues.push("installed CLI does not provide the documented features command");
  if (hook?.wrapper_source && String(hook.wrapper_source).includes("EvoZeus-wrapper")) {
    issues.push("CoEvolve dispatcher uses the legacy EvoZeus-wrapper source");
  }
  if (hook?.wrapper_source && String(hook.wrapper_source).startsWith("/private/tmp/")) {
    issues.push("CoEvolve dispatcher source is a temporary directory");
  }
  return {
    status: "legacy",
    migration_required: true,
    issues,
    components: {
      evozeus: {
        version: exactTag ?? "unreleased",
        commit,
        source: install?.source ?? null,
        health: hasFeatures ? "legacy_command_surface" : "documented_command_missing"
      },
      coevolve: {
        version: hook?.installed_version ?? null,
        source: hook?.wrapper_source ?? null,
        trust_status: hook?.trust_status ?? null
      }
    }
  };
}

function dispatcherSnapshot(evozeusHome) {
  const home = resolve(evozeusHome);
  const state = readJson(join(home, "hooks", "state.json"));
  const dispatcher = join(home, "hooks", "evozeus_wrapper_dispatcher.py");
  if (!state && !existsSync(dispatcher)) {
    return { status: "not_installed", managed: false, source: null };
  }
  const managed = state?.wrapper_source === "channel-managed" && existsSync(dispatcher)
    && readFileSync(dispatcher, "utf8").includes("evozeus.channel-coevolve-dispatcher.v2");
  return {
    status: managed ? "ready" : "legacy",
    managed,
    source: state?.wrapper_source ?? null,
    installed_version: state?.installed_version ?? null
  };
}

function autoUpdateSnapshot(evozeusHome, channel) {
  const home = resolve(evozeusHome);
  const policy = readJson(join(home, "update-policy.json"));
  const report = channel ? readJson(join(home, "state", channel, "auto-update-last.json")) : null;
  return {
    enabled: policy?.enabled !== false,
    check_interval_seconds: Number(policy?.check_interval_seconds ?? 3600),
    channels: {
      stable: policy?.channels?.stable !== false,
      uat: policy?.channels?.uat !== false
    },
    last_check: report
  };
}

export function channelSnapshot(evozeusHome) {
  const home = resolve(evozeusHome);
  const active = readActiveChannel(home);
  const state = readChannelState(home);
  if (!active) {
    const legacy = legacySnapshot(home);
    return {
      active_channel: null,
      status: legacy ? "legacy" : "not_installed",
      health: legacy?.migration_required ? "migration_required" : "missing",
      legacy,
      auto_update: autoUpdateSnapshot(home, null),
      channels: state.channels
    };
  }
  const entry = state.channels[active.channel];
  if (!entry) {
    return {
      active_channel: active.channel,
      status: "mixed",
      health: "channel_state_missing",
      auto_update: autoUpdateSnapshot(home, active.channel),
      channels: state.channels,
      components: {}
    };
  }
  if (
    !isObject(entry.manifest) ||
    entry.manifest.schema_version !== "evozeus.product-channel.v2" ||
    !isObject(entry.manifest.components) ||
    !isObject(entry.manifest.embedded)
  ) {
    return {
      active_channel: active.channel,
      auto_refresh: active.channel === "uat" && active.auto_refresh === true,
      status: "legacy",
      health: "migration_required",
      product_version: entry.manifest?.product_version ?? null,
      manifest_digest: entry.manifest_digest ?? null,
      manifest_source: entry.manifest_source ?? null,
      components: {},
      embedded: {},
      auto_update: autoUpdateSnapshot(home, active.channel),
      legacy: {
        migration_required: true,
        manifest_schema: entry.manifest?.schema_version ?? "unknown",
        issues: ["active channel uses the legacy product manifest and must be aligned to v2"]
      },
      channels: state.channels
    };
  }
  const manifestIssues = validateProductManifest(entry.manifest, active.channel);
  const manifestDigestValid = entry.manifest_digest === productManifestDigest(entry.manifest);
  if (manifestIssues.length > 0 || !manifestDigestValid) {
    return {
      active_channel: active.channel,
      auto_refresh: active.channel === "uat" && active.auto_refresh === true,
      status: "mixed",
      health: "state_unverifiable",
      product_version: entry.manifest.product_version ?? null,
      manifest_digest: entry.manifest_digest ?? null,
      manifest_source: entry.manifest_source ?? null,
      components: {},
      embedded: {},
      dispatcher: dispatcherSnapshot(home),
      integrity: {
        status: "unsafe",
        issues: [
          ...manifestIssues.map((issue) => `manifest:${issue}`),
          ...(!manifestDigestValid ? ["manifest:digest_mismatch"] : [])
        ]
      },
      auto_update: autoUpdateSnapshot(home, active.channel),
      channels: state.channels
    };
  }
  const components = Object.fromEntries(
    PRODUCT_COMPONENTS.map((componentId) => [
      componentId,
      inspectInstalledComponent(componentId, entry.component_roots?.[componentId], entry.manifest.components[componentId])
    ])
  );
  const coreRoot = entry.component_roots?.evozeus;
  const embedded = Object.fromEntries(
    EMBEDDED_COMPONENTS.map((componentId) => [
      componentId,
      inspectEmbeddedComponent(componentId, coreRoot, entry.manifest.embedded[componentId])
    ])
  );
  const dispatcher = dispatcherSnapshot(home);
  const invalid = [...Object.values(components), ...Object.values(embedded)]
    .some((component) => component.status !== "ready");
  const expectedDispatcherVersion = entry.manifest.components.coevolve.version;
  const dispatcherMissing = dispatcher.status === "not_installed";
  const legacyDispatcher = dispatcher.status === "legacy";
  const dispatcherVersionMismatch = dispatcher.status === "ready"
    && dispatcher.installed_version !== expectedDispatcherVersion;
  const invalidDispatcher = dispatcherMissing || legacyDispatcher || dispatcherVersionMismatch;
  const integrity = installedEntryIntegrity(home, entry, entry.manifest);
  const unsafeIntegrity = integrity.status === "unsafe";
  const invalidIntegrity = integrity.status === "repair_required";
  return {
    active_channel: active.channel,
    auto_refresh: active.channel === "uat" && active.auto_refresh === true,
    status: invalid || invalidDispatcher || invalidIntegrity || unsafeIntegrity ? "mixed" : "ready",
    health: unsafeIntegrity
      ? "state_unverifiable"
      : invalid
        ? "component_mismatch"
        : legacyDispatcher
          ? "legacy_dispatcher"
          : dispatcherMissing
            ? "dispatcher_missing"
            : dispatcherVersionMismatch
              ? "dispatcher_version_mismatch"
              : invalidIntegrity
                ? "channel_integrity_mismatch"
                : "healthy",
    product_version: entry.manifest.product_version,
    manifest_digest: entry.manifest_digest,
    manifest_source: entry.manifest_source,
    components,
    embedded,
    dispatcher,
    integrity,
    auto_update: autoUpdateSnapshot(home, active.channel),
    channels: state.channels
  };
}

export function resolveInstalledComponentRoot({ evozeusHome, componentId, sourceRoot, env = process.env }) {
  const active = readActiveChannel(evozeusHome);
  const state = readChannelState(evozeusHome);
  const entry = active ? state.channels[active.channel] : null;
  const installed = entry?.component_roots?.[componentId] ?? entry?.embedded_roots?.[componentId] ?? null;
  if (installed && existsSync(installed)) {
    return { root: resolve(installed), source: `channel:${active.channel}` };
  }
  const envName = COMPONENT_ENV[componentId];
  if (envName && env[envName]) {
    return { root: resolve(env[envName]), source: `env:${envName}` };
  }
  const sibling = COMPONENT_SIBLING[componentId];
  const embedded = EMBEDDED_FALLBACK[componentId];
  const fallback = embedded
    ? resolve(sourceRoot, embedded)
    : sibling
      ? resolve(dirname(sourceRoot), sibling)
      : null;
  return { root: fallback, source: "development_fallback" };
}

function backupLegacyState(evozeusHome) {
  const home = resolve(evozeusHome);
  const candidates = ["install-manifest.json", "hooks/state.json", "hooks/evozeus_wrapper_dispatcher.py"];
  const existing = candidates.filter((entry) => existsSync(join(home, entry)));
  if (existing.length === 0) {
    return null;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = privateDirectory(join(home, "backups", "channel-migrations", stamp));
  for (const entry of existing) {
    const source = join(home, entry);
    const destination = join(backup, entry);
    privateDirectory(dirname(destination));
    cpSync(source, destination, { recursive: true });
  }
  atomicWriteJson(join(backup, "restore.json"), {
    schema_version: "evozeus.channel-migration-backup.v1",
    created_at: new Date().toISOString(),
    files: existing,
    restore_command: `cp -R '${backup}/.' '${home}/'`
  });
  return backup;
}

function restoreLegacyState(evozeusHome, backup) {
  const descriptor = readJson(join(backup, "restore.json"));
  if (!descriptor || !Array.isArray(descriptor.files)) {
    throw new ChannelError("LEGACY_RESTORE_INVALID", `legacy backup descriptor is invalid: ${backup}`);
  }
  for (const entry of descriptor.files) {
    const source = join(backup, entry);
    const destination = join(resolve(evozeusHome), entry);
    privateDirectory(dirname(destination));
    cpSync(source, destination, { recursive: true });
  }
}

function channelDispatcherSource(entry) {
  const coreRoot = entry?.component_roots?.evozeus;
  if (typeof coreRoot !== "string" || absoluteDirectorySafety(coreRoot) !== "ready") {
    throw new ChannelError("DISPATCHER_SOURCE_INVALID", "installed Core root is missing or unsafe");
  }
  const source = join(coreRoot, "scripts", "evozeus-coevolve-dispatcher.py");
  if (containedPathSafety(coreRoot, source, "file") !== "ready") {
    throw new ChannelError("DISPATCHER_SOURCE_MISSING", `installed Core dispatcher is missing or unsafe: ${source}`);
  }
  return source;
}

function installChannelDispatcher(
  evozeusHome,
  channel,
  coevolveVersion,
  coreVersion,
  dispatcherSource,
  backupPath
) {
  const home = resolve(evozeusHome);
  const target = join(home, "hooks", "evozeus_wrapper_dispatcher.py");
  privateDirectory(dirname(target));
  const temporary = `${target}.${randomUUID()}.tmp`;
  const sourceBytes = readFileSync(dispatcherSource);
  const runtimeApi = sourceBytes.includes("evozeus.user-prompt.lesson-runtime.v1")
    ? "evozeus.user-prompt.lesson-runtime.v1"
    : null;
  writeFileSync(temporary, sourceBytes, { mode: 0o700 });
  renameSync(temporary, target);
  chmodSync(target, 0o700);
  atomicWriteJson(join(home, "hooks", "state.json"), {
    schema_version: 2,
    wrapper_source: "channel-managed",
    source_repository: "MetaInFLow/EvoZeus",
    installed_version: coevolveVersion,
    core_version: coreVersion,
    runtime_api: runtimeApi,
    active_channel_source: "active-channel.json",
    command: `/usr/bin/python3 "${target}"`,
    installation_status: "installed",
    trust_status: "verified_by_product_manifest",
    migration_backup: backupPath ? String(backupPath) : null,
    installed_at: new Date().toISOString()
  });
  return target;
}

export function reconcileChannelDispatcher(evozeusHome, channel) {
  const home = resolve(evozeusHome);
  const state = readChannelState(home);
  const entry = state.channels[channel];
  if (!entry) {
    throw new ChannelError("CHANNEL_NOT_INSTALLED", `${channel} is not installed`);
  }
  const expectedVersion = entry.manifest.components.coevolve.version;
  const expectedCoreVersion = entry.manifest.components.evozeus.version;
  const dispatcherSource = channelDispatcherSource(entry);
  const installedDispatcher = join(home, "hooks", "evozeus_wrapper_dispatcher.py");
  const installedNode = lstatEvidence(installedDispatcher);
  const contentMatches = installedNode.status === "ready"
    && installedNode.stats.isFile()
    && !installedNode.stats.isSymbolicLink()
    && readFileSync(installedDispatcher).equals(readFileSync(dispatcherSource));
  const before = dispatcherSnapshot(home);
  if (
    before.status === "ready"
    && before.installed_version === expectedVersion
    && contentMatches
  ) {
    return {
      status: "ready",
      repaired: false,
      backup_path: null,
      expected_version: expectedVersion,
      expected_core_version: expectedCoreVersion
    };
  }

  const dispatcherPath = join(home, "hooks", "evozeus_wrapper_dispatcher.py");
  const statePath = join(home, "hooks", "state.json");
  const dispatcherExisted = existsSync(dispatcherPath);
  const stateExisted = existsSync(statePath);
  const backupPath = backupLegacyState(home);
  try {
    installChannelDispatcher(
      home,
      channel,
      expectedVersion,
      expectedCoreVersion,
      dispatcherSource,
      backupPath
    );
  } catch (error) {
    if (backupPath) restoreLegacyState(home, backupPath);
    if (!dispatcherExisted) rmSync(dispatcherPath, { force: true });
    if (!stateExisted) rmSync(statePath, { force: true });
    throw error;
  }
  return {
    status: "repaired",
    repaired: true,
    backup_path: backupPath ? String(backupPath) : null,
    previous_status: before.status,
    previous_version: before.installed_version ?? null,
    expected_version: expectedVersion,
    expected_core_version: expectedCoreVersion
  };
}

function execChecked(command, args, options = {}) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options });
  } catch (error) {
    throw new ChannelError("COMMAND_FAILED", `${command} ${args.join(" ")} failed`, {
      stdout: error.stdout?.toString?.() ?? "",
      stderr: error.stderr?.toString?.() ?? ""
    });
  }
}

function mirrorPath(evozeusHome, componentId) {
  return join(resolve(evozeusHome), "cache", "git", `${componentId}.git`);
}

function installGitComponent({ evozeusHome, componentId, component, destination }) {
  const mirror = mirrorPath(evozeusHome, componentId);
  privateDirectory(dirname(mirror));
  if (!existsSync(mirror)) {
    execChecked("git", ["clone", "--mirror", component.source.url, mirror]);
  } else {
    execChecked("git", ["--git-dir", mirror, "fetch", "--prune", "origin"]);
  }
  execChecked("git", ["--git-dir", mirror, "cat-file", "-e", `${component.commit}^{commit}`]);
  execChecked("git", ["--git-dir", mirror, "worktree", "add", "--detach", destination, component.commit]);
  const actual = execChecked("git", ["-C", destination, "rev-parse", "HEAD"]).trim();
  if (actual !== component.commit) {
    throw new ChannelError("COMMIT_MISMATCH", `${componentId} checkout does not match the manifest commit`);
  }
  return { mirror, destination };
}

async function installReleaseComponent({ componentId, component, destination, fetchImpl }) {
  let bytes;
  if (component.source.url.startsWith("file://")) {
    bytes = readFileSync(new URL(component.source.url));
  } else {
    const response = await fetchImpl(component.source.url);
    if (!response.ok) {
      throw new ChannelError("ARCHIVE_FETCH_FAILED", `${componentId} archive fetch failed with HTTP ${response.status}`);
    }
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const expected = component.source.sha256.replace(/^sha256:/, "");
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new ChannelError("ARCHIVE_CHECKSUM_MISMATCH", `${componentId} archive checksum does not match`, {
      expected: component.source.sha256,
      actual: `sha256:${actual}`
    });
  }
  privateDirectory(destination);
  const archive = join(dirname(destination), `.${componentId}.${randomUUID()}.tar.gz`);
  writeFileSync(archive, bytes, { mode: 0o600 });
  try {
    execChecked("tar", ["-xzf", archive, "-C", destination, "--strip-components=1"]);
  } finally {
    rmSync(archive, { force: true });
  }
}

function validateRequiredPaths(componentId, component, destination) {
  const missing = component.required_paths.filter((entry) => !existsSync(join(destination, entry)));
  if (missing.length > 0) {
    throw new ChannelError("COMPONENT_INCOMPLETE", `${componentId} is missing required files`, { missing });
  }
}

function validateInstalledCompatibility(manifest, componentRoots) {
  const contractPath = join(componentRoots.coevolve, "contracts", "v1", "manifest.json");
  const contract = readJson(contractPath);
  if (!contract) {
    throw new ChannelError("COMPATIBILITY_METADATA_MISSING", `CoEvolve contract metadata is missing: ${contractPath}`);
  }
  if (contract.bundle_version !== manifest.compatibility.coevolve_contract) {
    throw new ChannelError("COEVOLVE_CONTRACT_MISMATCH", "CoEvolve contract version does not match the product manifest", {
      expected: manifest.compatibility.coevolve_contract,
      actual: contract.bundle_version ?? null
    });
  }
  const runtime = semverTuple(manifest.embedded.runtime.version);
  const contractMinimum = semverTuple(contract.runtime_compatibility?.min_inclusive);
  const contractMaximum = semverTuple(contract.runtime_compatibility?.max_exclusive);
  if (
    !runtime ||
    !contractMinimum ||
    !contractMaximum ||
    compareSemver(runtime, contractMinimum) < 0 ||
    compareSemver(runtime, contractMaximum) >= 0
  ) {
    throw new ChannelError("RUNTIME_CONTRACT_INCOMPATIBLE", "Runtime version is outside the installed CoEvolve contract range");
  }
}

export function fixedComponentSmoke(componentId, destination) {
  if (componentId === "evozeus") {
    execChecked("node", [join(destination, "scripts", "evozeus-cli.mjs"), "features", "--json"], {
      env: { ...process.env, EVOZEUS_HOME: join(destination, ".evozeus-smoke") }
    });
  } else if (componentId === "coevolve") {
    execChecked("python3", [join(destination, "scripts", "evozeus_wrapper.py"), "--help"], {
      cwd: destination,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }
    });
  }
  return { component: componentId, status: "passed" };
}

export function fixedEmbeddedSmoke(componentId, destination) {
  if (componentId === "runtime") {
    execChecked("python3", ["-m", "evozeus_runtime.cli.main", "status"], {
      cwd: destination,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONPATH: join(destination, "src") }
    });
  } else if (componentId === "session_signal") {
    const specs = componentSpecPaths(destination);
    execChecked("python3", [join(destination, "scripts", "validate_official_factor_spec.py"), ...specs], {
      cwd: destination,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", PYTHONPATH: join(destination, "src") }
    });
  }
  return { component: componentId, status: "passed" };
}

function componentSpecPaths(destination) {
  const factors = join(destination, "factors");
  if (!existsSync(factors)) return [];
  return readdirSync(factors, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(factors, entry.name, "spec.json"))
    .filter(existsSync);
}

function cleanupGitWorktrees(installedGit) {
  for (const entry of installedGit.reverse()) {
    if (existsSync(entry.mirror)) {
      spawnSync("git", ["--git-dir", entry.mirror, "worktree", "remove", "--force", entry.destination]);
      spawnSync("git", ["--git-dir", entry.mirror, "worktree", "prune"]);
    }
  }
}

function replaceSymlink(current, target) {
  privateDirectory(dirname(current));
  const temporary = join(dirname(current), `.${current.split(sep).at(-1)}.${randomUUID()}.tmp`);
  symlinkSync(relative(dirname(current), target), temporary, "dir");
  renameSync(temporary, current);
}

export function refreshChannelBootstrap(evozeusHome, coreRoot, { copyImpl = cpSync } = {}) {
  const targetDirectory = join(resolve(evozeusHome), "skeleton", "scripts");
  for (const file of CHANNEL_BOOTSTRAP_FILES) {
    const source = join(coreRoot, "scripts", file);
    if (!existsSync(source)) {
      throw new ChannelError("BOOTSTRAP_MISSING", `verified EvoZeus component is missing bootstrap file: scripts/${file}`);
    }
  }
  const parent = dirname(targetDirectory);
  if (creatableDirectorySafety(parent) !== "ready") {
    throw new ChannelError("BOOTSTRAP_TARGET_UNSAFE", "skeleton/scripts parent must not contain symlinks or non-directories");
  }
  privateDirectory(parent);
  const token = randomUUID();
  const stagedDirectory = join(parent, `.scripts.${token}.stage`);
  const previousDirectory = join(parent, `.scripts.${token}.previous`);
  const targetStats = lstatSafe(targetDirectory);
  if (targetStats && (targetStats.isSymbolicLink() || !targetStats.isDirectory())) {
    throw new ChannelError("BOOTSTRAP_TARGET_UNSAFE", "skeleton/scripts must be a real directory");
  }
  let previousMoved = false;
  let stagedMoved = false;
  try {
    if (targetStats) {
      cpSync(targetDirectory, stagedDirectory, { recursive: true });
    } else {
      privateDirectory(stagedDirectory);
    }
    chmodSync(stagedDirectory, 0o700);
    for (const file of CHANNEL_BOOTSTRAP_FILES) {
      const stagedTarget = join(stagedDirectory, file);
      rmSync(stagedTarget, { recursive: true, force: true });
      copyImpl(join(coreRoot, "scripts", file), stagedTarget);
    }
    if (targetStats) {
      renameSync(targetDirectory, previousDirectory);
      previousMoved = true;
    }
    renameSync(stagedDirectory, targetDirectory);
    stagedMoved = true;
    if (previousMoved) {
      try {
        rmSync(previousDirectory, { recursive: true, force: true });
      } catch {
        // A stale private backup is safer than failing a completed atomic switch.
      }
    }
  } catch (error) {
    let rollbackError = null;
    try {
      if (stagedMoved) rmSync(targetDirectory, { recursive: true, force: true });
      if (previousMoved && existsSync(previousDirectory)) renameSync(previousDirectory, targetDirectory);
      rmSync(stagedDirectory, { recursive: true, force: true });
    } catch (caughtRollbackError) {
      rollbackError = caughtRollbackError;
    }
    if (rollbackError) {
      throw new ChannelError("BOOTSTRAP_ROLLBACK_FAILED", "bootstrap refresh failed and the prior scripts could not be restored", {
        refresh_error: error.message,
        rollback_error: rollbackError.message
      });
    }
    throw error;
  }
}

function managedCliShimContentForCore(coreRoot) {
  const root = resolve(coreRoot);
  const channelsPath = join(root, "scripts", "evozeus-channels.mjs");
  if (containedPathSafety(root, channelsPath, "file") !== "ready") {
    throw new ChannelError("CLI_SHIM_TEMPLATE_UNAVAILABLE", "the target Core has no safe managed-shim generator");
  }
  const moduleUrl = pathToFileURL(realpathSync(channelsPath)).href;
  const script = [
    "const target = await import(process.argv[1]);",
    "if (typeof target.buildManagedCliShimContent !== 'function') process.exit(42);",
    "process.stdout.write(target.buildManagedCliShimContent());"
  ].join("\n");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script, moduleUrl], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status === 42) {
    return MANAGED_CLI_SHIM_V1;
  }
  if (result.status !== 0 || !result.stdout.startsWith("#!/bin/sh\n") || result.stdout.includes("\0")) {
    throw new ChannelError("CLI_SHIM_TEMPLATE_INVALID", "the target Core managed-shim generator is unavailable or invalid", {
      stderr: String(result.stderr || "").trim()
    });
  }
  return result.stdout;
}

function managedSurfacePaths(home) {
  return {
    roots: [join(home, "skeleton", "scripts"), join(home, "bin")],
    files: [
      ...CHANNEL_BOOTSTRAP_FILES.map((file) => join(home, "skeleton", "scripts", file)),
      join(home, "bin", "evozeus"),
      join(home, "bin", "evozeus-repair")
    ]
  };
}

function captureManagedSurface(evozeusHome) {
  const home = resolve(evozeusHome);
  const paths = managedSurfacePaths(home);
  const roots = paths.roots.map((path) => {
    const node = lstatEvidence(path);
    if (node.status === "unknown" || (node.status === "ready" && (node.stats.isSymbolicLink() || !node.stats.isDirectory()))) {
      throw new ChannelError("MANAGED_SURFACE_UNSAFE", `managed directory is unsafe: ${path}`);
    }
    return { path, existed: node.status === "ready", mode: node.status === "ready" ? node.stats.mode & 0o777 : null };
  });
  const files = paths.files.map((path) => {
    const node = lstatEvidence(path);
    if (node.status === "unknown" || (node.status === "ready" && (node.stats.isSymbolicLink() || !node.stats.isFile()))) {
      throw new ChannelError("MANAGED_SURFACE_UNSAFE", `managed file is unsafe: ${path}`);
    }
    return {
      path,
      existed: node.status === "ready",
      mode: node.status === "ready" ? node.stats.mode & 0o777 : null,
      bytes: node.status === "ready" ? readFileSync(path) : null
    };
  });
  return { roots, files };
}

function restoreManagedSurface(snapshot) {
  for (const file of snapshot.files) {
    if (!file.existed) {
      rmSync(file.path, { force: true });
      continue;
    }
    privateDirectory(dirname(file.path));
    const temporary = `${file.path}.${randomUUID()}.restore`;
    try {
      writeFileSync(temporary, file.bytes);
      chmodSync(temporary, file.mode);
      renameSync(temporary, file.path);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  }
  for (const root of snapshot.roots) {
    if (!root.existed) {
      rmSync(root.path, { recursive: true, force: true });
    } else {
      chmodSync(root.path, root.mode);
    }
  }
}

function reconcileCliShims(evozeusHome, coreRoot, { writeImpl = writeFileSync } = {}) {
  const home = resolve(evozeusHome);
  const binRoot = join(home, "bin");
  if (creatableDirectorySafety(binRoot) !== "ready") {
    throw new ChannelError("CLI_SHIM_TARGET_UNSAFE", "the CLI bin directory must not contain symlinks or non-directories");
  }
  const main = join(binRoot, "evozeus");
  const recovery = join(binRoot, "evozeus-repair");
  const mainNode = lstatEvidence(main);
  const recoveryNode = lstatEvidence(recovery);
  for (const [name, node] of [["primary", mainNode], ["recovery", recoveryNode]]) {
    if (node.status === "unknown" || (node.status === "ready" && (node.stats.isSymbolicLink() || !node.stats.isFile()))) {
      throw new ChannelError("CLI_SHIM_TARGET_UNSAFE", `${name} CLI shim must be a regular file`);
    }
  }
  if (mainNode.status === "missing" && recoveryNode.status === "missing") {
    return { status: "not_managed", repaired: false };
  }
  const canonical = Buffer.from(managedCliShimContentForCore(coreRoot), "utf8");
  privateDirectory(binRoot);
  const restored = [];
  for (const [name, target, node] of [["primary", main, mainNode], ["recovery", recovery, recoveryNode]]) {
    let requiresRepair = node.status === "missing" || (node.stats.mode & 0o111) === 0;
    if (node.status === "ready" && !requiresRepair) {
      try {
        requiresRepair = !readFileSync(target).equals(canonical);
      } catch {
        requiresRepair = true;
      }
    }
    if (!requiresRepair) continue;
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      writeImpl(temporary, canonical);
      chmodSync(temporary, 0o755);
      renameSync(temporary, target);
      restored.push(name);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
  }
  return restored.length > 0
    ? { status: "repaired", repaired: true, restored }
    : { status: "ready", repaired: false, restored: [] };
}

function currentLinkFor(evozeusHome, channel) {
  return channel === "stable"
    ? join(resolve(evozeusHome), "releases", "stable", "current")
    : join(resolve(evozeusHome), "worktrees", "uat", "current");
}

function installRootFor(evozeusHome, manifest, digest) {
  const suffix = digest.replace(/^sha256:/, "").slice(0, 16);
  return manifest.channel === "stable"
    ? join(resolve(evozeusHome), "releases", "stable", `${manifest.product_version}-${suffix}`)
    : join(resolve(evozeusHome), "worktrees", "uat", "versions", suffix);
}

function repairRootFor(evozeusHome, manifest, digest) {
  return `${installRootFor(evozeusHome, manifest, digest)}-repair-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function absoluteDirectorySafety(path) {
  if (typeof path !== "string" || !isAbsolute(path)) return "unsafe";
  const root = parse(path).root;
  let current = root;
  for (const segment of relative(root, path).split(sep).filter(Boolean)) {
    current = join(current, segment);
    const node = lstatEvidence(current);
    if (node.status !== "ready") return node.status === "missing" ? "missing" : "unsafe";
    if (node.stats.isSymbolicLink() || !node.stats.isDirectory()) return "unsafe";
  }
  return "ready";
}

function containedPathSafety(root, target, finalKind = "any") {
  if (typeof target !== "string" || !isAbsolute(target)) return "unsafe";
  const relativeTarget = relative(root, target);
  if (!relativeTarget || relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`) || isAbsolute(relativeTarget)) {
    return "unsafe";
  }
  let current = root;
  const segments = relativeTarget.split(sep).filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index]);
    const node = lstatEvidence(current);
    if (node.status !== "ready") return node.status === "missing" ? "missing" : "unsafe";
    const stats = node.stats;
    if (stats.isSymbolicLink()) return "unsafe";
    const final = index === segments.length - 1;
    if (!final && !stats.isDirectory()) return "unsafe";
    if (final && finalKind === "directory" && !stats.isDirectory()) return "unsafe";
    if (final && finalKind === "file" && !stats.isFile()) return "unsafe";
  }
  return "ready";
}

function installedEntryIntegrity(evozeusHome, entry, manifest, { historical = false } = {}) {
  if (!entry) return { status: "not_installed", issues: [] };
  const issues = [];
  const unsafe = [];
  const home = resolve(evozeusHome);
  const homeSafety = absoluteDirectorySafety(home);
  if (homeSafety !== "ready") unsafe.push(`evozeus_home:${homeSafety}`);
  if (!historical) {
    for (const [name, path, required] of [
      ["active_channel", join(home, "active-channel.json"), true],
      ["channel_state", join(home, "channel-state.json"), true],
      ["registration", join(home, "registration.json"), false]
    ]) {
      const safety = homeSafety === "ready" ? containedPathSafety(home, path, "file") : homeSafety;
      if (safety === "unsafe") unsafe.push(`${name}:unsafe`);
      if (required && safety === "missing") issues.push(`${name}:missing`);
    }
  }
  const installRootSafety = homeSafety === "ready"
    ? containedPathSafety(home, entry.install_root, "directory")
    : homeSafety;
  if (installRootSafety === "unsafe") unsafe.push("install_root:unsafe");
  if (installRootSafety === "missing") {
    issues.push("install_root_missing");
  }
  if (!historical) {
    const currentLink = currentLinkFor(home, manifest.channel);
    const currentParentSafety = containedPathSafety(home, dirname(currentLink), "directory");
    if (currentParentSafety === "unsafe") unsafe.push("current_link:unsafe_parent");
    if (currentParentSafety === "missing") issues.push("current_link:missing_parent");
    if (currentParentSafety === "ready") {
      const currentNode = lstatEvidence(currentLink);
      if (currentNode.status === "missing") {
        issues.push("current_link:missing");
      } else if (currentNode.status !== "ready" || !currentNode.stats.isSymbolicLink()) {
        unsafe.push("current_link:unsafe_node");
      } else {
        const target = linkTarget(currentLink);
        if (!target || resolve(target) !== resolve(entry.install_root)) {
          issues.push("current_link:target_mismatch");
        }
      }
    }
  }
  for (const componentId of PRODUCT_COMPONENTS) {
    const componentRoot = entry.component_roots?.[componentId];
    if (
      typeof componentRoot === "string" &&
      typeof entry.install_root === "string" &&
      resolve(componentRoot) !== resolve(join(entry.install_root, componentId))
    ) {
      issues.push(`component:${componentId}:root_mismatch`);
    }
    const rootSafety = installRootSafety === "ready"
      ? containedPathSafety(entry.install_root, componentRoot, "directory")
      : installRootSafety;
    if (rootSafety === "unsafe") {
      unsafe.push(`component:${componentId}:unsafe_root`);
      continue;
    }
    if (rootSafety === "missing") {
      issues.push(`component:${componentId}:missing_root`);
      continue;
    }
    for (const path of manifest.components[componentId].required_paths) {
      const pathSafety = containedPathSafety(componentRoot, join(componentRoot, path), "file");
      if (pathSafety === "unsafe") unsafe.push(`component:${componentId}:unsafe:${path}`);
      if (pathSafety === "missing") issues.push(`component:${componentId}:missing:${path}`);
    }
    const inspected = inspectInstalledComponent(
      componentId,
      componentRoot,
      manifest.components[componentId]
    );
    if (inspected.status !== "ready") {
      issues.push(`component:${componentId}:${inspected.status}`);
      if (inspected.commit_mismatch) issues.push(`component:${componentId}:commit_mismatch`);
    }
  }
  const coreRoot = entry.component_roots?.evozeus;
  for (const componentId of EMBEDDED_COMPONENTS) {
    const embedded = manifest.embedded[componentId];
    const embeddedRoot = coreRoot ? join(coreRoot, embedded.path) : null;
    const recordedEmbeddedRoot = entry.embedded_roots?.[componentId];
    if (typeof recordedEmbeddedRoot !== "string") {
      issues.push(`embedded:${componentId}:recorded_root_missing`);
    } else if (embeddedRoot && resolve(recordedEmbeddedRoot) !== resolve(embeddedRoot)) {
      issues.push(`embedded:${componentId}:root_mismatch`);
    }
    const rootSafety = coreRoot
      ? containedPathSafety(coreRoot, embeddedRoot, "directory")
      : "missing";
    if (rootSafety === "unsafe") {
      unsafe.push(`embedded:${componentId}:unsafe_root`);
      continue;
    }
    if (rootSafety === "ready") {
      for (const path of embedded.required_paths) {
        const pathSafety = containedPathSafety(embeddedRoot, join(embeddedRoot, path), "file");
        if (pathSafety === "unsafe") unsafe.push(`embedded:${componentId}:unsafe:${path}`);
        if (pathSafety === "missing") issues.push(`embedded:${componentId}:missing:${path}`);
      }
    }
    const inspected = inspectEmbeddedComponent(componentId, coreRoot, manifest.embedded[componentId]);
    if (inspected.status !== "ready") {
      issues.push(`embedded:${componentId}:${inspected.status}`);
    }
  }
  const active = historical ? null : readActiveChannel(home);
  if (!historical && active?.channel === manifest.channel) {
    const mainCli = join(home, "bin", "evozeus");
    const recoveryCli = join(home, "bin", "evozeus-repair");
    const mainCliSafety = homeSafety === "ready" ? containedPathSafety(home, mainCli, "file") : homeSafety;
    const recoveryCliSafety = homeSafety === "ready" ? containedPathSafety(home, recoveryCli, "file") : homeSafety;
    const cliManaged = mainCliSafety !== "missing" || recoveryCliSafety !== "missing";
    if (mainCliSafety === "unsafe") unsafe.push("cli:unsafe");
    if (recoveryCliSafety === "unsafe") unsafe.push("cli_recovery:unsafe");
    if (cliManaged) {
      if (mainCliSafety === "missing") issues.push("cli:missing");
      if (recoveryCliSafety === "missing") issues.push("cli_recovery:missing");
    }
    if (mainCliSafety === "ready" && (lstatSync(mainCli).mode & 0o111) === 0) {
      issues.push("cli:not_executable");
    }
    if (recoveryCliSafety === "ready" && (lstatSync(recoveryCli).mode & 0o111) === 0) {
      issues.push("cli_recovery:not_executable");
    }
    const canonicalCliShim = cliManaged && coreRoot
      ? Buffer.from(managedCliShimContentForCore(coreRoot), "utf8")
      : null;
    if (mainCliSafety === "ready" && canonicalCliShim) {
      try {
        if (!readFileSync(mainCli).equals(canonicalCliShim)) {
          issues.push("cli:content_mismatch");
        }
      } catch {
        unsafe.push("cli:unreadable");
      }
    }
    if (recoveryCliSafety === "ready" && canonicalCliShim) {
      try {
        if (!readFileSync(recoveryCli).equals(canonicalCliShim)) {
          issues.push("cli_recovery:content_mismatch");
        }
      } catch {
        unsafe.push("cli_recovery:unreadable");
      }
    }
    for (const file of CHANNEL_BOOTSTRAP_FILES) {
      const source = coreRoot ? join(coreRoot, "scripts", file) : null;
      const target = join(home, "skeleton", "scripts", file);
      const sourceSafety = coreRoot ? containedPathSafety(coreRoot, source, "file") : "missing";
      const targetSafety = homeSafety === "ready" ? containedPathSafety(home, target, "file") : homeSafety;
      if (sourceSafety === "unsafe") unsafe.push(`bootstrap_source:${file}:unsafe`);
      if (sourceSafety === "missing") issues.push(`bootstrap_source:${file}:missing`);
      if (targetSafety === "unsafe") unsafe.push(`bootstrap:${file}:unsafe`);
      if (targetSafety === "missing") issues.push(`bootstrap:${file}:missing`);
      if (sourceSafety === "ready" && targetSafety === "ready") {
        try {
          if (!readFileSync(source).equals(readFileSync(target))) {
            issues.push(`bootstrap:${file}:content_mismatch`);
          }
        } catch {
          unsafe.push(`bootstrap:${file}:unreadable`);
        }
      }
    }
    const hooksRoot = join(home, "hooks");
    const hooksSafety = containedPathSafety(home, hooksRoot, "directory");
    if (hooksSafety === "unsafe") unsafe.push("dispatcher:unsafe_hooks_root");
    if (hooksSafety === "missing") issues.push("dispatcher:missing_hooks_root");
    for (const [name, path] of [
      ["dispatcher", join(hooksRoot, "evozeus_wrapper_dispatcher.py")],
      ["dispatcher_state", join(hooksRoot, "state.json")]
    ]) {
      const safety = hooksSafety === "ready" ? containedPathSafety(hooksRoot, path, "file") : hooksSafety;
      if (safety === "unsafe") unsafe.push(`${name}:unsafe`);
      if (safety === "missing") issues.push(`${name}:missing`);
    }
    if (unsafe.length === 0) {
      const dispatcher = dispatcherSnapshot(home);
      if (dispatcher.status !== "ready") issues.push(`dispatcher:${dispatcher.status}`);
      if (dispatcher.installed_version !== manifest.components.coevolve.version) {
        issues.push("dispatcher:version_mismatch");
      }
      const dispatcherPath = join(hooksRoot, "evozeus_wrapper_dispatcher.py");
      const dispatcherSource = coreRoot
        ? join(coreRoot, "scripts", "evozeus-coevolve-dispatcher.py")
        : null;
      if (dispatcherSource && existsSync(dispatcherPath) && existsSync(dispatcherSource)) {
        try {
          if (!readFileSync(dispatcherPath).equals(readFileSync(dispatcherSource))) {
            issues.push("dispatcher:content_mismatch");
          }
        } catch {
          unsafe.push("dispatcher:unreadable");
        }
      }
    }
  }
  if (unsafe.length > 0) {
    return { status: "unsafe", issues: [...new Set(unsafe)] };
  }
  return {
    status: issues.length === 0 ? "healthy" : "repair_required",
    issues: [...new Set(issues)]
  };
}

function historicalEntrySafety(evozeusHome, entry) {
  if (!entry) return { status: "not_available", issues: [] };
  const home = resolve(evozeusHome);
  const unsafe = [];
  const homeSafety = absoluteDirectorySafety(home);
  if (homeSafety !== "ready") unsafe.push(`previous:evozeus_home:${homeSafety}`);
  const installRootSafety = homeSafety === "ready"
    ? containedPathSafety(home, entry.install_root, "directory")
    : homeSafety;
  if (installRootSafety === "unsafe") unsafe.push("previous:install_root:unsafe");
  for (const componentId of PRODUCT_COMPONENTS) {
    const rootSafety = installRootSafety === "ready"
      ? containedPathSafety(entry.install_root, entry.component_roots?.[componentId], "directory")
      : installRootSafety;
    if (rootSafety === "unsafe") unsafe.push(`previous:component:${componentId}:unsafe_root`);
  }
  const coreRoot = entry.component_roots?.evozeus;
  for (const componentId of EMBEDDED_COMPONENTS) {
    const rootSafety = coreRoot
      ? containedPathSafety(coreRoot, entry.embedded_roots?.[componentId], "directory")
      : "unsafe";
    if (rootSafety === "unsafe") unsafe.push(`previous:embedded:${componentId}:unsafe_root`);
  }
  return {
    status: unsafe.length === 0 ? "safe" : "unsafe",
    issues: [...new Set(unsafe)]
  };
}

function rollbackEntryIntegrity(
  evozeusHome,
  entry,
  manifest,
  { smokeRunner = fixedComponentSmoke, embeddedSmokeRunner = fixedEmbeddedSmoke } = {}
) {
  const structural = installedEntryIntegrity(evozeusHome, entry, manifest, { historical: true });
  if (structural.status !== "healthy") {
    return {
      status: structural.status === "unsafe" ? "unsafe" : "unhealthy",
      issues: structural.issues.map((issue) => `previous:${issue}`)
    };
  }
  const issues = [];
  try {
    validateInstalledCompatibility(manifest, entry.component_roots);
  } catch (error) {
    issues.push(`previous:compatibility:${error.code || "validation_failed"}`);
  }
  for (const componentId of PRODUCT_COMPONENTS) {
    try {
      smokeRunner(componentId, entry.component_roots[componentId]);
    } catch (error) {
      issues.push(`previous:component:${componentId}:smoke:${error.code || "failed"}`);
    }
  }
  for (const componentId of EMBEDDED_COMPONENTS) {
    try {
      embeddedSmokeRunner(componentId, entry.embedded_roots[componentId]);
    } catch (error) {
      issues.push(`previous:embedded:${componentId}:smoke:${error.code || "failed"}`);
    }
  }
  return {
    status: issues.length === 0 ? "healthy" : "unhealthy",
    issues: [...new Set(issues)]
  };
}

function creatableDirectorySafety(path) {
  if (typeof path !== "string" || !isAbsolute(path)) return "unsafe";
  const root = parse(path).root;
  let current = root;
  for (const segment of relative(root, path).split(sep).filter(Boolean)) {
    current = join(current, segment);
    const node = lstatEvidence(current);
    if (node.status === "missing") return "ready";
    if (node.status !== "ready" || node.stats.isSymbolicLink() || !node.stats.isDirectory()) {
      return "unsafe";
    }
  }
  return "ready";
}

function channelTransactionWriteRoots(evozeusHome, channel) {
  const home = resolve(evozeusHome);
  const channelRoots = channel === "stable"
    ? [["stable_channel", join(home, "releases", "stable")]]
    : [
        ["uat_channel", join(home, "worktrees", "uat", "versions")],
        ["uat_git_cache", join(home, "cache", "git")],
        ...PRODUCT_COMPONENTS.map((componentId) => [
          `uat_git_mirror:${componentId}`,
          join(home, "cache", "git", `${componentId}.git`)
        ])
      ];
  return [
    ...channelRoots,
    ["cli_bin", join(home, "bin")],
    ["skeleton_scripts", join(home, "skeleton", "scripts")],
    ["hooks", join(home, "hooks")],
    ["plugin_hosts", join(home, "hosts")],
    ["codex_marketplace", join(home, "hosts", "codex-marketplace")],
    ["codex_plugin", join(home, "hosts", "codex-marketplace", "plugins", "evozeus")],
    ["codex_marketplace_metadata", join(home, "hosts", "codex-marketplace", ".agents", "plugins")],
    ["claude_marketplace", join(home, "hosts", "claude-marketplace")],
    ["claude_plugin", join(home, "hosts", "claude-marketplace", "plugins", "evozeus")],
    ["claude_marketplace_metadata", join(home, "hosts", "claude-marketplace", ".claude-plugin")],
    ["channel_runtime_state", join(home, "state", channel)],
    ["channel_migration_backups", join(home, "backups", "channel-migrations")]
  ];
}

function transactionDestinationIssues(evozeusHome, channel) {
  const home = resolve(evozeusHome);
  const issues = [];
  for (const [name, path] of channelTransactionWriteRoots(home, channel)) {
    if (creatableDirectorySafety(path) !== "ready") issues.push(`write_root:${name}:unsafe`);
  }
  for (const [name, path] of [
    ["cli", join(home, "bin", "evozeus")],
    ["cli_recovery", join(home, "bin", "evozeus-repair")],
    ["channel_state", join(home, "channel-state.json")],
    ["active_channel", join(home, "active-channel.json")],
    ["install_manifest", join(home, "install-manifest.json")],
    ["dispatcher", join(home, "hooks", "evozeus_wrapper_dispatcher.py")],
    ["dispatcher_state", join(home, "hooks", "state.json")],
    ["plugin_state", join(home, "hosts", "plugin-state.json")],
    ["codex_marketplace_manifest", join(home, "hosts", "codex-marketplace", ".agents", "plugins", "marketplace.json")],
    ["claude_marketplace_manifest", join(home, "hosts", "claude-marketplace", ".claude-plugin", "marketplace.json")]
  ]) {
    const node = lstatEvidence(path);
    if (node.status === "unknown" || (node.status === "ready" && (node.stats.isSymbolicLink() || !node.stats.isFile()))) {
      issues.push(`write_file:${name}:unsafe`);
    }
  }
  return issues;
}

function controlDocument(path, validator) {
  const node = lstatEvidence(path);
  if (node.status === "missing") return { status: "missing", value: null };
  if (node.status !== "ready") return { status: "unsafe", value: null };
  const stats = node.stats;
  if (stats.isSymbolicLink() || !stats.isFile()) return { status: "unsafe", value: null };
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    return validator(value)
      ? { status: "valid", value }
      : { status: "invalid", value: null };
  } catch {
    return { status: "invalid", value: null };
  }
}

function inspectControlDocuments(evozeusHome) {
  const home = resolve(evozeusHome);
  const homeSafety = absoluteDirectorySafety(home);
  const channelState = controlDocument(join(home, "channel-state.json"), (value) => (
    isObject(value)
    && value.schema_version === "evozeus.channel-state.v1"
    && isObject(value.channels)
  ));
  const active = controlDocument(join(home, "active-channel.json"), (value) => (
    isObject(value)
    && value.schema_version === "evozeus.active-channel.v1"
    && CHANNELS.includes(value.channel)
  ));
  const issues = [];
  if (homeSafety === "unsafe") issues.push("evozeus_home:unsafe");
  if (["invalid", "unsafe"].includes(channelState.status)) {
    issues.push(`channel_state:${channelState.status}`);
  }
  if (["invalid", "unsafe"].includes(active.status)) {
    issues.push(`active_channel:${active.status}`);
  }
  if (active.status === "valid" && channelState.status === "missing") {
    issues.push("channel_state:missing_with_active_channel");
  }
  return { homeSafety, channelState, active, issues };
}

function channelPlanDecision({ installed, currentEvidenceValid, legacyMigration, sameManifest, currentIntegrity, activeChannel, channel }) {
  if (legacyMigration) return "migrate";
  if (!currentEvidenceValid || currentIntegrity.status === "unsafe") return "unsafe_stop";
  if (activeChannel === channel && !installed) return "repair";
  if (!installed) return "install";
  if (!sameManifest) return "update";
  if (currentIntegrity.status !== "healthy") return "repair";
  return activeChannel === channel ? "healthy_noop" : "activate";
}

function linkTarget(current) {
  if (!existsSync(current) && !lstatSafe(current)?.isSymbolicLink()) return null;
  try {
    return resolve(dirname(current), readlinkSync(current));
  } catch {
    return null;
  }
}

function lstatSafe(path) {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

function lstatEvidence(path) {
  try {
    return { status: "ready", stats: lstatSync(path) };
  } catch (error) {
    return error?.code === "ENOENT"
      ? { status: "missing", stats: null }
      : { status: "unknown", stats: null };
  }
}

export function activateInstalledChannel(evozeusHome, channel, autoRefresh = false) {
  if (!CHANNELS.includes(channel)) {
    throw new ChannelError("INVALID_CHANNEL", "channel must be stable or uat");
  }
  const state = readChannelState(evozeusHome);
  if (!state.channels[channel]) {
    throw new ChannelError("CHANNEL_NOT_INSTALLED", `${channel} is not installed`);
  }
  const home = resolve(evozeusHome);
  const destinationIssues = transactionDestinationIssues(home, channel);
  if (destinationIssues.length > 0) {
    throw new ChannelError("LOCAL_STATE_UNSAFE", "channel activation write destinations are unsafe", {
      issues: destinationIssues
    });
  }
  const activeBefore = readActiveChannel(home);
  const activePath = join(home, "active-channel.json");
  privateDirectory(join(home, "state", channel));
  const active = {
    schema_version: "evozeus.active-channel.v1",
    channel,
    auto_refresh: channel === "uat" && autoRefresh === true,
    activated_at: new Date().toISOString()
  };
  atomicWriteJson(activePath, active);
  try {
    const dispatcherReconciliation = reconcileChannelDispatcher(home, channel);
    return { ...active, dispatcher_reconciliation: dispatcherReconciliation };
  } catch (error) {
    if (activeBefore) atomicWriteJson(activePath, activeBefore);
    else rmSync(activePath, { force: true });
    throw error;
  }
}

export function activateInstalledProductChannel(
  evozeusHome,
  channel,
  autoRefresh = false,
  { bootstrapCopy = cpSync, shimWrite = writeFileSync } = {}
) {
  const home = resolve(evozeusHome);
  const state = readChannelState(home);
  const entry = state.channels[channel];
  if (!entry?.component_roots?.evozeus) {
    throw new ChannelError("CHANNEL_NOT_INSTALLED", `${channel} is not installed`);
  }
  const activeBefore = readActiveChannel(home);
  const managedSurfaceBefore = captureManagedSurface(home);
  try {
    const active = activateInstalledChannel(home, channel, autoRefresh);
    refreshChannelBootstrap(home, entry.component_roots.evozeus, { copyImpl: bootstrapCopy });
    const cliReconciliation = reconcileCliShims(home, entry.component_roots.evozeus, {
      writeImpl: shimWrite
    });
    return { ...active, cli_reconciliation: cliReconciliation };
  } catch (error) {
    let restorationError = null;
    try {
      const priorEntry = activeBefore?.channel ? state.channels[activeBefore.channel] : null;
      if (!activeBefore?.channel || !priorEntry) {
        throw new Error("no prior active channel is available for recovery");
      }
      activateInstalledChannel(home, activeBefore.channel, activeBefore.auto_refresh === true);
      atomicWriteJson(join(home, "active-channel.json"), activeBefore);
      restoreManagedSurface(managedSurfaceBefore);
    } catch (caughtRestorationError) {
      restorationError = caughtRestorationError;
    }
    if (restorationError) {
      throw new ChannelError(
        "ACTIVATION_ROLLBACK_FAILED",
        "channel activation failed and the prior managed surface could not be restored",
        { activation_error: error.message, rollback_error: restorationError.message }
      );
    }
    throw error;
  }
}

export async function prepareChannelUpdate({
  evozeusHome,
  channel,
  manifestSource,
  fetchImpl = globalThis.fetch
}) {
  const source = manifestSource || DEFAULT_MANIFEST_SOURCES[channel];
  if (!CHANNELS.includes(channel)) {
    throw new ChannelError("INVALID_CHANNEL", "channel must be stable or uat");
  }
  const control = inspectControlDocuments(evozeusHome);
  const writeDestinationIssues = transactionDestinationIssues(evozeusHome, channel);
  const localSafetyIssues = [...control.issues, ...writeDestinationIssues];
  const state = control.channelState.status === "valid"
    ? readChannelState(evozeusHome)
    : defaultChannelState();
  const active = control.active.status === "valid" ? control.active.value : null;
  const current = state.channels[channel];
  const installed = Boolean(current);
  if (localSafetyIssues.length > 0) {
    return {
      channel,
      manifest: null,
      manifest_source: source,
      manifest_digest: null,
      installed,
      current_product_version: current?.manifest?.product_version ?? null,
      current_manifest_digest: current?.manifest_digest ?? null,
      target_product_version: null,
      decision: "unsafe_stop",
      healthy_current: false,
      activation_required: false,
      migration_required: false,
      repair_required: false,
      update_available: false,
      install_required: false,
      unsafe_state: true,
      current_integrity: { status: "unsafe", issues: localSafetyIssues },
      writes_now: false
    };
  }
  const manifest = await loadProductManifest(source, channel, fetchImpl);
  const digest = productManifestDigest(manifest);
  const legacyMigration = Boolean(
    installed &&
    active?.channel === channel &&
    isObject(current.manifest) &&
    current.manifest.schema_version === "evozeus.product-channel.v1" &&
    current.manifest.channel === channel &&
    /^v\d+\.\d+\.\d+$/.test(current.manifest.product_version || "")
  );
  const currentManifestIssues = installed && !legacyMigration
    ? validateProductManifest(current.manifest, channel)
    : [];
  const currentEvidenceValid = !installed || legacyMigration || (
    currentManifestIssues.length === 0
    && current.manifest_digest === productManifestDigest(current.manifest)
  );
  const sameManifest = currentEvidenceValid && !legacyMigration && installed && current.manifest_digest === digest;
  const installedIntegrity = currentEvidenceValid && !legacyMigration && installed
    ? installedEntryIntegrity(evozeusHome, current, current.manifest)
    : null;
  const previousSafety = currentEvidenceValid && !legacyMigration && installed
    ? historicalEntrySafety(evozeusHome, current.previous)
    : { status: "not_available", issues: [] };
  const unsafeIssues = [
    ...(installedIntegrity?.status === "unsafe" ? installedIntegrity.issues : []),
    ...(previousSafety.status === "unsafe" ? previousSafety.issues : [])
  ];
  const currentIntegrity = legacyMigration
    ? {
        status: "migration_required",
        issues: ["installed_manifest:evozeus.product-channel.v1"]
      }
    : !currentEvidenceValid
    ? {
        status: "unsafe",
        issues: [
          "installed_manifest_evidence_mismatch",
          ...currentManifestIssues.map((issue) => `installed_manifest:${issue}`)
        ]
      }
    : unsafeIssues.length > 0
      ? { status: "unsafe", issues: unsafeIssues }
    : sameManifest
      ? installedIntegrity
      : {
          status: installed ? "superseded" : "not_installed",
          issues: installedIntegrity?.issues ?? []
        };
  const decision = channelPlanDecision({
    installed,
    currentEvidenceValid,
    legacyMigration,
    sameManifest,
    currentIntegrity,
    activeChannel: active?.channel,
    channel
  });
  return {
    channel,
    manifest,
    manifest_source: source,
    manifest_digest: digest,
    installed,
    current_product_version: current?.manifest?.product_version ?? null,
    current_manifest_digest: current?.manifest_digest ?? null,
    target_product_version: manifest.product_version,
    decision,
    healthy_current: decision === "healthy_noop",
    activation_required: decision === "activate",
    migration_required: decision === "migrate",
    repair_required: decision === "repair",
    update_available: decision === "update",
    install_required: decision === "install",
    unsafe_state: decision === "unsafe_stop",
    current_integrity: currentIntegrity,
    writes_now: false
  };
}

export async function applyChannelUpdate({
  evozeusHome,
  channel,
  manifestSource,
  autoRefresh = false,
  fetchImpl = globalThis.fetch,
  smokeRunner = fixedComponentSmoke,
  embeddedSmokeRunner = fixedEmbeddedSmoke,
  bootstrapCopy = cpSync,
  shimWrite = writeFileSync
}) {
  const home = resolve(evozeusHome);
  const plan = await prepareChannelUpdate({ evozeusHome: home, channel, manifestSource, fetchImpl });
  const stateBefore = readChannelState(home);
  const stateFileExisted = existsSync(join(home, "channel-state.json"));
  const activeBefore = readActiveChannel(home);
  const existing = stateBefore.channels[channel];
  if (plan.decision === "unsafe_stop") {
    throw new ChannelError("LOCAL_STATE_UNSAFE", "installed channel state is unsafe or unverifiable", {
      issues: plan.current_integrity.issues
    });
  }
  if (plan.decision === "healthy_noop" && existing?.install_root && existsSync(existing.install_root)) {
    return {
      status: "already_current",
      ...plan,
      writes_now: false,
      install_root: existing.install_root,
      active: readActiveChannel(home)
    };
  }
  const managedSurfaceBefore = captureManagedSurface(home);
  if (plan.decision === "activate" && existing?.install_root && existsSync(existing.install_root)) {
    let active;
    try {
      active = activateInstalledChannel(home, channel, autoRefresh);
      refreshChannelBootstrap(home, existing.component_roots.evozeus, { copyImpl: bootstrapCopy });
      reconcileCliShims(home, existing.component_roots.evozeus, { writeImpl: shimWrite });
    } catch (error) {
      let rollbackError = null;
      try {
        const priorEntry = activeBefore?.channel ? stateBefore.channels[activeBefore.channel] : null;
        if (!activeBefore?.channel || !priorEntry?.component_roots?.evozeus) {
          throw new Error("no prior active channel is available for recovery");
        }
        activateInstalledChannel(home, activeBefore.channel, activeBefore.auto_refresh === true);
        atomicWriteJson(join(home, "active-channel.json"), activeBefore);
        restoreManagedSurface(managedSurfaceBefore);
      } catch (caughtRollbackError) {
        rollbackError = caughtRollbackError;
      }
      if (rollbackError) {
        throw new ChannelError(
          "ACTIVATION_ROLLBACK_FAILED",
          "channel activation failed and the prior active channel could not be restored",
          {
            activation_error: error.message,
            rollback_error: rollbackError.message,
            recovery: activeBefore?.channel ?? null
          }
        );
      }
      throw error;
    }
    return {
      status: "activated",
      ...plan,
      writes_now: true,
      install_root: existing.install_root,
      active
    };
  }

  const repairing = plan.decision === "repair";
  const migrating = plan.decision === "migrate";
  const installRoot = repairing
    ? repairRootFor(home, plan.manifest, plan.manifest_digest)
    : installRootFor(home, plan.manifest, plan.manifest_digest);
  const knownReusableRoot = [existing?.install_root, existing?.previous?.install_root]
    .filter(Boolean)
    .map((path) => resolve(path))
    .includes(resolve(installRoot));
  const referencedRoots = Object.values(stateBefore.channels)
    .flatMap((entry) => [entry?.install_root, entry?.previous?.install_root])
    .filter(Boolean)
    .map((path) => resolve(path));
  const recoveredInterruptedInstall = !repairing
    && existsSync(installRoot)
    && !referencedRoots.includes(resolve(installRoot));
  if (recoveredInterruptedInstall) {
    rmSync(installRoot, { recursive: true, force: true });
  }
  const reuseExistingRoot = existsSync(installRoot) && knownReusableRoot;
  if (existsSync(installRoot) && !reuseExistingRoot) {
    throw new ChannelError("INSTALL_ROOT_CONFLICT", `target install root already exists: ${installRoot}`);
  }
  if (!reuseExistingRoot) privateDirectory(installRoot);
  const installedGit = [];
  const componentRoots = {};
  const embeddedRoots = {};
  let backupPath = null;
  let linkSwitched = false;
  let stateWritten = false;
  let hookMigrationStarted = false;
  const currentLink = currentLinkFor(home, channel);
  const previousLink = linkTarget(currentLink);

  try {
    for (const componentId of PRODUCT_COMPONENTS) {
      const component = plan.manifest.components[componentId];
      const destination = join(installRoot, componentId);
      if (reuseExistingRoot && plan.manifest.channel === "uat") {
        const actual = execChecked("git", ["-C", destination, "rev-parse", "HEAD"]).trim();
        if (actual !== component.commit) {
          throw new ChannelError("COMMIT_MISMATCH", `${componentId} reusable checkout does not match the manifest commit`);
        }
        const changes = execChecked("git", ["-C", destination, "status", "--porcelain"]).trim();
        if (changes) {
          throw new ChannelError("REUSABLE_ROOT_DIRTY", `${componentId} reusable checkout contains local changes`);
        }
      } else if (plan.manifest.channel === "uat") {
        installedGit.push(installGitComponent({ evozeusHome: home, componentId, component, destination }));
      } else if (!reuseExistingRoot) {
        await installReleaseComponent({ componentId, component, destination, fetchImpl });
      }
      validateRequiredPaths(componentId, component, destination);
      smokeRunner(componentId, destination);
      componentRoots[componentId] = realpathSync(destination);
    }
    const coreRoot = componentRoots.evozeus;
    for (const componentId of EMBEDDED_COMPONENTS) {
      const embedded = plan.manifest.embedded[componentId];
      const destination = join(coreRoot, embedded.path);
      validateRequiredPaths(componentId, embedded, destination);
      embeddedSmokeRunner(componentId, destination);
      embeddedRoots[componentId] = realpathSync(destination);
    }
    validateInstalledCompatibility(plan.manifest, componentRoots);

    replaceSymlink(currentLink, installRoot);
    linkSwitched = true;
    const now = new Date().toISOString();
    const nextEntry = {
      manifest: plan.manifest,
      manifest_source: plan.manifest_source,
      manifest_digest: plan.manifest_digest,
      install_root: installRoot,
      component_roots: componentRoots,
      embedded_roots: embeddedRoots,
      installed_at: now,
      previous: existing && !migrating ? { ...existing, previous: null } : null,
      migration_backup: backupPath ? String(backupPath) : null
    };
    const nextState = {
      ...stateBefore,
      channels: { ...stateBefore.channels, [channel]: nextEntry },
      last_transaction: {
        status: "succeeded",
        decision: plan.decision,
        channel,
        manifest_digest: plan.manifest_digest,
        completed_at: now
      }
    };
    atomicWriteJson(join(home, "channel-state.json"), nextState);
    stateWritten = true;
    const active = activateInstalledChannel(home, channel, autoRefresh);
    backupPath = active.dispatcher_reconciliation?.backup_path ?? null;
    hookMigrationStarted = active.dispatcher_reconciliation?.repaired === true;
    if (backupPath) {
      nextEntry.migration_backup = backupPath;
      atomicWriteJson(join(home, "channel-state.json"), nextState);
    }
    refreshChannelBootstrap(home, coreRoot, { copyImpl: bootstrapCopy });
    reconcileCliShims(home, coreRoot, { writeImpl: shimWrite });
    return {
      status: migrating ? "migrated" : repairing ? "repaired" : reuseExistingRoot ? "reused_verified" : "installed",
      ...plan,
      writes_now: true,
      install_root: installRoot,
      recovered_interrupted_install: recoveredInterruptedInstall,
      component_roots: componentRoots,
      embedded_roots: embeddedRoots,
      migration_backup: backupPath ? String(backupPath) : null,
      active,
      rollback: existing?.install_root && !migrating
        ? { channel, install_root: existing.install_root, manifest_digest: existing.manifest_digest }
        : null
    };
  } catch (error) {
    let rollbackError = null;
    try {
      if (stateWritten) {
        if (stateFileExisted) atomicWriteJson(join(home, "channel-state.json"), stateBefore);
        else rmSync(join(home, "channel-state.json"), { force: true });
      }
      if (stateWritten) {
        if (activeBefore) atomicWriteJson(join(home, "active-channel.json"), activeBefore);
        else rmSync(join(home, "active-channel.json"), { force: true });
      }
      if (linkSwitched) {
        if (previousLink) replaceSymlink(currentLink, previousLink);
        else rmSync(currentLink, { force: true });
      }
      if (hookMigrationStarted && backupPath) restoreLegacyState(home, backupPath);
      restoreManagedSurface(managedSurfaceBefore);
    } catch (caughtRollbackError) {
      rollbackError = caughtRollbackError;
    }
    cleanupGitWorktrees(installedGit);
    if (!reuseExistingRoot) rmSync(installRoot, { recursive: true, force: true });
    if (rollbackError) {
      throw new ChannelError("UPDATE_ROLLBACK_FAILED", "channel update failed and automatic rollback could not be completed", {
        update_error: error.message,
        rollback_error: rollbackError.message,
        recovery: stateBefore.channels[channel]?.install_root ?? null
      });
    }
    throw error;
  }
}

export function rollbackChannel(
  evozeusHome,
  channel,
  {
    bootstrapCopy = cpSync,
    shimWrite = writeFileSync,
    smokeRunner = fixedComponentSmoke,
    embeddedSmokeRunner = fixedEmbeddedSmoke
  } = {}
) {
  const home = resolve(evozeusHome);
  if (!CHANNELS.includes(channel)) {
    throw new ChannelError("INVALID_CHANNEL", "channel must be stable or uat");
  }
  const destinationIssues = transactionDestinationIssues(home, channel);
  if (destinationIssues.length > 0) {
    throw new ChannelError("LOCAL_STATE_UNSAFE", "channel rollback write destinations are unsafe", {
      issues: destinationIssues
    });
  }
  const state = readChannelState(home);
  const current = state.channels[channel];
  const previous = current?.previous;
  if (!previous?.install_root || !existsSync(previous.install_root)) {
    throw new ChannelError("ROLLBACK_NOT_AVAILABLE", `no verified ${channel} rollback is available`);
  }
  const previousIssues = validateProductManifest(previous.manifest, channel);
  const previousDigestMatches = previousIssues.length === 0
    && previous.manifest_digest === productManifestDigest(previous.manifest);
  if (previousIssues.length > 0 || !previousDigestMatches) {
    throw new ChannelError("ROLLBACK_STATE_UNSAFE", `the previous ${channel} rollback is unsafe or unverifiable`, {
      issues: [
        ...previousIssues.map((issue) => `previous_manifest:${issue}`),
        ...(!previousDigestMatches ? ["previous_manifest_digest_mismatch"] : [])
      ]
    });
  }
  const previousIntegrity = rollbackEntryIntegrity(home, previous, previous.manifest, {
    smokeRunner,
    embeddedSmokeRunner
  });
  if (previousIntegrity.status !== "healthy") {
    const unsafe = previousIntegrity.status === "unsafe";
    throw new ChannelError(
      unsafe ? "ROLLBACK_STATE_UNSAFE" : "ROLLBACK_STATE_UNHEALTHY",
      `the previous ${channel} rollback is ${unsafe ? "unsafe or unverifiable" : "not healthy enough to activate"}`,
      { issues: previousIntegrity.issues }
    );
  }
  const currentLink = currentLinkFor(home, channel);
  const linkBefore = linkTarget(currentLink);
  const activeBefore = readActiveChannel(home);
  const managedSurfaceBefore = captureManagedSurface(home);
  const restored = {
    ...previous,
    previous: { ...current, previous: null },
    rolled_back_at: new Date().toISOString()
  };
  const nextState = {
    ...state,
    channels: { ...state.channels, [channel]: restored },
    last_transaction: {
      status: "rolled_back",
      channel,
      manifest_digest: restored.manifest_digest,
      completed_at: new Date().toISOString()
    }
  };
  try {
    replaceSymlink(currentLink, previous.install_root);
    atomicWriteJson(join(home, "channel-state.json"), nextState);
    const active = activateInstalledChannel(
      home,
      channel,
      activeBefore?.channel === channel && activeBefore.auto_refresh === true
    );
    refreshChannelBootstrap(home, previous.component_roots.evozeus, { copyImpl: bootstrapCopy });
    reconcileCliShims(home, previous.component_roots.evozeus, { writeImpl: shimWrite });
    return {
      status: "rolled_back",
      channel,
      product_version: restored.manifest?.product_version ?? null,
      manifest_digest: restored.manifest_digest,
      install_root: restored.install_root,
      active
    };
  } catch (error) {
    let restorationError = null;
    try {
      if (linkBefore) replaceSymlink(currentLink, linkBefore);
      else rmSync(currentLink, { force: true });
      atomicWriteJson(join(home, "channel-state.json"), state);
      if (activeBefore) {
        activateInstalledChannel(home, activeBefore.channel, activeBefore.auto_refresh === true);
        atomicWriteJson(join(home, "active-channel.json"), activeBefore);
      } else {
        rmSync(join(home, "active-channel.json"), { force: true });
      }
      restoreManagedSurface(managedSurfaceBefore);
    } catch (caughtRestorationError) {
      restorationError = caughtRestorationError;
    }
    if (restorationError) {
      throw new ChannelError("ROLLBACK_TRANSACTION_FAILED", "channel rollback failed and the prior active transaction could not be restored", {
        rollback_error: error.message,
        restoration_error: restorationError.message,
        recovery: current?.install_root ?? null
      });
    }
    throw error;
  }
}
