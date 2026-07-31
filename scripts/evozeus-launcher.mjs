#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  activateInstalledChannel,
  applyChannelUpdate,
  channelRecoveryIncomplete,
  DEFAULT_MANIFEST_SOURCES,
  prepareChannelUpdate,
  readActiveChannel,
  readChannelState,
  refreshChannelBootstrap,
  rollbackChannel
} from "./evozeus-channels.mjs";

const DEFAULT_CHECK_INTERVAL_SECONDS = 3600;
const LOCK_STALE_SECONDS = 900;
const UPDATE_POLICY_SCHEMA = "evozeus.update-policy.v1";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

const home = resolve(process.env.EVOZEUS_HOME || join(homedir(), ".evozeus"));
let active = readJson(join(home, "active-channel.json"));
let state = readJson(join(home, "channel-state.json"));
let channel = ["stable", "uat"].includes(active?.channel) ? active.channel : null;
const adjacentHostModule = fileURLToPath(new URL("./evozeus-hosts.mjs", import.meta.url));

async function loadPluginHostModule() {
  const activeCore = channel ? state?.channels?.[channel]?.component_roots?.evozeus : null;
  const candidates = [
    adjacentHostModule,
    join(home, "skeleton", "scripts", "evozeus-hosts.mjs"),
    ...(activeCore ? [join(activeCore, "scripts", "evozeus-hosts.mjs")] : [])
  ];
  for (const path of [...new Set(candidates)]) {
    if (!existsSync(path)) continue;
    return import(pathToFileURL(path).href);
  }
  return null;
}

const pluginHosts = await loadPluginHostModule();

function atomicWriteJson(target, payload) {
  const directory = resolve(target, "..");
  mkdirSync(directory, { recursive: true });
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, target);
}

function updatePolicy() {
  const path = join(home, "update-policy.json");
  const current = readJson(path);
  const intervalOverride = Number(process.env.EVOZEUS_UPDATE_CHECK_INTERVAL_SECONDS);
  const interval = Number.isFinite(intervalOverride) && intervalOverride >= 0
    ? intervalOverride
    : Number(current?.check_interval_seconds ?? DEFAULT_CHECK_INTERVAL_SECONDS);
  const policy = {
    schema_version: UPDATE_POLICY_SCHEMA,
    enabled: process.env.EVOZEUS_AUTO_UPDATE !== "0" && current?.enabled !== false,
    check_interval_seconds: Number.isFinite(interval) && interval >= 0 ? interval : DEFAULT_CHECK_INTERVAL_SECONDS,
    channels: {
      stable: current?.channels?.stable !== false,
      uat: current?.channels?.uat !== false
    }
  };
  if (!current) atomicWriteJson(path, policy);
  return policy;
}

function reportPath(channel) {
  return join(home, "state", channel, "auto-update-last.json");
}

function writeUpdateReport(channel, payload) {
  const report = {
    schema_version: "evozeus.auto-update-report.v1",
    channel,
    checked_at: new Date().toISOString(),
    ...payload
  };
  atomicWriteJson(reportPath(channel), report);
  if (channel === "uat") {
    atomicWriteJson(join(home, "state", "uat", "auto-refresh-last.json"), {
      schema_version: "evozeus.uat-auto-refresh.v1",
      checked_at: report.checked_at,
      status: report.status,
      ...(report.manifest_digest ? { manifest_digest: report.manifest_digest } : {}),
      ...(report.error ? { error: report.error } : {})
    });
  }
  return report;
}

function recentlyChecked(channel, intervalSeconds) {
  if (intervalSeconds === 0) return false;
  const report = readJson(reportPath(channel));
  const checkedAt = Date.parse(String(report?.checked_at ?? ""));
  return Number.isFinite(checkedAt) && Date.now() - checkedAt < intervalSeconds * 1000;
}

function acquireUpdateLock() {
  const lock = join(home, "state", "auto-update.lock");
  mkdirSync(join(home, "state"), { recursive: true });
  if (existsSync(lock)) {
    try {
      if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_SECONDS * 1000) rmSync(lock, { recursive: true, force: true });
    } catch {
      return null;
    }
  }
  try {
    mkdirSync(lock);
    return lock;
  } catch {
    return null;
  }
}

function visibleLog(message) {
  console.error(message);
}

function channelLabel(value) {
  return value === "uat" ? "UAT" : "Stable";
}

function availablePluginHosts() {
  return pluginHosts?.detectPluginHosts?.() ?? [];
}

function pluginStatus(entry, hosts) {
  if (!entry || hosts.length === 0) return { status: "not_applicable", hosts: {} };
  return pluginHosts.inspectPluginHosts({
    evozeusHome: home,
    channel: entry.manifest.channel,
    productVersion: entry.manifest.product_version,
    commit: entry.manifest.components.evozeus.commit,
    availableHosts: hosts
  });
}

function alignEntryPlugin(entry, hosts) {
  if (!entry || hosts.length === 0) return { status: "not_applicable", hosts: {} };
  return pluginHosts.alignPluginHosts({
    evozeusHome: home,
    sourceRoot: entry.component_roots.evozeus,
    channel: entry.manifest.channel,
    productVersion: entry.manifest.product_version,
    commit: entry.manifest.components.evozeus.commit,
    hosts
  });
}

