#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";

const REQUIRED_COMPONENTS = [
  "SKILL.md",
  "skills/index/SKILL.md",
  "skills/evozeus-install-registration/SKILL.md",
  "scripts/evozeus-doctor.mjs"
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
  const infra = sectionOf(report, "infra", "runtime");
  const factors = sectionOf(report, "factors", "factor");

  return {
    components_status: missingComponents.length > 0 ? "incomplete" : "complete",
    missing_components: missingComponents.length > 0 ? missingComponents.join(", ") : "none",
    infra_release_status: statusOf(infra, "release"),
    infra_download_status: statusOf(infra, "download"),
    infra_smoke_status: statusOf(infra, "smoke"),
    factor_release_status: statusOf(factors, "release"),
    factor_download_status: statusOf(factors, "download"),
    factor_smoke_status: statusOf(factors, "smoke")
  };
}

function hasStatus(status, expected) {
  return expected.includes(status);
}

function runtimeEvidenceIsIncomplete(diagnosis) {
  return [
    diagnosis.infra_release_status,
    diagnosis.infra_download_status,
    diagnosis.infra_smoke_status,
    diagnosis.factor_release_status,
    diagnosis.factor_download_status,
    diagnosis.factor_smoke_status
  ].some((status) => status === "unknown" || status === "skipped" || status === "not_run");
}

function diagnose(report) {
  const release = report.release ?? {};
  const nextAction = report.next_action ?? {};
  const reason = String(nextAction.reason ?? "");
  const resolvedRef = String(release.resolved_ref ?? release.latest_tag ?? "resolved source");
  const missingComponents = checkComponents();
  const diagnosis = buildBaseDiagnosis(report, missingComponents);
  const infra = sectionOf(report, "infra", "runtime");
  const factors = sectionOf(report, "factors", "factor");

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

  if (hasStatus(diagnosis.infra_release_status, ["outdated", "not_installed"])) {
    return {
      ...diagnosis,
      doctor_verdict: "install_or_update",
      requires_user_approval: true,
      next_step: `Ask the user before updating scanner/runner infra to ${refOf(infra)}. Do not checkout, clone, or overwrite work without approval.`
    };
  }

  if (hasStatus(diagnosis.infra_download_status, ["missing", "outdated", "not_installed"])) {
    return {
      ...diagnosis,
      doctor_verdict: "install_or_update",
      requires_user_approval: true,
      next_step: `Ask the user before installing scanner/runner infra from ${refOf(infra)}. Do not clone or overwrite local repos without approval.`
    };
  }

  if (hasStatus(diagnosis.factor_release_status, ["outdated", "not_installed"])) {
    return {
      ...diagnosis,
      doctor_verdict: "install_or_update",
      requires_user_approval: true,
      next_step: `Ask the user before updating official factors to ${refOf(factors)}. Do not install or overwrite factor packs without approval.`
    };
  }

  if (hasStatus(diagnosis.factor_download_status, ["missing", "outdated", "not_installed"])) {
    return {
      ...diagnosis,
      doctor_verdict: "install_or_update",
      requires_user_approval: true,
      next_step: `Ask the user before downloading official factors from ${refOf(factors)}. Do not install or overwrite factor packs without approval.`
    };
  }

  if (diagnosis.infra_smoke_status === "failed") {
    return {
      ...diagnosis,
      doctor_verdict: "fix_environment",
      requires_user_approval: true,
      next_step: `Fix scanner/runner infra smoke failure: ${summaryOf(infra.smoke)}. Rerun doctor before protocol judgment.`
    };
  }

  if (diagnosis.factor_smoke_status === "failed") {
    return {
      ...diagnosis,
      doctor_verdict: "fix_environment",
      requires_user_approval: true,
      next_step: `Fix downloaded official factor smoke failure: ${summaryOf(factors.smoke)}. Rerun doctor before protocol judgment.`
    };
  }

  if (runtimeEvidenceIsIncomplete(diagnosis)) {
    return {
      ...diagnosis,
      doctor_verdict: "collect_runtime_evidence",
      requires_user_approval: true,
      next_step:
        "Run scanner/runner infra and official factor checks, including release, download, and smoke evidence, then rerun doctor."
    };
  }

  if (reason === "run_judgment" || release.status === "up_to_date") {
    return {
      ...diagnosis,
      doctor_verdict: "ready_for_protocol_judgment",
      requires_user_approval: true,
      next_step:
        "Ask whether to run protocol-only judgment: read this repository's SKILL.md and output only a Session Verdict Card."
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
