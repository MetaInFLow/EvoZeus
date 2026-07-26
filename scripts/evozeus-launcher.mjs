#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { applyChannelUpdate, DEFAULT_MANIFEST_SOURCES } from "./evozeus-channels.mjs";

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

function writeRefreshReport(payload) {
  const directory = join(home, "state", "uat");
  mkdirSync(directory, { recursive: true });
  const target = join(directory, "auto-refresh-last.json");
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, target);
}

const command = process.argv[2] || "";
const skipRefresh = ["update", "channel"].includes(command);
if (channel === "uat" && active.auto_refresh === true && !skipRefresh) {
  try {
    const update = await applyChannelUpdate({
      evozeusHome: home,
      channel: "uat",
      manifestSource: process.env.EVOZEUS_UAT_MANIFEST || DEFAULT_MANIFEST_SOURCES.uat,
      autoRefresh: true
    });
    writeRefreshReport({
      schema_version: "evozeus.uat-auto-refresh.v1",
      checked_at: new Date().toISOString(),
      status: update.status,
      manifest_digest: update.manifest_digest
    });
  } catch (error) {
    writeRefreshReport({
      schema_version: "evozeus.uat-auto-refresh.v1",
      checked_at: new Date().toISOString(),
      status: "failed_continuing_previous",
      error: { code: error.code || "UAT_REFRESH_FAILED", message: error.message }
    });
    console.error(`[EvoZeus UAT] refresh failed; continuing the previous verified UAT: ${error.message}`);
  }
  active = readJson(join(home, "active-channel.json"));
  state = readJson(join(home, "channel-state.json"));
  channel = ["stable", "uat"].includes(active?.channel) ? active.channel : null;
}

const entry = channel ? state?.channels?.[channel] : null;
const coreRoot = entry?.component_roots?.evozeus;
const fallbackRoot = join(home, "skeleton");
const selectedRoot = coreRoot && existsSync(join(coreRoot, "scripts", "evozeus-cli.mjs")) ? coreRoot : fallbackRoot;

const env = {
  ...process.env,
  EVOZEUS_HOME: home,
  ...(channel ? { EVOZEUS_ACTIVE_CHANNEL: channel, EVOZEUS_RUNTIME_STATE_ROOT: join(home, "state", channel) } : {}),
  ...(entry?.component_roots?.infra ? { EVOZEUS_INFRA_ROOT: entry.component_roots.infra } : {}),
  ...(entry?.component_roots?.coevolve ? { EVOZEUS_WRAPPER_ROOT: entry.component_roots.coevolve } : {}),
  ...(entry?.component_roots?.session_signal
    ? { EVOZEUS_OFFICIAL_REPO_ROOT: entry.component_roots.session_signal }
    : {})
};

const result = spawnSync(process.execPath, [join(selectedRoot, "scripts", "evozeus-cli.mjs"), ...process.argv.slice(2)], {
  stdio: "inherit",
  env
});
process.exit(result.status ?? 1);
