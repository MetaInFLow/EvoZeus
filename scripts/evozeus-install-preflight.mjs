#!/bin/sh
':' //; node_bin=$(command -v node 2>/dev/null || true)
':' //; if [ -z "${node_bin}" ]; then
':' //; now=$(/bin/date -u "+%Y-%m-%dT%H:%M:%SZ")
':' //; printf '%s\n' "{\"ok\":true,\"operation\":\"system.installPreflight\",\"schema_version\":\"evozeus.install-preflight.v1\",\"stage\":\"pre_fetch\",\"checked_at\":\"${now}\",\"writes\":false,\"status\":\"blocked\",\"executor\":{\"kind\":\"inline_pre_fetch_gate\",\"product_asset\":false,\"checksum_required\":false,\"acquisition_requires_network\":false},\"network\":{\"head_requests\":0,\"asset_get_count\":0,\"payloads_saved\":0,\"product_assets_downloaded\":0},\"local_state\":{\"status\":\"unknown_or_unverifiable\",\"preliminary\":true,\"evidence\":[\"node_unavailable_before_local_state_probe\"]},\"checks\":[{\"id\":\"node\",\"kind\":\"dependency\",\"requirement\":\"required\",\"required\":true,\"phase\":[\"checker_execution\"],\"status\":\"fail\",\"detected\":null,\"minimum_version\":\"18.17.0\",\"alternatives\":[],\"remediation\":\"Install Node.js 18.17.0 or newer.\"}],\"fallbacks\":[],\"blockers\":[{\"check_id\":\"node\",\"code\":\"NODE_MISSING\",\"message\":\"Node.js is required to run the full checker.\"}],\"remediation\":[{\"check_id\":\"node\",\"action\":\"Install Node.js 18.17.0 or newer, then rerun the pre-fetch gate.\"}],\"next_action\":{\"action\":\"stop_before_asset_get\",\"allowed\":false,\"writes_now\":false,\"product_asset_download_now\":false,\"registration_now\":false,\"approval_required\":false}}"
':' //; exit 2
':' //; fi
':' //; exec "${node_bin}" "$0" "$@"

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, accessSync, existsSync, lstatSync, readFileSync, readdirSync, statfsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PREFLIGHT_SCHEMA_VERSION = "evozeus.install-preflight.v1";
export const MIN_NODE_VERSION = "18.17.0";
export const MIN_PYTHON_VERSION = "3.11.0";
export const MIN_AVAILABLE_BYTES = 512 * 1024 * 1024;

const SUPPORTED_PLATFORMS = new Set(["darwin", "linux"]);
const SUPPORTED_ARCHES = new Set(["x64", "arm64"]);
const RELEASE_HEAD_URL = "https://github.com/MetaInFLow/EvoZeus/releases/latest";

function readJson(path) {
  if (!existsSync(path)) return { state: "missing", value: null };
  try {
    return { state: "valid", value: JSON.parse(readFileSync(path, "utf8")) };
  } catch {
    return { state: "invalid", value: null };
  }
}

