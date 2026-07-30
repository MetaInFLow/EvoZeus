import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findHarnessBoundaryViolations } from "./check-harness-boundaries.mjs";

describe("Harness repository boundary", () => {
  it("allows the current Harness only at the Git repo root", () => {
    assert.deepEqual(
      findHarnessBoundaryViolations([
        ".evozeus-wrapper/wrapper.json",
        ".evozeus-wrapper/feedback-policy.json",
        "packages/runtime/src/main.py"
      ]),
      []
    );
  });

  it("rejects a nested Harness owned by a package, pack, or Skill", () => {
    assert.deepEqual(
      findHarnessBoundaryViolations([
        "packages/runtime/.evozeus-wrapper/wrapper.json",
        "packs/session-signal/.evozeus-wrapper/wrapper.json",
        "plugin/skills/review/.evozeus-wrapper/wrapper.json"
      ]).map(({ path, reason }) => ({ path, reason })),
      [
        { path: "packages/runtime/.evozeus-wrapper/wrapper.json", reason: "nested_harness" },
        { path: "packs/session-signal/.evozeus-wrapper/wrapper.json", reason: "nested_harness" },
        { path: "plugin/skills/review/.evozeus-wrapper/wrapper.json", reason: "nested_harness" }
      ]
    );
  });

  it("rejects the legacy Harness layout at any depth", () => {
    assert.deepEqual(
      findHarnessBoundaryViolations([
        ".evozeus_evoinfra/wrapper.json",
        "packs/example/.evozeus_evoinfra/wrapper.json"
      ]).map(({ path, reason }) => ({ path, reason })),
      [
        { path: ".evozeus_evoinfra/wrapper.json", reason: "legacy_layout" },
        { path: "packs/example/.evozeus_evoinfra/wrapper.json", reason: "legacy_layout" }
      ]
    );
  });
});

