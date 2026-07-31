import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  MIN_AVAILABLE_BYTES,
  collectSystemSnapshot,
  inspectLocalInstallState,
  runInstallPreflight
} from "./evozeus-install-preflight.mjs";
import { productManifestDigest } from "./evozeus-channels.mjs";

const PREFETCH = fileURLToPath(new URL("./evozeus-install-prefetch.sh", import.meta.url));
const CHECKER = fileURLToPath(new URL("./evozeus-install-preflight.mjs", import.meta.url));
const RELEASE_WORKFLOW = readFileSync(fileURLToPath(new URL("../.github/workflows/release.yml", import.meta.url)), "utf8");
const SCHEMA = JSON.parse(readFileSync(fileURLToPath(new URL("../schemas/install-preflight.schema.json", import.meta.url)), "utf8"));
const validate = new Ajv2020({ strict: false, formats: { "date-time": true } }).compile(SCHEMA);

function assertSchema(report) {
  assert.equal(validate(report), true, JSON.stringify(validate.errors, null, 2));
}

function withTempRoot(callback) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "evozeus-preflight-test-")));
  try {
    return callback(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function readySystem(overrides = {}) {
  const commands = {
    gh: true,
    curl: true,
    shasum: true,
    sha256sum: true,
    tar: true,
    codex: true,
    claude: false,
    ...(overrides.commands || {})
  };
  return {
    platform: "linux",
    arch: "x64",
    nodeVersion: "20.12.2",
    pythonVersion: "3.12.2",
    gitVersion: "2.45.0",
    commands,
    tempAccess: true,
    targetParentAccess: true,
    tempAvailableBytes: MIN_AVAILABLE_BYTES * 2,
    targetAvailableBytes: MIN_AVAILABLE_BYTES * 2,
    ...overrides,
    commands
  };
}

function releaseHead(tag = "v0.4.1") {
  return async () => ({
    status: 302,
    url: "https://github.com/MetaInFLow/EvoZeus/releases/latest",
    headers: { get: (name) => name.toLowerCase() === "location" ? `/MetaInFLow/EvoZeus/releases/tag/${tag}` : null }
  });
}

function local(status, extras = {}) {
  return { status, preliminary: true, evidence: [`fixture:${status}`], ...extras };
}

function writeExecutable(path, content) {
  writeFileSync(path, `#!/bin/sh\n${content}\n`);
  chmodSync(path, 0o755);
}

function writeInstalledState(home, { installRoot = join(home, "releases", "stable", "v0.4.1-fixture"), componentRoot = null, cliSymlinkTarget = null } = {}) {
  const core = componentRoot || join(installRoot, "evozeus");
  const manifest = { schema_version: "evozeus.product-channel.v2", channel: "stable" };
  mkdirSync(join(home, "bin"), { recursive: true });
  mkdirSync(installRoot, { recursive: true });
  mkdirSync(join(core, "scripts"), { recursive: true });
  writeFileSync(join(home, "bin", "evozeus"), "shim\n");
  if (cliSymlinkTarget) {
    symlinkSync(cliSymlinkTarget, join(core, "scripts", "evozeus-cli.mjs"));
  } else {
    writeFileSync(join(core, "scripts", "evozeus-cli.mjs"), "fixture\n");
  }
  writeFileSync(join(home, "active-channel.json"), JSON.stringify({
    schema_version: "evozeus.active-channel.v1",
    channel: "stable"
  }));
  writeFileSync(join(home, "channel-state.json"), JSON.stringify({
    schema_version: "evozeus.channel-state.v1",
    channels: {
      stable: {
        manifest,
        manifest_digest: productManifestDigest(manifest),
        install_root: installRoot,
        component_roots: { evozeus: core },
        previous: null
      }
    }
  }));
  return { core, installRoot };
}

function runPrefetch({ path = process.env.PATH, env = {} } = {}) {
  return spawnSync("/bin/sh", [PREFETCH], {
    encoding: "utf8",
    env: {
      ...process.env,
      EVOZEUS_HOME: join(realpathSync(tmpdir()), `evozeus-preflight-not-installed-${process.pid}`),
      ...env,
      PATH: path
    }
  });
}

function parsePrefetch(result, expectedStatus = 2) {
  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assertSchema(report);
  return report;
}

describe("install pre-fetch gate", () => {
  it("returns blocked JSON with zero network or asset GET when Node is missing", () => {
    const report = parsePrefetch(runPrefetch({ path: "" }));

    assert.equal(report.blockers[0].code, "NODE_MISSING");
    assert.deepEqual(report.network, {
      head_requests: 0,
      asset_get_count: 0,
      payloads_saved: 0,
      product_assets_downloaded: 0
    });
  });

  it("compares the complete Node threshold: 18.16 fails while 18.17 and 20 pass the Node gate", () =>
    withTempRoot((root) => {
      for (const [version, expectedCode] of [
        ["v18.16.1", "NODE_TOO_OLD"],
        ["v18.17.0", "DOWNLOAD_TOOL_MISSING"],
        ["v20.0.0", "DOWNLOAD_TOOL_MISSING"]
      ]) {
        const bin = join(root, version.replaceAll(".", "-"));
        mkdirSync(bin);
        writeExecutable(join(bin, "node"), `printf '%s\\n' '${version}'`);
        writeExecutable(join(bin, "python3"), "printf '%s\\n' 'Python 3.12.2'");
        const report = parsePrefetch(runPrefetch({ path: bin }));
        assert.equal(report.blockers[0].code, expectedCode, version);
        assert.equal(report.network.asset_get_count, 0);
      }
    }));

  it("stops before network and asset GET when checksum verification is unavailable", () =>
    withTempRoot((bin) => {
      writeExecutable(join(bin, "node"), "printf '%s\\n' 'v20.12.2'");
      writeExecutable(join(bin, "python3"), "printf '%s\\n' 'Python 3.12.2'");
      writeExecutable(join(bin, "curl"), "exit 99");
      const report = parsePrefetch(runPrefetch({ path: bin }));

      assert.equal(report.blockers[0].code, "CHECKSUM_TOOL_MISSING");
      assert.equal(report.network.head_requests, 0);
      assert.equal(report.network.asset_get_count, 0);
    }));

  it("requires the complete Python 3.11 threshold before checker GET", () =>
    withTempRoot((root) => {
      for (const [version, expectedCode] of [
        [null, "PYTHON_MISSING"],
        ["3.10.14", "PYTHON_TOO_OLD"],
        ["3.11.0", "DOWNLOAD_TOOL_MISSING"]
      ]) {
        const bin = join(root, version ? version.replaceAll(".", "-") : "missing");
        mkdirSync(bin);
        writeExecutable(join(bin, "node"), "printf '%s\\n' 'v20.12.2'");
        if (version) writeExecutable(join(bin, "python3"), `printf '%s\\n' 'Python ${version}'`);

        const report = parsePrefetch(runPrefetch({ path: bin }));
        assert.equal(report.blockers[0].code, expectedCode, version || "missing");
        assert.equal(report.network.head_requests, 0);
        assert.equal(report.network.asset_get_count, 0);
      }
    }));

  it("reports HOME as a schema-valid blocker instead of exiting under set -u", () => {
    const result = spawnSync("/bin/sh", [PREFETCH], {
      encoding: "utf8",
      env: { PATH: process.env.PATH }
    });
    const report = parsePrefetch(result);

    assert.equal(report.blockers[0].code, "HOME_UNSET");
    assert.equal(report.network.head_requests, 0);
  });

  it("stops an existing installation before dependency checks or checker acquisition", () =>
    withTempRoot((root) => {
      const evozeusHome = join(root, ".evozeus");
      mkdirSync(join(evozeusHome, "bin"), { recursive: true });
      writeExecutable(join(evozeusHome, "bin", "evozeus"), "exit 91");

      const report = parsePrefetch(runPrefetch({ path: "", env: { EVOZEUS_HOME: evozeusHome } }));

      assert.equal(report.blockers[0].code, "EXISTING_INSTALL_REQUIRES_LOCAL_STATE_CHECK");
      assert.equal(report.checks[0].kind, "local_state");
      assert.equal(report.network.head_requests, 0);
      assert.equal(report.network.asset_get_count, 0);
    }));

  it("treats a dangling local CLI symlink as existing unsafe state before checker acquisition", () =>
    withTempRoot((root) => {
      const evozeusHome = join(root, ".evozeus");
      mkdirSync(join(evozeusHome, "bin"), { recursive: true });
      symlinkSync(join(root, "missing-cli"), join(evozeusHome, "bin", "evozeus"));

      const report = parsePrefetch(runPrefetch({ path: "", env: { EVOZEUS_HOME: evozeusHome } }));

      assert.equal(report.local_state.status, "unknown_or_unverifiable");
      assert.equal(report.blockers[0].code, "EXISTING_INSTALL_REQUIRES_LOCAL_STATE_CHECK");
      assert.equal(report.network.asset_get_count, 0);
    }));

  it("rejects unsafe EVOZEUS_HOME path components before dependency checks or checker GET", () =>
    withTempRoot((root) => {
      const emptyTarget = join(root, "empty-target");
      const intermediateTarget = join(root, "intermediate-target");
      mkdirSync(emptyTarget);
      mkdirSync(intermediateTarget);
      const rootSymlink = join(root, "home-link");
      const intermediateSymlink = join(root, "ancestor-link");
      const regularFile = join(root, "home-file");
      symlinkSync(emptyTarget, rootSymlink);
      symlinkSync(intermediateTarget, intermediateSymlink);
      writeFileSync(regularFile, "fixture\n");

      for (const evozeusHome of [
        rootSymlink,
        join(intermediateSymlink, ".evozeus"),
        regularFile,
        "relative-evozeus-home",
        `${root}/missing/../escaped-home`
      ]) {
        const report = parsePrefetch(runPrefetch({ path: "", env: { EVOZEUS_HOME: evozeusHome } }));
        assert.equal(report.local_state.status, "unknown_or_unverifiable", evozeusHome);
        assert.equal(report.blockers[0].code, "LOCAL_STATE_PATH_UNSAFE", evozeusHome);
        assert.equal(report.network.head_requests, 0, evozeusHome);
        assert.equal(report.network.asset_get_count, 0, evozeusHome);
      }
    }));

  it("blocks an existing empty EVOZEUS_HOME that is not writable", () =>
    withTempRoot((root) => {
      const evozeusHome = join(root, "empty-read-only-home");
      const bin = join(root, "bin");
      mkdirSync(evozeusHome);
      mkdirSync(bin);
      writeExecutable(join(bin, "node"), "printf '%s\\n' 'v20.12.2'");
      writeExecutable(join(bin, "python3"), "printf '%s\\n' 'Python 3.12.2'");
      for (const command of ["curl", "shasum", "tar", "codex"]) {
        writeExecutable(join(bin, command), "exit 0");
      }
      writeExecutable(join(bin, "uname"), "if [ \"$1\" = '-s' ]; then echo Linux; else echo x86_64; fi");
      chmodSync(evozeusHome, 0o500);
      try {
        const snapshot = collectSystemSnapshot({ evozeusHome });
        assert.equal(snapshot.targetParentAccess, false);

        const report = parsePrefetch(runPrefetch({ path: bin, env: { EVOZEUS_HOME: evozeusHome } }));
        assert.equal(report.blockers[0].code, "TARGET_PARENT_ACCESS_BLOCKED");
        assert.equal(report.network.head_requests, 0);
        assert.equal(report.network.asset_get_count, 0);
      } finally {
        chmodSync(evozeusHome, 0o700);
      }
    }));

  it("records one attempted HEAD and zero asset GETs when GitHub is unreachable", () =>
    withTempRoot((bin) => {
      writeExecutable(join(bin, "node"), "printf '%s\\n' 'v20.12.2'");
      writeExecutable(join(bin, "python3"), "printf '%s\\n' 'Python 3.12.2'");
      writeExecutable(join(bin, "curl"), "exit 22");
      writeExecutable(join(bin, "shasum"), "exit 0");
      writeExecutable(join(bin, "tar"), "exit 0");
      writeExecutable(join(bin, "codex"), "exit 0");
      writeExecutable(join(bin, "uname"), "if [ \"$1\" = '-s' ]; then echo Linux; else echo x86_64; fi");
      writeExecutable(join(bin, "df"), "printf '%s\\n' 'Filesystem 1024-blocks Used Available Capacity Mounted on' 'fixture 2097152 1 2097151 1% /tmp'");
      const report = parsePrefetch(runPrefetch({ path: bin }));

      assert.equal(report.blockers[0].code, "GITHUB_UNREACHABLE");
      assert.equal(report.network.head_requests, 1);
      assert.equal(report.network.asset_get_count, 0);
      assert.equal(report.network.payloads_saved, 0);
    }));

  it("executes the verified checker through its POSIX polyglot entry", () => {
    const result = spawnSync("/bin/sh", [CHECKER, "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage: evozeus-install-preflight/);
  });
});

describe("full install preflight contract", () => {
  it("returns a schema-valid ready result without creating the target home", async () =>
    withTempRoot(async (root) => {
      const evozeusHome = join(root, "home", ".evozeus");
      const report = await runInstallPreflight({
        evozeusHome,
        system: readySystem(),
        localState: local("not_installed"),
        fetchImpl: releaseHead()
      });

      assertSchema(report);
      assert.equal(report.status, "ready");
      assert.equal(report.writes, false);
      assert.deepEqual(report.target, { channel: "stable", evozeus_home: evozeusHome });
      assert.equal(report.local_state.status, "not_installed");
      assert.equal(report.network.asset_get_count, 0);
      assert.equal(report.next_action.action, "request_fresh_install_approval");
      assert.equal(existsSync(evozeusHome), false);
    }));

  it("uses curl as a non-blocking fallback when gh is missing", async () => {
    const report = await runInstallPreflight({
      system: readySystem({ commands: { gh: false } }),
      localState: local("not_installed"),
      fetchImpl: releaseHead()
    });

    assert.equal(report.status, "ready_with_fallbacks");
    assert.deepEqual(report.fallbacks, [
      { check_id: "download_tool", selected: "curl", reason: "gh is unavailable; curl is the supported fallback." }
    ]);
  });

  it("accounts for separately downloaded checker and checksum assets without counting product downloads", async () => {
    const report = await runInstallPreflight({
      system: readySystem(),
      localState: local("not_installed"),
      fetchImpl: releaseHead(),
      checkerAssetGetCount: 2
    });

    assertSchema(report);
    assert.equal(report.network.asset_get_count, 2);
    assert.equal(report.network.payloads_saved, 2);
    assert.equal(report.network.product_assets_downloaded, 0);
    assert.equal(report.executor.product_asset, false);
  });

  it("accepts only the contract-defined checker asset GET counts", async () => {
    for (const checkerAssetGetCount of [1, 3]) {
      await assert.rejects(
        runInstallPreflight({ checkerAssetGetCount }),
        /must be 0 for a trusted local checker or 2 for the checker and checksum GETs/
      );
    }
  });

  it("blocks without calling the network for local dependency and environment failures", async () => {
    const cases = [
      ["node", readySystem({ nodeVersion: null }), "NODE_UNSUPPORTED"],
      ["checksum", readySystem({ commands: { shasum: false, sha256sum: false } }), "CHECKSUM_TOOL_MISSING"],
      ["host", readySystem({ commands: { codex: false, claude: false } }), "AGENT_HOST_MISSING"],
      ["target access", readySystem({ targetParentAccess: false }), "TARGET_PARENT_ACCESS_BLOCKED"],
      ["disk", readySystem({ tempAvailableBytes: MIN_AVAILABLE_BYTES - 1 }), "DISK_SPACE_INSUFFICIENT"]
    ];
    for (const [name, system, code] of cases) {
      let calls = 0;
      const report = await runInstallPreflight({
        system,
        localState: local("not_installed"),
        fetchImpl: async () => { calls += 1; return releaseHead()(); }
      });
      assert.equal(report.status, "blocked", name);
      assert.ok(report.blockers.some((item) => item.code === code), name);
      assert.equal(calls, 0, name);
      assert.equal(report.network.asset_get_count, 0, name);
    }
  });

  it("blocks on a failed payload-free GitHub HEAD without saving data", async () => {
    let calls = 0;
    const report = await runInstallPreflight({
      system: readySystem(),
      localState: local("not_installed"),
      fetchImpl: async (_url, options) => {
        calls += 1;
        assert.equal(options.method, "HEAD");
        throw new Error("offline");
      }
    });

    assert.equal(report.status, "blocked");
    assert.equal(calls, 1);
    assert.ok(report.blockers.some((item) => item.code === "GITHUB_RELEASE_UNREACHABLE"));
    assert.equal(report.network.head_requests, 1);
    assert.equal(report.network.payloads_saved, 0);
    assert.equal(report.network.product_assets_downloaded, 0);
  });

  it("maps every local-state-first route and keeps healthy-current as a strict no-op", async () => {
    const cases = [
      [local("not_installed"), "not_installed", "request_fresh_install_approval"],
      [local("healthy_local", { channel: "stable", product_version: "v0.4.1" }), "healthy_current", "report_noop"],
      [local("healthy_local", { channel: "stable", product_version: "v0.4.0" }), "update_available", "request_update_approval"],
      [local("repair_required", { rollback_available: true }), "repair_required", "request_repair_approval"],
      [local("legacy_migration_required"), "legacy_migration_required", "request_legacy_migration_approval"]
    ];
    for (const [input, expectedState, expectedAction] of cases) {
      const report = await runInstallPreflight({ system: readySystem(), localState: input, fetchImpl: releaseHead() });
      assert.equal(report.local_state.status, expectedState);
      assert.equal(report.next_action.action, expectedAction);
      assert.equal(report.next_action.writes_now, false);
      assert.equal(report.next_action.product_asset_download_now, false);
      assert.equal(report.next_action.registration_now, false);
    }
  });

  it("keeps healthy-current as a strict no-op when every install dependency is unavailable", async () => {
    let calls = 0;
    const report = await runInstallPreflight({
      system: readySystem({
        platform: "win32",
        arch: "ia32",
        nodeVersion: null,
        pythonVersion: null,
        gitVersion: null,
        commands: { gh: false, curl: false, shasum: false, sha256sum: false, tar: false, codex: false, claude: false },
        tempAccess: false,
        targetParentAccess: false,
        tempAvailableBytes: 0,
        targetAvailableBytes: 0
      }),
      localState: local("healthy_local", { channel: "stable", product_version: "v0.4.1" }),
      fetchImpl: async (...args) => { calls += 1; return releaseHead()(...args); }
    });

    assertSchema(report);
    assert.equal(calls, 1);
    assert.equal(report.status, "ready");
    assert.equal(report.local_state.status, "healthy_current");
    assert.equal(report.next_action.action, "report_noop");
    assert.deepEqual(report.blockers, []);
    assert.deepEqual(report.fallbacks, []);
    const productChecks = report.checks.filter((item) => !["local_state", "target_channel", "github_network"].includes(item.id));
    assert.ok(productChecks.length > 0);
    assert.ok(productChecks.every((item) => item.status === "not_run" && item.required === false));
    assert.deepEqual(report.network, {
      head_requests: 1,
      asset_get_count: 0,
      payloads_saved: 0,
      product_assets_downloaded: 0
    });
  });

  it("fails closed when the local version is ahead of Stable or the active channel mismatches", async () => {
    let aheadCalls = 0;
    const ahead = await runInstallPreflight({
      localState: local("healthy_local", { channel: "stable", product_version: "v0.5.0" }),
      fetchImpl: async (...args) => { aheadCalls += 1; return releaseHead("v0.4.1")(...args); }
    });
    assertSchema(ahead);
    assert.equal(aheadCalls, 1);
    assert.equal(ahead.status, "blocked");
    assert.equal(ahead.local_state.status, "unknown_or_unverifiable");
    assert.ok(ahead.local_state.evidence.includes("local_version_is_ahead_of_latest_stable"));

    let mismatchCalls = 0;
    const mismatch = await runInstallPreflight({
      channel: "stable",
      localState: local("healthy_local", { channel: "uat", product_version: "v0.4.1" }),
      fetchImpl: async (...args) => { mismatchCalls += 1; return releaseHead()(...args); }
    });
    assertSchema(mismatch);
    assert.equal(mismatchCalls, 0);
    assert.equal(mismatch.status, "blocked");
    assert.equal(mismatch.local_state.status, "unknown_or_unverifiable");
    assert.ok(mismatch.blockers.some((item) => item.code === "LOCAL_CHANNEL_MISMATCH"));
  });

  it("rejects UAT preflight without environment checks or network access", async () => {
    let calls = 0;
    const report = await runInstallPreflight({
      channel: "uat",
      localState: local("not_installed"),
      fetchImpl: async (...args) => { calls += 1; return releaseHead()(...args); }
    });

    assertSchema(report);
    assert.equal(calls, 0);
    assert.equal(report.status, "blocked");
    assert.deepEqual(report.target, { channel: "uat", evozeus_home: join(homedir(), ".evozeus") });
    assert.ok(report.blockers.some((item) => item.code === "PREFLIGHT_CHANNEL_UNSUPPORTED"));
    assert.ok(report.checks.filter((item) => item.kind === "dependency").every((item) => item.status === "not_run"));
    assert.equal(report.network.head_requests, 0);
  });

  it("stops unknown local state before network access", async () => {
    let calls = 0;
    const report = await runInstallPreflight({
      system: readySystem(),
      localState: local("unknown_or_unverifiable"),
      fetchImpl: async () => { calls += 1; return releaseHead()(); }
    });

    assert.equal(report.status, "blocked");
    assert.equal(report.local_state.status, "unknown_or_unverifiable");
    assert.equal(calls, 0);
    assert.equal(report.next_action.allowed, false);
  });
});

describe("local state inspection", () => {
  it("distinguishes fresh, legacy, broken, unknown, and healthy local evidence", () =>
    withTempRoot((root) => {
      const fresh = join(root, "fresh");
      assert.equal(inspectLocalInstallState({ evozeusHome: fresh }).status, "not_installed");

      const legacy = join(root, "legacy");
      mkdirSync(legacy, { recursive: true });
      writeFileSync(join(legacy, "install-manifest.json"), "{}\n");
      assert.equal(inspectLocalInstallState({ evozeusHome: legacy }).status, "legacy_migration_required");

      const unknown = join(root, "unknown");
      mkdirSync(unknown, { recursive: true });
      writeFileSync(join(unknown, "active-channel.json"), "{invalid\n");
      assert.equal(inspectLocalInstallState({ evozeusHome: unknown }).status, "unknown_or_unverifiable");

      const dangling = join(root, "dangling");
      mkdirSync(join(dangling, "bin"), { recursive: true });
      symlinkSync(join(root, "missing-cli-target"), join(dangling, "bin", "evozeus"));
      const danglingState = inspectLocalInstallState({ evozeusHome: dangling });
      assert.equal(danglingState.status, "unknown_or_unverifiable");
      assert.ok(danglingState.evidence.includes("bin_unsafe_node"));

      const unclassified = join(root, "unclassified");
      mkdirSync(unclassified, { recursive: true });
      writeFileSync(join(unclassified, "update-policy.json"), "{}\n");
      const unclassifiedState = inspectLocalInstallState({ evozeusHome: unclassified });
      assert.equal(unclassifiedState.status, "unknown_or_unverifiable");
      assert.ok(unclassifiedState.evidence.includes("unclassified_entries_in_evozeus_home"));

      const current = join(root, "current");
      writeInstalledState(current);
      const healthy = inspectLocalInstallState({
        evozeusHome: current,
        cliRunner: (_path, command) => command === "version"
          ? { ok: true, data: { health: "healthy", product_version: "v0.4.1" } }
          : { ok: true, data: { doctor_verdict: "ready" } }
      });
      assert.equal(healthy.status, "healthy_local");

      const broken = inspectLocalInstallState({
        evozeusHome: current,
        cliRunner: (_path, command) => command === "version"
          ? { ok: true, data: { health: "component_mismatch", product_version: "v0.4.1" } }
          : { ok: true, data: { doctor_verdict: "repair_required" } }
      });
      assert.equal(broken.status, "repair_required");

      const unsafeChannelState = inspectLocalInstallState({
        evozeusHome: current,
        cliRunner: (_path, command) => command === "version"
          ? { ok: true, data: { health: "state_unverifiable", product_version: "v0.4.1" } }
          : { ok: true, data: { doctor_verdict: "repair_required" } }
      });
      assert.equal(unsafeChannelState.status, "unknown_or_unverifiable");
      assert.ok(unsafeChannelState.evidence.includes("version_reports_unsafe_channel_state"));

      const external = join(root, "external-home");
      const externalCore = join(root, "outside-component-root");
      writeInstalledState(external, { componentRoot: externalCore });
      let externalCalls = 0;
      const externalState = inspectLocalInstallState({
        evozeusHome: external,
        cliRunner: () => { externalCalls += 1; return null; }
      });
      assert.equal(externalState.status, "unknown_or_unverifiable");
      assert.ok(externalState.evidence.includes("component_root_outside_install_root_or_unsafe"));
      assert.equal(externalCalls, 0);

      const symlinked = join(root, "symlinked-cli-home");
      const externalCli = join(root, "outside-cli.mjs");
      writeFileSync(externalCli, "fixture\n");
      writeInstalledState(symlinked, { cliSymlinkTarget: externalCli });
      let symlinkCalls = 0;
      const symlinkState = inspectLocalInstallState({
        evozeusHome: symlinked,
        cliRunner: () => { symlinkCalls += 1; return null; }
      });
      assert.equal(symlinkState.status, "unknown_or_unverifiable");
      assert.ok(symlinkState.evidence.includes("installed_core_cli_unsafe"));
      assert.equal(symlinkCalls, 0);
    }));
});

describe("release integration", () => {
  it("publishes the standalone checker and matching checksum before product installation", () => {
    assert.match(RELEASE_WORKFLOW, /cp scripts\/evozeus-install-preflight\.mjs evozeus-install-preflight\.mjs/);
    assert.match(RELEASE_WORKFLOW, /shasum -a 256 evozeus-install-preflight\.mjs > evozeus-install-preflight\.mjs\.sha256/);
    assert.match(RELEASE_WORKFLOW, /gh release upload[^\n]+evozeus-install-preflight\.mjs[^\n]+evozeus-install-preflight\.mjs\.sha256/);
  });
});
