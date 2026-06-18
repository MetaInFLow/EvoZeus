#!/usr/bin/env node

import { readFileSync } from "node:fs";

function readStdin() {
  return readFileSync(0, "utf8").trim();
}

function parseReport(input) {
  if (!input) {
    throw new Error("Expected bootstrap report JSON on stdin.");
  }
  return JSON.parse(input);
}

function diagnose(report) {
  const release = report.release ?? {};
  const nextAction = report.next_action ?? {};
  const reason = String(nextAction.reason ?? "");
  const resolvedRef = String(release.resolved_ref ?? release.latest_tag ?? "resolved source");

  if (reason === "install_or_update" || release.status === "outdated" || release.status === "not_installed") {
    return {
      doctor_verdict: "install_or_update",
      requires_user_approval: true,
      next_step: `Ask the user before updating local EvoZeus to ${resolvedRef}. Do not checkout, clone, or overwrite work without approval.`
    };
  }

  if (reason === "run_judgment" || release.status === "up_to_date") {
    return {
      doctor_verdict: "ready_for_protocol_judgment",
      requires_user_approval: true,
      next_step:
        "Ask whether to run protocol-only judgment: read this repository's SKILL.md and output only a Session Verdict Card."
    };
  }

  return {
    doctor_verdict: "needs_human_decision",
    requires_user_approval: true,
    next_step: "Ask the user which EvoZeus path to take next. Do not run runtime, scanner, factor, GitHub, or upload flows."
  };
}

function printDiagnosis(diagnosis) {
  for (const [key, value] of Object.entries(diagnosis)) {
    console.log(`${key}: ${value}`);
  }
}

try {
  printDiagnosis(diagnose(parseReport(readStdin())));
} catch (error) {
  console.error(`evozeus-doctor: ${error.message}`);
  process.exit(1);
}