function pluginVerificationReady(verification) {
  return ["ready", "ready_after_new_session", "not_applicable"].includes(verification?.status);
}

function restorePreviousProductAndPlugin({
  update,
  currentActive,
  currentEntry,
  currentChannel,
  hosts,
  pluginAlignmentStarted
}) {
  let pluginRecovery = "unchanged";
  if (pluginAlignmentStarted) {
    pluginRecovery = hosts.length > 0 ? "pending" : "not_applicable";
  }
  const recovery = {
    attempted: true,
    product: "unchanged",
    plugin: pluginRecovery
  };
  try {
    if (update?.writes_now) {
      if (update.rollback) {
        rollbackChannel(home, currentChannel);
        recovery.product = "rolled_back";
      } else if (currentActive?.channel && currentActive.channel !== currentChannel) {
        activateInstalledChannel(home, currentActive.channel, currentActive.auto_refresh === true);
        const priorActiveEntry = readChannelState(home).channels[currentActive.channel];
        refreshChannelBootstrap(home, priorActiveEntry.component_roots.evozeus);
        recovery.product = "reactivated_previous_channel";
      } else {
        throw new Error("the completed product transaction has no verified rollback target");
      }
    }

    if (
      recovery.product !== "reactivated_previous_channel" &&
      currentActive?.channel &&
      currentActive.channel !== currentChannel
    ) {
      activateInstalledChannel(home, currentActive.channel, currentActive.auto_refresh === true);
      const priorActiveEntry = readChannelState(home).channels[currentActive.channel];
      refreshChannelBootstrap(home, priorActiveEntry.component_roots.evozeus);
      recovery.product = "reactivated_previous_channel";
    }

    const restoredEntry = readChannelState(home).channels[currentChannel];
    if (
      currentEntry &&
      (restoredEntry?.install_root !== currentEntry.install_root ||
        restoredEntry?.manifest_digest !== currentEntry.manifest_digest)
    ) {
      throw new Error("the previous channel root or manifest digest was not restored");
    }

    if (pluginAlignmentStarted && currentEntry && hosts.length > 0) {
      alignEntryPlugin(restoredEntry || currentEntry, hosts);
      const verification = pluginStatus(restoredEntry || currentEntry, hosts);
      if (!pluginVerificationReady(verification)) {
        throw new Error(`previous Plugin verification failed: ${verification.status}`);
      }
      recovery.plugin = "realigned_previous";
    }
    return { ...recovery, status: "restored_previous" };
  } catch (error) {
    return {
      ...recovery,
      status: "incomplete",
      error: { code: error.code || "AUTO_UPDATE_RECOVERY_FAILED", message: error.message }
    };
  }
}

