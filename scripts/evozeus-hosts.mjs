import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const PLUGIN_ID = "evozeus";
export const SUPPORTED_HOSTS = ["codex", "claude"];

const PLUGIN_ENTRIES = [
  ".codex-plugin",
  ".claude-plugin",
  "skills",
  "hooks",
  "assets/icons",
  "README.md",
  "LICENSE"
];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function productSemver(productVersion) {
  const version = String(productVersion || "").replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid EvoZeus product version: ${productVersion}`);
  }
  return version.split("+")[0];
}

function shortCommit(commit) {
  if (!/^[0-9a-f]{40}$/i.test(String(commit || ""))) {
    throw new Error("EvoZeus plugin alignment requires a full 40-character Git commit");
  }
  return String(commit).toLowerCase().slice(0, 12);
}

export function pluginVersions(channel, productVersion, commit) {
  const base = productSemver(productVersion).replace(/-.*$/, "");
  const short = shortCommit(commit);
  return channel === "uat"
    ? {
        codex: `${base}-uat+codex.uat-${short}`,
        claude: `${base}-uat.${short}`
      }
    : {
        codex: `${base}+codex.stable-${short}`,
        claude: base
      };
}

export function detectPluginHosts({ env = process.env, runCommand = defaultRunCommand } = {}) {
  const override = String(env.EVOZEUS_HOSTS_AVAILABLE || "").trim();
  if (override) {
    if (override === "none") return [];
    return override
      .split(",")
      .map((value) => value.trim())
      .filter((value) => SUPPORTED_HOSTS.includes(value));
  }

  return SUPPORTED_HOSTS.filter((host) => runCommand(host, ["--version"], { env }).status === 0);
}

export function selectPluginHosts(mode, availableHosts) {
  const available = [...new Set(availableHosts)].filter((host) => SUPPORTED_HOSTS.includes(host));
  if (!mode || mode === "auto" || mode === "all") {
    if (available.length === 0) {
      throw new Error("No supported Agent host was detected. Install Codex or Claude Code, then retry EvoZeus alignment.");
    }
    return available;
  }
  if (!SUPPORTED_HOSTS.includes(mode)) {
    throw new Error("--host must be auto, all, codex, or claude");
  }
  if (!available.includes(mode)) {
    throw new Error(`Requested Agent host is unavailable: ${mode}`);
  }
  return [mode];
}

function marketplaceRoot(evozeusHome, host) {
  return join(resolve(evozeusHome), "hosts", `${host}-marketplace`);
}

function pluginRoot(evozeusHome, host) {
  return join(marketplaceRoot(evozeusHome, host), "plugins", PLUGIN_ID);
}

function copyPlugin(sourceRoot, targetRoot) {
  rmSync(targetRoot, { recursive: true, force: true });
  mkdirSync(targetRoot, { recursive: true });
  for (const entry of PLUGIN_ENTRIES) {
    const source = join(sourceRoot, entry);
    if (!existsSync(source)) continue;
    const target = join(targetRoot, entry);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
  }
}

function rewritePluginManifests(targetRoot, channel, productVersion, commit) {
  const versions = pluginVersions(channel, productVersion, commit);
  const displayName = channel === "uat" ? "EvoZeus UAT" : "EvoZeus";
  const codexPath = join(targetRoot, ".codex-plugin", "plugin.json");
  const claudePath = join(targetRoot, ".claude-plugin", "plugin.json");
  const codex = readJson(codexPath);
  const claude = readJson(claudePath);
  if (!codex || !claude) {
    throw new Error("EvoZeus source is missing a Codex or Claude plugin manifest");
  }
  codex.version = versions.codex;
  codex.interface = { ...codex.interface, displayName };
  if (channel === "uat") {
    codex.interface.shortDescription = `测试版 · ${codex.interface.shortDescription}`;
  }
  claude.version = versions.claude;
  claude.description = channel === "uat" ? `UAT testing channel. ${claude.description}` : claude.description;
  writeJson(codexPath, codex);
  writeJson(claudePath, claude);
  return { versions, displayName };
}

function codexMarketplace(root) {
  return {
    name: "evozeus",
    interface: { displayName: "EvoZeus" },
    plugins: [
      {
        name: PLUGIN_ID,
        source: { source: "local", path: `./plugins/${PLUGIN_ID}` },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Developer Tools"
      }
    ]
  };
}

function claudeMarketplace(version) {
  return {
    name: "evozeus",
    owner: { name: "MetaInFlow" },
    plugins: [
      {
        name: PLUGIN_ID,
        source: `./plugins/${PLUGIN_ID}`,
        description: "With explicit approval, turn local Agent history into an AI usage profile and attach a CoEvolve Harness to an independent Skillware repository.",
        version
      }
    ]
  };
}

function hostCommands(host, root) {
  if (host === "codex") {
    return [
      ["codex", ["plugin", "marketplace", "add", root]],
      ["codex", ["plugin", "add", `${PLUGIN_ID}@evozeus`]]
    ];
  }
  return [
    ["claude", ["plugin", "marketplace", "add", root, "--scope", "user"]],
    ["claude", ["plugin", "marketplace", "update", "evozeus"]],
    ["claude", ["plugin", "install", `${PLUGIN_ID}@evozeus`, "--scope", "user"]],
    ["claude", ["plugin", "update", `${PLUGIN_ID}@evozeus`, "--scope", "user"]]
  ];
}

function commandLabel([command, args]) {
  return [command, ...args].join(" ");
}

function isIdempotentMarketplaceResult(result) {
  const detail = `${result.stdout || ""}\n${result.stderr || ""}`;
  return /already (?:exists|added|configured|installed)|duplicate/i.test(detail);
}

function runHostCommands(host, root, runCommand) {
  const executed = [];
  for (const command of hostCommands(host, root)) {
    const result = runCommand(command[0], command[1]);
    executed.push({ command: commandLabel(command), status: result.status });
    if (result.status !== 0 && !isIdempotentMarketplaceResult(result)) {
      const detail = String(result.stderr || result.stdout || "").trim();
      throw new Error(`${host} plugin registration failed: ${detail || commandLabel(command)}`);
    }
  }
  return executed;
}

export function planPluginAlignment({
  evozeusHome,
  sourceRoot,
  channel,
  productVersion,
  commit,
  hosts
}) {
  if (!existsSync(resolve(sourceRoot))) {
    throw new Error(`EvoZeus plugin source does not exist: ${sourceRoot}`);
  }
  if (!["stable", "uat"].includes(channel)) {
    throw new Error("EvoZeus plugin channel must be stable or uat");
  }
  const versions = pluginVersions(channel, productVersion, commit);
  const displayName = channel === "uat" ? "EvoZeus UAT" : "EvoZeus";
  return {
    writes_now: false,
    plugin_id: PLUGIN_ID,
    channel,
    product_version: productVersion,
    commit,
    display_name: displayName,
    versions,
    hosts: Object.fromEntries(
      hosts.map((host) => {
        const root = marketplaceRoot(evozeusHome, host);
        return [
          host,
          {
            marketplace_root: root,
            plugin_root: pluginRoot(evozeusHome, host),
            commands: hostCommands(host, root).map(commandLabel)
          }
        ];
      })
    )
  };
}

export function alignPluginHosts({
  evozeusHome,
  sourceRoot,
  channel,
  productVersion,
  commit,
  hosts,
  runCommand = defaultRunCommand
}) {
  const plan = planPluginAlignment({ evozeusHome, sourceRoot, channel, productVersion, commit, hosts });
  const hostState = {};

  for (const host of hosts) {
    const root = plan.hosts[host].marketplace_root;
    const target = plan.hosts[host].plugin_root;
    copyPlugin(resolve(sourceRoot), target);
    const rewritten = rewritePluginManifests(target, channel, productVersion, commit);
    if (host === "codex") {
      writeJson(join(root, ".agents/plugins/marketplace.json"), codexMarketplace(root));
    } else {
      writeJson(join(root, ".claude-plugin/marketplace.json"), claudeMarketplace(rewritten.versions.claude));
    }
    const commands = runHostCommands(host, root, runCommand);
    hostState[host] = {
      status: "installed",
      marketplace_root: root,
      plugin_root: target,
      plugin_version: rewritten.versions[host],
      commands
    };
  }

  const state = {
    schema_version: "evozeus.plugin-host-state.v1",
    plugin_id: PLUGIN_ID,
    active_channel: channel,
    product_version: productVersion,
    commit,
    hosts: hostState,
    aligned_at: new Date().toISOString(),
    new_session_required: true
  };
  writeJson(join(resolve(evozeusHome), "hosts/plugin-state.json"), state);
  return { status: "ready_after_new_session", ...state };
}

export function inspectPluginHosts({
  evozeusHome,
  channel,
  productVersion,
  commit,
  availableHosts,
  runCommand = defaultRunCommand
}) {
  if (availableHosts.length === 0) {
    return { status: "not_applicable", hosts: {}, reason: "no_supported_host_detected" };
  }
  const state = readJson(join(resolve(evozeusHome), "hosts/plugin-state.json"));
  const exact = state && state.active_channel === channel && state.product_version === productVersion && state.commit === commit;
  const hosts = {};
  for (const host of availableHosts) {
    const installed = state?.hosts?.[host];
    if (!exact || !installed || !existsSync(installed.plugin_root)) {
      hosts[host] = { status: exact ? "not_installed" : "mismatch", installed: installed || null };
      continue;
    }
    const listArgs = host === "codex" ? ["plugin", "list"] : ["plugin", "list", "--json"];
    const listed = runCommand(host, listArgs);
    const discovered = listed.status === 0 && /evozeus/i.test(`${listed.stdout || ""}\n${listed.stderr || ""}`);
    hosts[host] = {
      status: discovered ? "ready" : "ready_after_new_session",
      plugin_version: installed.plugin_version,
      marketplace_root: installed.marketplace_root
    };
  }
  const values = Object.values(hosts).map((host) => host.status);
  return {
    status: !exact
      ? "plugin_mismatch"
      : values.some((status) => status === "not_installed" || status === "mismatch")
        ? "plugin_install_required"
        : values.every((status) => status === "ready")
          ? "ready"
          : "ready_after_new_session",
    active_channel: state?.active_channel ?? null,
    product_version: state?.product_version ?? null,
    commit: state?.commit ?? null,
    hosts
  };
}

function defaultRunCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    env: { ...process.env, ...(options.env || {}) }
  });
}
