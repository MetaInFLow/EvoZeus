#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const REQUIRED_COMPONENTS = [
  "SKILL.md",
  "skills/using-evozeus/SKILL.md",
  "skills/maintain-evozeus/SKILL.md",
  "packages/runtime/src/evozeus_runtime/cli/main.py",
  "packs/session-signal/scripts/validate_official_factor_spec.py",
  "scripts/evozeus-cli.mjs",
  "scripts/evozeus-install.mjs",
  "scripts/evozeus-doctor.mjs"
];

const READY_CAPABILITIES = [
  "CLI capability router",
  "explicit-input session analysis",
  "co-evolution harness handoff plan",
  "protocol-only judgment",
  "health doctor diagnostics",
  "component and release checks",
  "built-in Runtime health check",
  "built-in Session Signal health check"
];

const APPROVAL_REQUIRED_CAPABILITIES = [
  "workspace scan",
  "runtime execution",
  "factor execution on user data",
  "report file generation",
  "artifact preservation",
  "GitHub issue/PR/public artifact"
];

function readStdin() {
  return readFileSync(0, "utf8").trim();
}

function parseReport(input) {
  if (!input) {
    throw new Error("Expected bootstrap report JSON on stdin.");
  }
  return JSON.parse(input);
}

function checkComponents(root = process.cwd()) {
  return REQUIRED_COMPONENTS.filter((component) => !existsSync(new URL(component, `file://${root.replace(/\/$/, "")}/`)));
}

function statusOf(section, key) {
  return String(section?.[key]?.status ?? "unknown");
}

function refOf(section) {
  return String(section?.release?.resolved_ref ?? section?.release?.latest_tag ?? "resolved source");
}

function summaryOf(probe) {
  return String(probe?.summary ?? probe?.command ?? "no failure summary provided");
}

function sectionOf(report, primaryKey, fallbackKey) {
  return report[primaryKey] ?? report[fallbackKey] ?? {};
}

function buildBaseDiagnosis(report, missingComponents) {
  const runtime = sectionOf(report, "runtime", "infra");
  const sessionSignal = sectionOf(report, "session_signal", "factors");

  return {
    components_status: missingComponents.length > 0 ? "incomplete" : "complete",
    missing_components: missingComponents.length > 0 ? missingComponents.join(", ") : "none",
    runtime_distribution: "embedded_in_evozeus",
    runtime_smoke_status: statusOf(runtime, "smoke"),
    session_signal_distribution: "embedded_in_evozeus",
    session_signal_smoke_status: statusOf(sessionSignal, "smoke")
  };
}

function hasStatus(status, expected) {
  return expected.includes(status);
}

function runtimeEvidenceIsIncomplete(diagnosis) {
  return [
    diagnosis.runtime_smoke_status,
    diagnosis.session_signal_smoke_status
  ].some((status) => status === "unknown" || status === "skipped" || status === "not_run");
}

function optionalComponentWarnings(diagnosis) {
  const warnings = [];
  const incompleteStatuses = ["unknown", "skipped", "not_run", "failed"];

  if (incompleteStatuses.includes(diagnosis.runtime_smoke_status)) {
    warnings.push("built-in Runtime needs smoke evidence before runtime use");
  }

  if (incompleteStatuses.includes(diagnosis.session_signal_smoke_status)) {
    warnings.push("built-in Session Signal needs smoke evidence before factor use");
  }

  return warnings.length > 0 ? warnings.join("; ") : "none";
}

function diagnose(report) {
  const release = report.release ?? {};
  const nextAction = report.next_action ?? {};
  const reason = String(nextAction.reason ?? "");
  const resolvedRef = String(release.resolved_ref ?? release.latest_tag ?? "resolved source");
  const missingComponents = checkComponents();
  const diagnosis = buildBaseDiagnosis(report, missingComponents);
  const runtime = sectionOf(report, "runtime", "infra");
  const sessionSignal = sectionOf(report, "session_signal", "factors");

  if (missingComponents.length > 0) {
    return {
      ...diagnosis,
      doctor_verdict: "install_or_update",
      requires_user_approval: true,
      next_step: `Ask the user before installing or updating missing EvoZeus components from ${resolvedRef}.`
    };
  }

  if (reason === "install_or_update" || release.status === "outdated" || release.status === "not_installed") {
    return {
      ...diagnosis,
      doctor_verdict: "install_or_update",
      requires_user_approval: true,
      next_step: `Ask the user before updating local EvoZeus to ${resolvedRef}. Do not checkout, clone, or overwrite work without approval.`
    };
  }

  const runtimeRequested = reason === "runtime";

  if (runtimeRequested && diagnosis.runtime_smoke_status === "failed") {
    return {
      ...diagnosis,
      doctor_verdict: "fix_environment",
      requires_user_approval: true,
      next_step: `Fix the built-in Runtime smoke failure: ${summaryOf(runtime.smoke)}. Rerun Doctor before runtime use.`
    };
  }

  if (runtimeRequested && diagnosis.session_signal_smoke_status === "failed") {
    return {
      ...diagnosis,
      doctor_verdict: "fix_environment",
      requires_user_approval: true,
      next_step: `Fix the built-in Session Signal smoke failure: ${summaryOf(sessionSignal.smoke)}. Rerun Doctor before factor use.`
    };
  }

  if (runtimeRequested && runtimeEvidenceIsIncomplete(diagnosis)) {
    return {
      ...diagnosis,
      doctor_verdict: "collect_runtime_evidence",
      requires_user_approval: true,
      next_step:
        "Run the built-in Runtime and Session Signal smoke checks, then rerun Doctor."
    };
  }

  if (reason === "run_judgment" || release.status === "up_to_date") {
    return {
      ...diagnosis,
      available_capabilities: READY_CAPABILITIES.join("; "),
      approval_required_capabilities: APPROVAL_REQUIRED_CAPABILITIES.join("; "),
      optional_component_warnings: optionalComponentWarnings(diagnosis),
      doctor_verdict: "ready_for_protocol_judgment",
      requires_user_approval: true,
      next_step:
        "Report that EvoZeus is ready, then ask for the user's real task in normal language. Do not scan local sessions or write files without approval."
    };
  }

  return {
    ...diagnosis,
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
