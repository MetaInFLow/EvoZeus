#!/usr/bin/env node
import {
  addLabels,
  classifyLabels,
  fileNames,
  formatList,
  getPullRequest,
  listPullRequestFiles,
  upsertMarkerComment
} from "./shared.mjs";

const pr = getPullRequest();
const body = pr.body || "";
const files = await listPullRequestFiles(pr.number);
const paths = fileNames(files);
const { surfaces, changedLines } = classifyLabels(files);
const labels = [];
const reasons = [];

if (surfaces.length > 2) {
  labels.push("triage:dirty-pr");
  reasons.push(`changes ${surfaces.length} surfaces: ${surfaces.join(", ")}`);
}

if (changedLines > 1000 || paths.length > 40) {
  labels.push("triage:dirty-pr", "size:L");
  reasons.push(`large PR: ${paths.length} files, ${changedLines} changed lines`);
}

const protectedChanged = paths.some((path) =>
  path === "SKILL.md" ||
  path.startsWith("skills/") ||
  path.startsWith(".github/workflows/") ||
  path.startsWith("scripts/github/") ||
  path.startsWith("schemas/") ||
  path.startsWith("candidates/core/") ||
  path.startsWith("candidates/reviewed/")
);

if (protectedChanged) {
  labels.push("triage:owner-only");
  reasons.push("protected path changed");
}

if ((surfaces.includes("governance") || surfaces.includes("workflow")) && !body.match(/RFC|maintainer discussion|owner review/i)) {
  labels.push("triage:rfc-needed");
  reasons.push("governance/workflow change has no RFC or maintainer discussion marker");
}

if (body.match(/\brefactor\b/i) && !body.match(/bug|issue|maintainer request|behavior/i)) {
  labels.push("triage:refactor-only");
  reasons.push("appears refactor-only without linked behavior or maintainer request");
}

if (labels.length > 0) {
  await addLabels(pr.number, [...new Set(labels)]);
}

await upsertMarkerComment(
  pr.number,
  "<!-- evozeus-dirty-pr-report -->",
  `## EvoZeus Dirty PR Check

**Mode:** dry-run

**Surfaces**
${formatList(surfaces)}

**Reasons**
${formatList(reasons)}

**Next action**
${reasons.length ? "- Split the PR, add RFC context, or wait for owner review." : "- Scope shape is acceptable for automated triage."}`
);

console.log(`Dirty PR labels: ${[...new Set(labels)].join(", ") || "none"}`);
