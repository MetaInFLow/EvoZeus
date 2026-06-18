import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const SCRIPT = new URL("./evozeus-doctor.mjs", import.meta.url);

function runDoctor(report) {
  return spawnSync(process.execPath, [SCRIPT.pathname], {
    input: `${JSON.stringify(report)}\n`,
    encoding: "utf8"
  });
}

describe("evozeus-doctor", () => {
  it("guides outdated bootstrap reports toward user-approved update", () => {
    const result = runDoctor({
      release: {
        status: "outdated",
        source: "main_fallback",
        resolved_ref: "main",
        resolved_url: "https://github.com/MetaInFLow/EvoZeus/tree/main",
        local_ref: "feature@abc123"
      },
      next_action: {
        requires_user_approval: true,
        reason: "install_or_update"
      }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /doctor_verdict: install_or_update/);
    assert.match(result.stdout, /requires_user_approval: true/);
    assert.match(result.stdout, /Ask the user before updating local EvoZeus to main/);
  });

  it("guides ready bootstrap reports toward protocol-only judgment", () => {
    const result = runDoctor({
      release: {
        status: "up_to_date",
        source: "release",
        resolved_ref: "v1.0.0",
        resolved_url: "https://github.com/MetaInFLow/EvoZeus/releases/tag/v1.0.0",
        local_ref: "main@abc123"
      },
      next_action: {
        requires_user_approval: true,
        reason: "run_judgment"
      }
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /doctor_verdict: ready_for_protocol_judgment/);
    assert.match(result.stdout, /Session Verdict Card/);
  });
});