function commandPath(command) {
  const result = spawnSync("/bin/sh", ["-c", 'command -v "$1"', "evozeus-preflight", command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function commandVersion(command, args, pattern) {
  if (!commandPath(command)) return null;
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const text = `${result.stdout || ""}\n${result.stderr || ""}`;
  return result.status === 0 ? text.match(pattern)?.[1] ?? null : null;
}

function versionTuple(value) {
  const match = String(value ?? "").match(/^(?:v)?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(value, minimum) {
  const comparison = compareVersions(value, minimum);
  return comparison !== null && comparison >= 0;
}

function compareVersions(left, right) {
  const actual = versionTuple(left);
  const expected = versionTuple(right);
  if (!actual || !expected) return null;
  for (let index = 0; index < 3; index += 1) {
    if (actual[index] !== expected[index]) return actual[index] - expected[index];
  }
  return 0;
}

function closestExistingParent(path) {
  let current = resolve(path);
  while (!existsSync(current) && dirname(current) !== current) current = dirname(current);
  return current;
}

function hasAccess(path) {
  try {
    accessSync(path, constants.R_OK | constants.W_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function availableBytes(path) {
  try {
    const stats = statfsSync(path);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return null;
  }
}

export function collectSystemSnapshot({ evozeusHome = join(homedir(), ".evozeus") } = {}) {
  const targetParent = closestExistingParent(dirname(resolve(evozeusHome)));
  const tempRoot = resolve(tmpdir());
  const hostOverride = String(process.env.EVOZEUS_HOSTS_AVAILABLE || "").trim();
  const hostCommands = hostOverride
    ? {
        codex: hostOverride === "all" || hostOverride.split(",").includes("codex"),
        claude: hostOverride === "all" || hostOverride.split(",").includes("claude")
      }
    : { codex: Boolean(commandPath("codex")), claude: Boolean(commandPath("claude")) };

  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version.replace(/^v/, ""),
    pythonVersion: commandVersion("python3", ["--version"], /Python\s+(\d+\.\d+\.\d+)/i),
    gitVersion: commandVersion("git", ["--version"], /git version\s+(\d+\.\d+\.\d+)/i),
    commands: {
      gh: Boolean(commandPath("gh")),
      curl: Boolean(commandPath("curl")),
      shasum: Boolean(commandPath("shasum")),
      sha256sum: Boolean(commandPath("sha256sum")),
      tar: Boolean(commandPath("tar")),
      ...hostCommands
    },
    tempAccess: hasAccess(tempRoot),
    targetParentAccess: hasAccess(targetParent),
    tempAvailableBytes: availableBytes(tempRoot),
    targetAvailableBytes: availableBytes(targetParent)
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function productManifestDigest(manifest) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalize(manifest))).digest("hex")}`;
}

function inspectContainedPath(root, target, finalKind) {
  if (typeof target !== "string" || !isAbsolute(target)) return { state: "unsafe" };
  const relativeTarget = relative(root, target);
  if (!relativeTarget || relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`) || isAbsolute(relativeTarget)) {
    return { state: "unsafe" };
  }

  let current = root;
  const segments = relativeTarget.split(sep).filter(Boolean);
  for (let index = 0; index < segments.length; index += 1) {
    current = join(current, segments[index]);
    const node = lstatState(current);
    if (node.state !== "present") return node.state === "missing" ? { state: "missing" } : { state: "unsafe" };
    if (node.stats.isSymbolicLink()) return { state: "unsafe" };
    const final = index === segments.length - 1;
    if (!final && !node.stats.isDirectory()) return { state: "unsafe" };
    if (final && finalKind === "directory" && !node.stats.isDirectory()) return { state: "unsafe" };
    if (final && finalKind === "file" && !node.stats.isFile()) return { state: "unsafe" };
  }
  return { state: "ready" };
}

function installedCliPath(home, active, state) {
  const channel = active?.channel;
  const entry = channel ? state?.channels?.[channel] : null;
  if (
    active?.schema_version !== "evozeus.active-channel.v1" ||
    state?.schema_version !== "evozeus.channel-state.v1" ||
    !entry?.manifest ||
    entry.manifest.channel !== channel ||
    entry.manifest_digest !== productManifestDigest(entry.manifest)
  ) {
    return { state: "unsafe", path: null, evidence: "active_channel_manifest_evidence_unverifiable" };
  }

  const installRoot = entry.install_root;
  const componentRoot = entry.component_roots?.evozeus;
  const installRootProbe = inspectContainedPath(home, installRoot, "directory");
  if (installRootProbe.state !== "ready") {
    return {
      state: installRootProbe.state,
      path: null,
      evidence: installRootProbe.state === "unsafe" ? "install_root_outside_home_or_unsafe" : "install_root_missing"
    };
  }
  const componentRootProbe = inspectContainedPath(installRoot, componentRoot, "directory");
  if (componentRootProbe.state !== "ready") {
    return {
      state: componentRootProbe.state,
      path: null,
      evidence: componentRootProbe.state === "unsafe" ? "component_root_outside_install_root_or_unsafe" : "component_root_missing"
    };
  }
  const cliPath = join(componentRoot, "scripts", "evozeus-cli.mjs");
  const cliProbe = inspectContainedPath(componentRoot, cliPath, "file");
  return {
    state: cliProbe.state,
    path: cliProbe.state === "ready" ? cliPath : null,
    evidence: cliProbe.state === "unsafe" ? "installed_core_cli_unsafe" : "installed_core_cli_missing"
  };
}

function lstatState(path) {
  try {
    return { state: "present", stats: lstatSync(path) };
  } catch (error) {
    return error?.code === "ENOENT"
      ? { state: "missing", stats: null }
      : { state: "unknown", stats: null };
  }
}

function targetPathSafetyEvidence(home, paths) {
  const root = parse(home).root;
  let current = root;
  const segments = relative(root, home).split(sep).filter(Boolean);
  for (const segment of segments) {
    current = join(current, segment);
    const node = lstatState(current);
    if (node.state === "missing") break;
    if (node.state === "unknown") return "evozeus_home_path_unverifiable";
    if (node.stats.isSymbolicLink()) return "evozeus_home_path_contains_symlink";
    if (!node.stats.isDirectory()) return "evozeus_home_path_contains_non_directory";
  }

  for (const [name, path] of [
    ["bin_directory", dirname(paths.bin)],
    ["hooks_directory", dirname(paths.legacyHook)]
  ]) {
    const node = lstatState(path);
    if (node.state === "unknown") return `${name}_unverifiable`;
    if (node.state === "present" && (node.stats.isSymbolicLink() || !node.stats.isDirectory())) {
      return `${name}_unsafe_node`;
    }
  }

  for (const [name, path] of Object.entries(paths)) {
    const node = lstatState(path);
    if (node.state === "unknown") return `${name}_unverifiable`;
    if (node.state === "present" && (node.stats.isSymbolicLink() || !node.stats.isFile())) {
      return `${name}_unsafe_node`;
    }
  }
  return null;
}

function runInstalledCli(cliPath, command, home) {
  const result = spawnSync(process.execPath, [cliPath, command, "--json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      EVOZEUS_HOME: home,
      EVOZEUS_AUTO_UPDATE: "0",
      EVOZEUS_AUTO_UPDATE_CHILD: "1",
      EVOZEUS_APPROVE_FEEDBACK: "0"
    }
  });
  if (result.status !== 0) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

export function inspectLocalInstallState({
  evozeusHome = join(homedir(), ".evozeus"),
  cliRunner = runInstalledCli
} = {}) {
  const home = resolve(evozeusHome);
  const paths = {
    bin: join(home, "bin", "evozeus"),
    registration: join(home, "registration.json"),
    installManifest: join(home, "install-manifest.json"),
    active: join(home, "active-channel.json"),
    channelState: join(home, "channel-state.json"),
    legacyHook: join(home, "hooks", "state.json")
  };
  const unsafePathEvidence = targetPathSafetyEvidence(home, paths);
  if (unsafePathEvidence) {
    return {
      status: "unknown_or_unverifiable",
      preliminary: true,
      evidence: [unsafePathEvidence]
    };
  }
  const present = Object.entries(paths).filter(([, path]) => existsSync(path)).map(([name]) => name);
  let homeEntries = [];
  if (lstatState(home).state === "present") {
    try {
      homeEntries = readdirSync(home);
    } catch {
      return {
        status: "unknown_or_unverifiable",
        preliminary: true,
        evidence: ["evozeus_home_entries_unverifiable"]
      };
    }
  }
  if (present.length === 0) {
    return homeEntries.length === 0
      ? { status: "not_installed", preliminary: true, evidence: ["no_local_install_markers"] }
      : {
          status: "unknown_or_unverifiable",
          preliminary: true,
          evidence: ["unclassified_entries_in_evozeus_home"]
        };
  }

  const active = readJson(paths.active);
  const channelState = readJson(paths.channelState);
  if (active.state === "invalid" || channelState.state === "invalid") {
    return {
      status: "unknown_or_unverifiable",
      preliminary: true,
      evidence: ["local_channel_json_unreadable"]
    };
  }

  if (active.state === "missing") {
    if (existsSync(paths.installManifest) || existsSync(paths.legacyHook)) {
      return {
        status: "legacy_migration_required",
        preliminary: true,
        evidence: ["legacy_install_markers_without_active_channel"]
      };
    }
    return {
      status: "repair_required",
      preliminary: true,
      evidence: ["partial_install_without_active_channel"]
    };
  }

  const channel = active.value?.channel;
  const entry = channelState.value?.channels?.[channel];
  if (!(["stable", "uat"].includes(channel)) || !entry) {
    return {
      status: "repair_required",
      preliminary: true,
      evidence: ["active_channel_state_missing"]
    };
  }
  if (entry.manifest?.schema_version !== "evozeus.product-channel.v2") {
    return {
      status: "legacy_migration_required",
      preliminary: true,
      evidence: ["legacy_product_manifest"]
    };
  }
  if (!existsSync(paths.bin)) {
    return { status: "repair_required", preliminary: true, evidence: ["local_cli_missing"] };
  }

  const cli = installedCliPath(home, active.value, channelState.value);
  if (cli.state === "unsafe") {
    return { status: "unknown_or_unverifiable", preliminary: true, evidence: [cli.evidence] };
  }
  if (cli.state !== "ready") {
    return { status: "repair_required", preliminary: true, evidence: [cli.evidence] };
  }
  const version = cliRunner(cli.path, "version", home);
  const doctor = cliRunner(cli.path, "doctor", home);
  if (!version?.ok || !doctor?.ok) {
    return {
      status: "unknown_or_unverifiable",
      preliminary: true,
      evidence: ["version_or_doctor_output_unverifiable"]
    };
  }

  const health = version.data?.health;
  const verdict = doctor.data?.doctor_verdict;
  if (health === "migration_required" || verdict === "migration_required") {
    return {
      status: "legacy_migration_required",
      preliminary: true,
      channel,
      product_version: version.data?.product_version ?? null,
      evidence: ["version_or_doctor_requires_migration"]
    };
  }
  if (health !== "healthy" || !["ready", "ready_after_new_session"].includes(verdict)) {
    return {
      status: "repair_required",
      preliminary: true,
      channel,
      product_version: version.data?.product_version ?? null,
      rollback_available: Boolean(entry.previous?.install_root),
      evidence: ["version_or_doctor_requires_repair"]
    };
  }
  return {
    status: "healthy_local",
    preliminary: true,
    channel,
    product_version: version.data?.product_version ?? null,
    rollback_available: Boolean(entry.previous?.install_root),
    evidence: ["direct_core_version_and_doctor_passed_without_launcher"]
  };
}

function check({ id, kind = "dependency", requirement = "required", required = true, phase, status, detected = null, minimumVersion = null, alternatives = [], remediation }) {
  return {
    id,
    kind,
    requirement,
    required,
    phase,
    status,
    detected,
    minimum_version: minimumVersion,
    alternatives,
    remediation
  };
}

function blocker(checkId, code, message, action) {
  return {
    blocker: { check_id: checkId, code, message },
    remediation: { check_id: checkId, action }
  };
}

function releaseTagFromHead(response, sourceUrl) {
  const location = response.headers?.get?.("location") || response.url || "";
  try {
    const url = new URL(location, sourceUrl);
    return url.pathname.match(/\/releases\/tag\/(v\d+\.\d+\.\d+)\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function probeLatestRelease(fetchImpl, releaseHeadUrl) {
  const testTag = process.env.NODE_ENV === "test" ? process.env.EVOZEUS_PREFLIGHT_TEST_RELEASE_TAG : null;
  if (testTag) return { ok: true, tag: testTag, headRequests: 0, method: "test_override" };
  try {
    const response = await fetchImpl(releaseHeadUrl, { method: "HEAD", redirect: "manual" });
    const tag = releaseTagFromHead(response, releaseHeadUrl);
    return {
      ok: response.status >= 200 && response.status < 400 && Boolean(tag),
      tag,
      status: response.status,
      headRequests: 1,
      method: "HEAD"
    };
  } catch (error) {
    return { ok: false, tag: null, headRequests: 1, method: "HEAD", error: error.message };
  }
}

function finalizeLocalState(localState, latestTag, desiredChannel) {
  if (localState.status !== "healthy_local") return { ...localState, preliminary: false };
  if (localState.channel !== desiredChannel) {
    return {
      ...localState,
      status: "unknown_or_unverifiable",
      preliminary: false,
      desired_channel: desiredChannel,
      evidence: [...localState.evidence, "active_channel_does_not_match_requested_install_channel"]
    };
  }
  if (!localState.product_version || !latestTag) {
    return {
      ...localState,
      status: "unknown_or_unverifiable",
      preliminary: false,
      evidence: [...localState.evidence, "latest_release_tag_unverifiable"]
    };
  }
  const comparison = compareVersions(localState.product_version, latestTag);
  if (comparison === null || comparison > 0) {
    return {
      ...localState,
      status: "unknown_or_unverifiable",
      preliminary: false,
      latest_product_version: latestTag,
      evidence: [...localState.evidence, comparison === null ? "local_version_is_not_semver" : "local_version_is_ahead_of_latest_stable"]
    };
  }
  return {
    ...localState,
    status: comparison === 0 ? "healthy_current" : "update_available",
    latest_product_version: latestTag,
    preliminary: false
  };
}

function nextAction(status, localState) {
  const common = {
    allowed: status !== "blocked",
    writes_now: false,
    product_asset_download_now: false,
    registration_now: false,
    approval_required: false
  };
  if (status === "blocked") return { ...common, action: "stop_and_remediate" };
  if (localState.status === "healthy_current") return { ...common, action: "report_noop" };
  if (localState.status === "not_installed") {
    return { ...common, action: "request_fresh_install_approval", approval_required: true };
  }
  if (localState.status === "update_available") {
    return { ...common, action: "request_update_approval", approval_required: true };
  }
  if (localState.status === "repair_required") {
    return { ...common, action: "request_repair_approval", approval_required: true };
  }
  if (localState.status === "legacy_migration_required") {
    return { ...common, action: "request_legacy_migration_approval", approval_required: true };
  }
  return { ...common, action: "stop_and_collect_local_evidence", allowed: false };
}

function appendInstallChecks({ snapshot, applicable, checks, fallbacks, addBlocker }) {
  if (!applicable) {
    for (const item of [
      ["os_arch", "environment", ["product_install"], "Use macOS or Linux on x86_64 or arm64 hardware."],
      ["node", "dependency", ["product_install"], `Install Node.js ${MIN_NODE_VERSION} or newer.`],
      ["download_tool", "dependency", ["product_download"], "Install GitHub CLI or curl."],
      ["checksum_tool", "dependency", ["product_verification"], "Install shasum or sha256sum."],
      ["tar", "dependency", ["product_extraction"], "Install tar."],
      ["agent_host", "environment", ["plugin_registration"], "Install Codex or Claude Code and expose its CLI on PATH."],
      ["python", "dependency", ["current_stable_runtime_and_doctor", "coevolve_smoke"], `Install Python ${MIN_PYTHON_VERSION} or newer for the current product manifest.`],
      ["git", "dependency", ["uat_install", "maintenance_and_diagnostics"], "Install Git before using Git-backed maintenance paths."],
      ["temp_access", "environment", ["product_install"], "Restore read, write, and traversal access to the temporary directory."],
      ["target_parent_access", "environment", ["product_install"], "Restore read, write, and traversal access to the target parent directory."],
      ["temp_disk_space", "environment", ["product_install"], "Free at least 512 MiB, then rerun preflight."],
      ["target_disk_space", "environment", ["product_install"], "Free at least 512 MiB, then rerun preflight."]
    ]) {
      checks.push(check({
        id: item[0],
        kind: item[1],
        requirement: "conditional",
        required: false,
        phase: item[2],
        status: "not_run",
        remediation: item[3]
      }));
    }
    return;
  }

  const platformReady = SUPPORTED_PLATFORMS.has(snapshot.platform) && SUPPORTED_ARCHES.has(snapshot.arch);
  checks.push(check({
    id: "os_arch", kind: "environment", phase: ["product_install"],
    status: platformReady ? "pass" : "fail", detected: { os: snapshot.platform, arch: snapshot.arch },
    remediation: "Use macOS or Linux on x86_64 or arm64 hardware."
  }));
  if (!platformReady) addBlocker("os_arch", "OS_ARCH_UNSUPPORTED", "The operating system or architecture is unsupported.", "Use macOS or Linux on x86_64 or arm64 hardware.");

  const nodeReady = versionAtLeast(snapshot.nodeVersion, MIN_NODE_VERSION);
  checks.push(check({
    id: "node", phase: ["product_install"], status: nodeReady ? "pass" : "fail",
    detected: snapshot.nodeVersion, minimumVersion: MIN_NODE_VERSION,
    remediation: `Install Node.js ${MIN_NODE_VERSION} or newer.`
  }));
  if (!nodeReady) addBlocker("node", "NODE_UNSUPPORTED", `Node.js ${MIN_NODE_VERSION} or newer is required.`, `Install Node.js ${MIN_NODE_VERSION} or newer.`);

  const downloadTool = snapshot.commands.gh ? "gh" : snapshot.commands.curl ? "curl" : null;
  const downloadFallback = downloadTool === "curl";
  checks.push(check({
    id: "download_tool", requirement: "required_one_of", phase: ["product_download"],
    status: downloadTool ? (downloadFallback ? "pass_with_fallback" : "pass") : "fail",
    detected: downloadTool, alternatives: ["gh", "curl"], remediation: "Install GitHub CLI or curl."
  }));
  if (downloadFallback) fallbacks.push({ check_id: "download_tool", selected: "curl", reason: "gh is unavailable; curl is the supported fallback." });
  if (!downloadTool) addBlocker("download_tool", "DOWNLOAD_TOOL_MISSING", "Neither gh nor curl is available.", "Install GitHub CLI or curl.");

  const preferredChecksum = snapshot.platform === "darwin" ? "shasum" : "sha256sum";
  const checksumTool = snapshot.commands[preferredChecksum]
    ? preferredChecksum
    : snapshot.commands.shasum ? "shasum" : snapshot.commands.sha256sum ? "sha256sum" : null;
  const checksumFallback = Boolean(checksumTool && checksumTool !== preferredChecksum);
  checks.push(check({
    id: "checksum_tool", requirement: "required_one_of", phase: ["product_verification"],
    status: checksumTool ? (checksumFallback ? "pass_with_fallback" : "pass") : "fail",
    detected: checksumTool, alternatives: ["shasum", "sha256sum"], remediation: "Install shasum or sha256sum."
  }));
  if (checksumFallback) fallbacks.push({ check_id: "checksum_tool", selected: checksumTool, reason: `${preferredChecksum} is unavailable; ${checksumTool} is the supported fallback.` });
  if (!checksumTool) addBlocker("checksum_tool", "CHECKSUM_TOOL_MISSING", "No SHA-256 verification tool is available.", "Install shasum or sha256sum.");

  checks.push(check({
    id: "tar", phase: ["product_extraction"], status: snapshot.commands.tar ? "pass" : "fail",
    detected: snapshot.commands.tar ? "tar" : null, remediation: "Install tar."
  }));
  if (!snapshot.commands.tar) addBlocker("tar", "TAR_MISSING", "tar is required for product extraction.", "Install tar.");

  const hosts = ["codex", "claude"].filter((host) => snapshot.commands[host]);
  checks.push(check({
    id: "agent_host", kind: "environment", requirement: "required_one_of", phase: ["plugin_registration"],
    status: hosts.length > 0 ? "pass" : "fail", detected: hosts, alternatives: ["codex", "claude"],
    remediation: "Install Codex or Claude Code and expose its CLI on PATH."
  }));
  if (hosts.length === 0) addBlocker("agent_host", "AGENT_HOST_MISSING", "No supported Agent host was detected.", "Install Codex or Claude Code and expose its CLI on PATH.");

  const pythonReady = versionAtLeast(snapshot.pythonVersion, MIN_PYTHON_VERSION);
  checks.push(check({
    id: "python", requirement: "conditional", required: true,
    phase: ["current_stable_runtime_and_doctor", "coevolve_smoke"], status: pythonReady ? "pass" : "fail",
    detected: snapshot.pythonVersion, minimumVersion: MIN_PYTHON_VERSION,
    remediation: `Install Python ${MIN_PYTHON_VERSION} or newer for the current product manifest.`
  }));
  if (!pythonReady) addBlocker("python", "PYTHON_REQUIRED_FOR_CURRENT_PRODUCT", `Python ${MIN_PYTHON_VERSION} or newer is required by the current Runtime, Session Signal, and CoEvolve checks.`, `Install Python ${MIN_PYTHON_VERSION} or newer.`);

  checks.push(check({
    id: "git", requirement: "conditional", required: false,
    phase: ["maintenance_and_diagnostics"], status: snapshot.gitVersion ? "pass" : "conditional",
    detected: snapshot.gitVersion, remediation: "Install Git before using Git-backed maintenance paths."
  }));

  for (const [id, ready, detected, message, action] of [
    ["temp_access", snapshot.tempAccess, snapshot.tempAccess, "The temporary directory is not accessible.", "Restore read, write, and traversal access to the temporary directory."],
    ["target_parent_access", snapshot.targetParentAccess, snapshot.targetParentAccess, "The EvoZeus target parent directory is not accessible.", "Restore read, write, and traversal access to the target parent directory."]
  ]) {
    checks.push(check({ id, kind: "environment", phase: ["product_install"], status: ready ? "pass" : "fail", detected, remediation: action }));
    if (!ready) addBlocker(id, id === "temp_access" ? "TEMP_ACCESS_BLOCKED" : "TARGET_PARENT_ACCESS_BLOCKED", message, action);
  }

  for (const [id, bytes, message] of [
    ["temp_disk_space", snapshot.tempAvailableBytes, "The temporary filesystem has insufficient free space."],
    ["target_disk_space", snapshot.targetAvailableBytes, "The target filesystem has insufficient free space."]
  ]) {
    const ready = Number.isFinite(bytes) && bytes >= MIN_AVAILABLE_BYTES;
    checks.push(check({
      id, kind: "environment", phase: ["product_install"], status: ready ? "pass" : "fail",
      detected: { available_bytes: bytes }, remediation: "Free at least 512 MiB, then rerun preflight."
    }));
    if (!ready) addBlocker(id, "DISK_SPACE_INSUFFICIENT", message, "Free at least 512 MiB, then rerun preflight.");
  }
}

export async function runInstallPreflight({
  evozeusHome = join(homedir(), ".evozeus"),
  channel = "stable",
  system = null,
  localState = null,
  fetchImpl = globalThis.fetch,
  releaseHeadUrl = process.env.EVOZEUS_PREFLIGHT_HEAD_URL || RELEASE_HEAD_URL,
  checkerAssetGetCount = 0
} = {}) {
  if (![0, 2].includes(checkerAssetGetCount)) {
    throw new Error("checkerAssetGetCount must be 0 for a trusted local checker or 2 for the checker and checksum GETs");
  }
  const local = localState ?? inspectLocalInstallState({ evozeusHome });
  const checks = [];
  const fallbacks = [];
  const blockers = [];
  const remediation = [];
  const addBlocker = (...args) => {
    const item = blocker(...args);
    blockers.push(item.blocker);
    remediation.push(item.remediation);
  };
  let release = { ok: false, tag: null, headRequests: 0, method: "not_run" };

  if (channel !== "stable") {
    addBlocker("target_channel", "PREFLIGHT_CHANNEL_UNSUPPORTED", "Install preflight v1 supports the immutable Stable channel only.", "Use --channel stable; enter UAT later through the installed channel workflow.");
  } else if (local.status === "unknown_or_unverifiable") {
    addBlocker("local_state", "LOCAL_STATE_UNVERIFIABLE", "The local installation state cannot be verified safely.", "Repair local state evidence or run direct version and Doctor checks, then retry.");
  } else if (local.status === "healthy_local" && local.channel !== channel) {
    addBlocker("local_state", "LOCAL_CHANNEL_MISMATCH", "The active local channel does not match the requested Stable install channel.", "Inspect the active channel and use the installed channel workflow; do not start a fresh install.");
  } else if (local.status === "healthy_local") {
    release = await probeLatestRelease(fetchImpl, releaseHeadUrl);
  }

  let finalLocalState = finalizeLocalState(local, release.tag, channel);
  const installEnvironmentApplicable = blockers.length === 0 && !["healthy_current", "unknown_or_unverifiable"].includes(finalLocalState.status);
  const snapshot = installEnvironmentApplicable ? (system ?? collectSystemSnapshot({ evozeusHome })) : null;
  appendInstallChecks({ snapshot, applicable: installEnvironmentApplicable, checks, fallbacks, addBlocker });

  if (channel === "stable" && release.method === "not_run" && blockers.length === 0) {
    release = await probeLatestRelease(fetchImpl, releaseHeadUrl);
    finalLocalState = finalizeLocalState(local, release.tag, channel);
  }

  checks.push(check({
    id: "github_network", kind: "network", phase: ["release_resolution"],
    status: release.method === "not_run" ? "not_run" : release.ok ? "pass" : "fail",
    detected: { method: release.method, latest_release: release.tag, payload_saved: false },
    remediation: "Restore GitHub HTTPS access and allow a payload-free HEAD request."
  }));
  if (release.method !== "not_run" && !release.ok) {
    addBlocker("github_network", "GITHUB_RELEASE_UNREACHABLE", "The latest immutable Stable Release could not be verified by HEAD.", "Restore GitHub HTTPS access, then rerun preflight.");
  }

  checks.unshift(check({
    id: "target_channel", kind: "environment", requirement: "required", required: true,
    phase: ["step_0_before_environment_or_network"], status: channel === "stable" ? "pass" : "fail",
    detected: channel, remediation: "Use --channel stable; enter UAT later through the installed channel workflow."
  }));
  checks.unshift(check({
    id: "local_state", kind: "local_state", phase: ["step_0_before_environment_or_network"],
    status: finalLocalState.status === "unknown_or_unverifiable" ? "fail" : "pass",
    detected: finalLocalState.status, remediation: "Stop and collect a valid direct version and Doctor result before installing."
  }));
  if (finalLocalState.status === "unknown_or_unverifiable" && !blockers.some((item) => item.check_id === "local_state")) {
    addBlocker("local_state", "LOCAL_STATE_UNVERIFIABLE", "The local installation state cannot be verified safely.", "Repair local state evidence or run the checker from a verified Release, then retry.");
  }

  const status = blockers.length > 0 ? "blocked" : fallbacks.length > 0 ? "ready_with_fallbacks" : "ready";
  return {
    ok: true,
    operation: "system.installPreflight",
    schema_version: PREFLIGHT_SCHEMA_VERSION,
    stage: "full",
    checked_at: new Date().toISOString(),
    writes: false,
    status,
    target: {
      channel,
      evozeus_home: resolve(evozeusHome)
    },
    executor: {
      kind: "verified_minimal_checker",
      product_asset: false,
      checksum_required: true,
      acquisition_requires_network: true
    },
    network: {
      head_requests: release.headRequests,
      asset_get_count: checkerAssetGetCount,
      payloads_saved: checkerAssetGetCount,
      product_assets_downloaded: 0
    },
    local_state: finalLocalState,
    checks,
    fallbacks,
    blockers,
    remediation,
    next_action: nextAction(status, finalLocalState)
  };
}

function parseArgs(argv) {
  const options = {
    evozeusHome: process.env.EVOZEUS_HOME || join(homedir(), ".evozeus"),
    channel: "stable",
    checkerAssetGetCount: 0
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--evozeus-home") options.evozeusHome = argv[++index];
    else if (arg === "--channel") options.channel = argv[++index];
    else if (arg === "--checker-asset-get-count") options.checkerAssetGetCount = Number(argv[++index]);
    else if (arg === "--json") continue;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown preflight argument: ${arg}`);
  }
  if (!(["stable", "uat"].includes(options.channel))) throw new Error("--channel must be stable or uat");
  return options;
}

function printHelp() {
  console.log("Usage: evozeus-install-preflight [--evozeus-home <path>] [--channel stable] [--checker-asset-get-count <n>] --json");
  console.log("Install preflight v1 supports Stable only. Use the installed channel workflow for UAT.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  const report = await runInstallPreflight(options);
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "blocked") process.exitCode = 2;
}

const directPath = process.argv[1] && process.argv[1] !== "-" ? resolve(process.argv[1]) : null;
if (directPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`evozeus-install-preflight: ${error.message}`);
    process.exit(1);
  });
}
