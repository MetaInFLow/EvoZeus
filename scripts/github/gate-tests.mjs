#!/usr/bin/env node
import assert from "node:assert/strict";

import {
  evaluateProofGate,
  planLabelPrefixUpdate,
  planManagedLabelUpdate
} from "./gate-logic.mjs";
import { validateCandidateData } from "./candidate-validator.mjs";
import { privacyFindingsForPatch } from "./privacy-scan.mjs";

function testProofGateRequiresFilledFields() {
  const blankCodeTemplate = `## Problem

## Scope

## Real behavior proof

- Command run:
- Environment:
- Input:
- Output before:
- Output after:
- Artifact generated:
- What was not tested:

## Tests

## Rollback plan
`;

  const result = evaluateProofGate({
    labels: ["type:code"],
    body: blankCodeTemplate
  });

  assert(result.labels.includes("proof:needed"));
  assert(!result.labels.includes("proof:supplied"));
  assert(result.missing.includes("real behavior proof fields are empty"));
}

function testProofGateAcceptsFilledBehaviorProof() {
  const filledBody = `## Problem

Fix queue proof.

## Scope

Governance gate only.

## Real behavior proof

- Command run: node scripts/github/gate-tests.mjs
- Environment: local checkout
- Input: blank template body
- Output before: proof:supplied
- Output after: proof:needed
- Artifact generated: none
- What was not tested: live PR comments

## Tests

node scripts/github/gate-tests.mjs

## Rollback plan

Revert the gate logic change.
`;

  const result = evaluateProofGate({
    labels: ["type:code"],
    body: filledBody
  });

  assert.deepEqual(result.labels, ["proof:supplied"]);
  assert.deepEqual(result.missing, []);
}

function testLabelPrefixUpdateRemovesStaleLabels() {
  const update = planLabelPrefixUpdate({
    current: ["triage:dirty-pr", "proof:needed", "risk:privacy", "type:docs"],
    prefixes: ["triage:", "risk:"],
    desired: []
  });

  assert.deepEqual(update.add.sort(), []);
  assert.deepEqual(update.remove.sort(), ["risk:privacy", "triage:dirty-pr"]);
}

function testManagedLabelUpdateIgnoresUnmanagedDesiredLabels() {
  const update = planManagedLabelUpdate({
    current: ["risk:privacy", "type:docs"],
    managed: ["risk:privacy"],
    desired: ["risk:privacy", "type:workflow"]
  });

  assert.deepEqual(update.add, []);
  assert.deepEqual(update.remove, []);
}

function testInvalidCandidateIsRejected() {
  const invalid = {
    id: "candidate-opinion-only-tip",
    title: "Always be more careful",
    type: "pattern",
    status: "rejected",
    source_session: "",
    observed_behavior: "",
    evidence: {
      level: 0,
      summary: "No observed behavior."
    },
    pattern: "Be careful.",
    operational_rule: "",
    when_to_use: [],
    when_not_to_use: [],
    counterexamples: [],
    privacy_review: {
      raw_logs_included: false,
      secrets_removed: true,
      private_paths_removed: true,
      customer_data_removed: true
    }
  };

  const errors = validateCandidateData(invalid, "invalid-candidate.json");
  assert(errors.some((error) => error.includes("source_session")));
  assert(errors.some((error) => error.includes("operational_rule")));
  assert(errors.some((error) => error.includes("when_to_use")));
}

function testPrivacyScanIgnoresIsoDatesInAddedLines() {
  const isoDate = ["2026", "06", "16"].join("-");
  const findings = privacyFindingsForPatch(
    "docs/governance/changelog.md",
    `@@ -1,3 +1,4 @@
 ## Changelog
+## ${isoDate}
+- Tightened governance gates.`
  );

  assert.deepEqual(findings, []);
}

function testPrivacyScanFlagsPhoneLikeAddedLines() {
  const phone = ["+1", "(555)", "123", "4567"];
  const findings = privacyFindingsForPatch(
    "examples/report.md",
    `@@ -1,2 +1,3 @@
+Call ${phone[0]} ${phone[1]} ${phone[2]}-${phone[3]} before rollout.`
  );

  assert.deepEqual(findings, ["examples/report.md: phone-like number"]);
}

testProofGateRequiresFilledFields();
testProofGateAcceptsFilledBehaviorProof();
testLabelPrefixUpdateRemovesStaleLabels();
testManagedLabelUpdateIgnoresUnmanagedDesiredLabels();
testInvalidCandidateIsRejected();
testPrivacyScanIgnoresIsoDatesInAddedLines();
testPrivacyScanFlagsPhoneLikeAddedLines();

console.log("GitHub gate tests passed");