async function autoUpdateActiveChannel() {
  const currentActive = readActiveChannel(home);
  const currentChannel = currentActive?.channel;
  if (!currentChannel) return;
  const policy = updatePolicy();
  if (!policy.enabled || policy.channels[currentChannel] === false) return;

  const currentState = readChannelState(home);
  const currentEntry = currentState.channels[currentChannel];
  const hosts = availablePluginHosts();
  const localPlugin = pluginStatus(currentEntry, hosts);
  const pluginNeedsAlignment = ["plugin_mismatch", "plugin_install_required"].includes(localPlugin.status);
  if (recentlyChecked(currentChannel, policy.check_interval_seconds) && !pluginNeedsAlignment) return;

  const lock = acquireUpdateLock();
  if (!lock) return;

  const beforeVersion = currentEntry?.manifest?.product_version ?? "unknown";
  let update = null;
  let pluginAlignmentStarted = false;
  try {
    const manifestSource = currentChannel === "stable"
      ? process.env.EVOZEUS_STABLE_MANIFEST || DEFAULT_MANIFEST_SOURCES.stable
      : process.env.EVOZEUS_UAT_MANIFEST || DEFAULT_MANIFEST_SOURCES.uat;
    const plan = await prepareChannelUpdate({
      evozeusHome: home,
      channel: currentChannel,
      manifestSource
    });

    if (!plan.update_available) {
      if (plan.decision === "repair") {
        visibleLog(`🛠️ EvoZeus · 发现损坏｜${channelLabel(currentChannel)} ${plan.target_product_version} · 准备隔离修复`);
      }
      update = await applyChannelUpdate({
        evozeusHome: home,
        channel: currentChannel,
        manifestSource,
        autoRefresh: currentChannel === "uat"
      });
      const entry = readChannelState(home).channels[currentChannel];
      const refreshedPlugin = pluginStatus(entry, hosts);
      if (["plugin_mismatch", "plugin_install_required"].includes(refreshedPlugin.status)) {
        visibleLog(`🛠️ EvoZeus · 自动更新中｜${channelLabel(currentChannel)} ${plan.target_product_version} · Plugin对齐`);
        pluginAlignmentStarted = true;
        alignEntryPlugin(entry, hosts);
        const verification = pluginStatus(entry, hosts);
        if (!pluginVerificationReady(verification)) {
          throw new Error(`plugin verification failed: ${verification.status}`);
        }
        visibleLog(`✅ EvoZeus · 自动更新完成｜${channelLabel(currentChannel)} ${plan.target_product_version} · Plugin已对齐`);
      }
      writeUpdateReport(currentChannel, {
        status: update.status === "repaired"
          ? "repaired"
          : update.status === "activated"
            ? "activated"
            : "current",
        product_version: plan.target_product_version,
        latest_product_version: plan.target_product_version,
        manifest_digest: plan.manifest_digest,
        components: ["evozeus", "plugin", "runtime", "session_signal", "coevolve"]
      });
      return;
    }

    visibleLog(`🧭 EvoZeus · 发现更新｜${channelLabel(currentChannel)} ${beforeVersion} → ${plan.target_product_version}`);
    visibleLog("🛠️ EvoZeus · 自动更新中｜正在对齐Plugin、Runtime、Session Signal与CoEvolve");
    update = await applyChannelUpdate({
      evozeusHome: home,
      channel: currentChannel,
      manifestSource,
      autoRefresh: currentChannel === "uat"
    });
    const entry = readChannelState(home).channels[currentChannel];
    pluginAlignmentStarted = true;
    alignEntryPlugin(entry, hosts);
    const verification = pluginStatus(entry, hosts);
    if (!pluginVerificationReady(verification)) {
      throw new Error(`plugin verification failed: ${verification.status}`);
    }

    visibleLog(`✅ EvoZeus · 自动更新完成｜${channelLabel(currentChannel)} ${plan.target_product_version} · 新会话加载Plugin`);
    writeUpdateReport(currentChannel, {
      status: "updated",
      previous_product_version: beforeVersion,
      product_version: plan.target_product_version,
      latest_product_version: plan.target_product_version,
      manifest_digest: plan.manifest_digest,
      components: ["evozeus", "plugin", "runtime", "session_signal", "coevolve"]
    });
  } catch (error) {
    let recovery;
    if (channelRecoveryIncomplete(error)) {
      recovery = {
        attempted: true,
        status: "incomplete",
        error: { code: error.code, message: error.message }
      };
    } else if (update || pluginAlignmentStarted) {
      recovery = restorePreviousProductAndPlugin({
        update,
        currentActive,
        currentEntry,
        currentChannel,
        hosts,
        pluginAlignmentStarted
      });
    } else {
      recovery = { attempted: false, status: "transaction_not_applied" };
    }
    const recovered = recovery.status !== "incomplete";
    const afterEntry = readChannelState(home).channels[currentChannel];
    visibleLog(
      recovered
        ? `🛡️ EvoZeus · 自动更新失败｜继续使用${channelLabel(currentChannel)} ${beforeVersion} · ${error.message}`
        : `🛡️ EvoZeus · 自动更新失败｜恢复未完成 · ${error.message}`
    );
    writeUpdateReport(currentChannel, {
      status: recovered ? "failed_continuing_previous" : "failed_recovery_required",
      product_version: recovered
        ? beforeVersion
        : afterEntry?.manifest?.product_version ?? "unknown",
      error: { code: error.code || "AUTO_UPDATE_FAILED", message: error.message },
      recovery
    });
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

const command = process.argv[2] || "";
const skipRefresh = ["install", "update", "channel", "align"].includes(command) || process.env.EVOZEUS_AUTO_UPDATE_CHILD === "1";
if (channel && !skipRefresh) {
  await autoUpdateActiveChannel();
  active = readJson(join(home, "active-channel.json"));
  state = readJson(join(home, "channel-state.json"));
  channel = ["stable", "uat"].includes(active?.channel) ? active.channel : null;
}

const entry = channel ? state?.channels?.[channel] : null;
const coreRoot = entry?.component_roots?.evozeus;
const fallbackRoot = join(home, "skeleton");
const selectedRoot = coreRoot && existsSync(join(coreRoot, "scripts", "evozeus-cli.mjs")) ? coreRoot : fallbackRoot;
const runtimeRoot = entry?.embedded_roots?.runtime || join(selectedRoot, "packages", "runtime");
const sessionSignalRoot = entry?.embedded_roots?.session_signal || join(selectedRoot, "packs", "session-signal");

const env = {
  ...process.env,
  EVOZEUS_HOME: home,
  ...(channel ? { EVOZEUS_ACTIVE_CHANNEL: channel, EVOZEUS_RUNTIME_STATE_ROOT: join(home, "state", channel) } : {}),
  EVOZEUS_INFRA_ROOT: runtimeRoot,
  ...(entry?.component_roots?.coevolve ? { EVOZEUS_WRAPPER_ROOT: entry.component_roots.coevolve } : {}),
  EVOZEUS_OFFICIAL_REPO_ROOT: sessionSignalRoot
};

const result = spawnSync(process.execPath, [join(selectedRoot, "scripts", "evozeus-cli.mjs"), ...process.argv.slice(2)], {
  stdio: "inherit",
  env
});
process.exit(result.status ?? 1);
