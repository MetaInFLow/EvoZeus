import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  alignPluginHosts,
  inspectPluginHosts,
  planPluginAlignment
} from "./evozeus-hosts.mjs";

const SOURCE_ROOT = fileURLToPath(new URL("..", import.meta.url));

function withTempHome(callback) {
  const root = mkdtempSync(join(tmpdir(), "evozeus-hosts-"));
  try {
    return callback({ root, evozeusHome: join(root, ".evozeus") });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("EvoZeus plugin host alignment", () => {
  it("plans one active plugin for both supported hosts without writing", () =>
    withTempHome(({ evozeusHome }) => {
      const plan = planPluginAlignment({
        evozeusHome,
        sourceRoot: SOURCE_ROOT,
        channel: "uat",
        productVersion: "v0.4.0",
        commit: "a".repeat(40),
        hosts: ["codex", "claude"]
      });

      assert.equal(plan.writes_now, false);
      assert.equal(plan.plugin_id, "evozeus");
      assert.equal(plan.display_name, "EvoZeus UAT");
      assert.match(plan.versions.codex, /^0\.4\.0-uat\+codex\.uat-a{12}$/);
      assert.match(plan.versions.claude, /^0\.4\.0-uat\.a{12}$/);
      assert.deepEqual(Object.keys(plan.hosts), ["codex", "claude"]);
      assert.equal(existsSync(evozeusHome), false);
    }));

  it("stages host marketplaces, registers one plugin id, and records exact provenance", () =>
    withTempHome(({ evozeusHome }) => {
      const commands = [];
      const result = alignPluginHosts({
        evozeusHome,
        sourceRoot: SOURCE_ROOT,
        channel: "uat",
        productVersion: "v0.4.0",
        commit: "b".repeat(40),
        hosts: ["codex", "claude"],
        runCommand(command, args) {
          commands.push([command, ...args]);
          return { status: 0, stdout: "evozeus installed\n", stderr: "" };
        }
      });

      assert.equal(result.status, "ready_after_new_session");
      assert.equal(result.plugin_id, "evozeus");
      assert.ok(commands.some((command) => command.join(" ").includes("codex plugin add evozeus@evozeus")));
      assert.ok(commands.some((command) => command.join(" ").includes("claude plugin install evozeus@evozeus")));

      const codexManifestPath = join(
        evozeusHome,
        "hosts/codex-marketplace/plugins/evozeus/.codex-plugin/plugin.json"
      );
      const claudeManifestPath = join(
        evozeusHome,
        "hosts/claude-marketplace/plugins/evozeus/.claude-plugin/plugin.json"
      );
      const claudeMarketplacePath = join(
        evozeusHome,
        "hosts/claude-marketplace/.claude-plugin/marketplace.json"
      );
      const codexManifest = JSON.parse(readFileSync(codexManifestPath, "utf8"));
      const claudeManifest = JSON.parse(readFileSync(claudeManifestPath, "utf8"));
      const claudeMarketplace = JSON.parse(readFileSync(claudeMarketplacePath, "utf8"));
      const state = JSON.parse(readFileSync(join(evozeusHome, "hosts/plugin-state.json"), "utf8"));

      assert.equal(codexManifest.name, "evozeus");
      assert.equal(codexManifest.interface.displayName, "EvoZeus UAT");
      assert.match(codexManifest.interface.defaultPrompt[0], /批准前不要读取历史/);
      assert.match(codexManifest.interface.defaultPrompt[1], /独立 Skillware Repo 接入 CoEvolve Harness/);
      assert.match(codexManifest.version, /-uat\+codex\.uat-/);
      assert.match(claudeManifest.version, /-uat\./);
      assert.equal(
        claudeMarketplace.plugins[0].description,
        "With explicit approval, turn local Agent history into an AI usage profile and attach a CoEvolve Harness to an independent Skillware repository."
      );
      assert.equal(state.active_channel, "uat");
      assert.equal(state.commit, "b".repeat(40));
      assert.deepEqual(Object.keys(state.hosts), ["codex", "claude"]);
    }));

  it("reports a channel mismatch instead of treating stale host plugins as ready", () =>
    withTempHome(({ evozeusHome }) => {
      alignPluginHosts({
        evozeusHome,
        sourceRoot: SOURCE_ROOT,
        channel: "uat",
        productVersion: "v0.4.0",
        commit: "c".repeat(40),
        hosts: ["codex"],
        runCommand() {
          return { status: 0, stdout: "installed", stderr: "" };
        }
      });

      const report = inspectPluginHosts({
        evozeusHome,
        channel: "stable",
        productVersion: "v0.4.0",
        commit: "d".repeat(40),
        availableHosts: ["codex"],
        runCommand() {
          return { status: 0, stdout: "evozeus", stderr: "" };
        }
      });

      assert.equal(report.status, "plugin_mismatch");
      assert.equal(report.hosts.codex.status, "mismatch");
    }));
});
