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
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PRODUCT_COMPONENTS = ["evozeus", "coevolve"];
export const EMBEDDED_COMPONENTS = ["runtime", "session_signal"];
export const CHANNELS = ["stable", "uat"];
export const DEFAULT_MANIFEST_SOURCES = {
  stable:
    "https://github.com/MetaInFLow/EvoZeus/releases/latest/download/evozeus-product-stable.json",
  uat: "https://raw.githubusercontent.com/MetaInFLow/EvoZeus/uat/current/channels/uat.json"
};

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
  return {
    active_channel: active.channel,
    auto_refresh: active.channel === "uat" && active.auto_refresh === true,
    status: invalid || invalidDispatcher ? "mixed" : "ready",
    health: invalid
      ? "component_mismatch"
      : legacyDispatcher
        ? "legacy_dispatcher"
        : dispatcherMissing
          ? "dispatcher_missing"
          : dispatcherVersionMismatch
            ? "dispatcher_version_mismatch"
            : "healthy",
    product_version: entry.manifest.product_version,
    manifest_digest: entry.manifest_digest,
    manifest_source: entry.manifest_source,
    components,
    embedded,
    dispatcher,
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

function installChannelDispatcher(evozeusHome, channel, coevolveVersion, backupPath) {
  if (!existsSync(CHANNEL_DISPATCHER)) {
    throw new ChannelError("DISPATCHER_SOURCE_MISSING", `channel dispatcher source is missing: ${CHANNEL_DISPATCHER}`);
  }
  const home = resolve(evozeusHome);
  const target = join(home, "hooks", "evozeus_wrapper_dispatcher.py");
  privateDirectory(dirname(target));
  const temporary = `${target}.${randomUUID()}.tmp`;
  writeFileSync(temporary, readFileSync(CHANNEL_DISPATCHER), { mode: 0o700 });
  renameSync(temporary, target);
  chmodSync(target, 0o700);
  atomicWriteJson(join(home, "hooks", "state.json"), {
    schema_version: 2,
    wrapper_source: "channel-managed",
    source_repository: "MetaInFLow/EvoZeus-CoEvolve",
    installed_version: coevolveVersion,
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
  const before = dispatcherSnapshot(home);
  if (before.status === "ready" && before.installed_version === expectedVersion) {
    return { status: "ready", repaired: false, backup_path: null, expected_version: expectedVersion };
  }

  const dispatcherPath = join(home, "hooks", "evozeus_wrapper_dispatcher.py");
  const statePath = join(home, "hooks", "state.json");
  const dispatcherExisted = existsSync(dispatcherPath);
  const stateExisted = existsSync(statePath);
  const backupPath = backupLegacyState(home);
  try {
    installChannelDispatcher(home, channel, expectedVersion, backupPath);
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
    expected_version: expectedVersion
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
    execChecked("node", [join(destination, "scripts", "evozeus-cli.mjs"), "features", "--json"]);
  } else if (componentId === "coevolve") {
    execChecked("python3", [join(destination, "scripts", "evozeus_wrapper.py"), "--help"], {
      cwd: destination
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

function refreshChannelBootstrap(evozeusHome, coreRoot) {
  const targetDirectory = privateDirectory(join(resolve(evozeusHome), "skeleton", "scripts"));
  for (const file of CHANNEL_BOOTSTRAP_FILES) {
    const source = join(coreRoot, "scripts", file);
    if (!existsSync(source)) {
      throw new ChannelError("BOOTSTRAP_MISSING", `verified EvoZeus component is missing bootstrap file: scripts/${file}`);
    }
    const target = join(targetDirectory, file);
    const temporary = join(targetDirectory, `.${file}.${randomUUID()}.tmp`);
    cpSync(source, temporary);
    renameSync(temporary, target);
  }
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

export function activateInstalledChannel(evozeusHome, channel, autoRefresh = false) {
  if (!CHANNELS.includes(channel)) {
    throw new ChannelError("INVALID_CHANNEL", "channel must be stable or uat");
  }
  const state = readChannelState(evozeusHome);
  if (!state.channels[channel]) {
    throw new ChannelError("CHANNEL_NOT_INSTALLED", `${channel} is not installed`);
  }
  const home = resolve(evozeusHome);
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
  const manifest = await loadProductManifest(source, channel, fetchImpl);
  const digest = productManifestDigest(manifest);
  const state = readChannelState(evozeusHome);
  const current = state.channels[channel];
  return {
    channel,
    manifest,
    manifest_source: source,
    manifest_digest: digest,
    installed: Boolean(current),
    current_product_version: current?.manifest?.product_version ?? null,
    current_manifest_digest: current?.manifest_digest ?? null,
    target_product_version: manifest.product_version,
    update_available: current?.manifest_digest !== digest,
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
  embeddedSmokeRunner = fixedEmbeddedSmoke
}) {
  const home = resolve(evozeusHome);
  const plan = await prepareChannelUpdate({ evozeusHome: home, channel, manifestSource, fetchImpl });
  const stateBefore = readChannelState(home);
  const stateFileExisted = existsSync(join(home, "channel-state.json"));
  const activeBefore = readActiveChannel(home);
  const existing = stateBefore.channels[channel];
  if (!plan.update_available && existing?.install_root && existsSync(existing.install_root)) {
    refreshChannelBootstrap(home, existing.component_roots.evozeus);
    const active = activateInstalledChannel(home, channel, autoRefresh);
    return { status: "already_current", ...plan, install_root: existing.install_root, active };
  }

  const installRoot = installRootFor(home, plan.manifest, plan.manifest_digest);
  const knownReusableRoot = [existing?.install_root, existing?.previous?.install_root]
    .filter(Boolean)
    .map((path) => resolve(path))
    .includes(resolve(installRoot));
  const referencedRoots = Object.values(stateBefore.channels)
    .flatMap((entry) => [entry?.install_root, entry?.previous?.install_root])
    .filter(Boolean)
    .map((path) => resolve(path));
  const recoveredInterruptedInstall = existsSync(installRoot) && !referencedRoots.includes(resolve(installRoot));
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
      previous: existing ? { ...existing, previous: null } : null,
      migration_backup: backupPath ? String(backupPath) : null
    };
    const nextState = {
      ...stateBefore,
      channels: { ...stateBefore.channels, [channel]: nextEntry },
      last_transaction: {
        status: "succeeded",
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
    refreshChannelBootstrap(home, coreRoot);
    return {
      status: reuseExistingRoot ? "reused_verified" : "installed",
      ...plan,
      writes_now: true,
      install_root: installRoot,
      recovered_interrupted_install: recoveredInterruptedInstall,
      component_roots: componentRoots,
      embedded_roots: embeddedRoots,
      migration_backup: backupPath ? String(backupPath) : null,
      active,
      rollback: existing?.install_root
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

export function rollbackChannel(evozeusHome, channel) {
  const home = resolve(evozeusHome);
  if (!CHANNELS.includes(channel)) {
    throw new ChannelError("INVALID_CHANNEL", "channel must be stable or uat");
  }
  const state = readChannelState(home);
  const current = state.channels[channel];
  const previous = current?.previous;
  if (!previous?.install_root || !existsSync(previous.install_root)) {
    throw new ChannelError("ROLLBACK_NOT_AVAILABLE", `no verified ${channel} rollback is available`);
  }
  const currentLink = currentLinkFor(home, channel);
  const linkBefore = linkTarget(currentLink);
  const activeBefore = readActiveChannel(home);
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
    return {
      status: "rolled_back",
      channel,
      product_version: restored.manifest?.product_version ?? null,
      manifest_digest: restored.manifest_digest,
      install_root: restored.install_root,
      active
    };
  } catch (error) {
    if (linkBefore) replaceSymlink(currentLink, linkBefore);
    atomicWriteJson(join(home, "channel-state.json"), state);
    if (activeBefore) atomicWriteJson(join(home, "active-channel.json"), activeBefore);
    throw error;
  }
}
