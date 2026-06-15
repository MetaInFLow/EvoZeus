#!/usr/bin/env node
import {
  classifyLabels,
  formatList,
  getPullRequest,
  hasHeading,
  lineFieldFilled,
  listPullRequestFiles,
  replaceLabelPrefixes,
  upsertMarkerComment
} from "./shared.mjs";

const pr = getPullRequest();
const body = pr.body || "";
const files = await listPullRequestFiles(pr.number);
const { labels } = classifyLabels(files);
const missing = [];
let mockOnly = false;

const has = (heading) => hasHeading(body, heading);

if (labels.includes("type:candidate")) {
  for (const heading of ["Candidate summary", "Source session", "Evidence", "Operational rule", "When NOT to use", "Counterexamples", "Privacy checklist"]) {
    if (!has(heading)) missing.push(`missing candidate section: ${heading}`);
  }
}

if (labels.includes("type:code") || labels.includes("type:workflow")) {
  for (const heading of ["Problem", "Scope", "Real behavior proof", "Tests", "Rollback plan"]) {
    if (!has(heading)) missing.push(`missing code/workflow section: ${heading}`);
  }
}

if (labels.includes("type:skill-instruction")) {
  for (const heading of ["Instruction surface changed", "Agent behavior before / after", "Safety boundary", "Prompt injection risk", "Rollback plan"]) {
    if (!has(heading)) missing.push(`missing skill instruction section: ${heading}`);
  }
}

if (labels.includes("type:schema")) {
  for (const heading of ["Schema changed", "Breaking or non-breaking", "Migration needed?", "Validator updated?", "Examples updated?"]) {
    if (!has(heading)) missing.push(`missing schema section: ${heading}`);
  }
}

if (labels.includes("type:governance")) {
  if (!has("Linked RFC") && !body.match(/RFC|maintainer discussion/i)) {
    missing.push("governance change needs Linked RFC or maintainer discussion");
  }
}

const evidenceFields = [
  "Command run",
  "Real environment or session tested",
  "Exact steps or command run after this patch",
  "Evidence after change",
  "Observed result after change"
];
const filledEvidence = evidenceFields.some((field) => lineFieldFilled(body, field));
if (!filledEvidence && !has("Real behavior proof") && !has("EvoZeus Evidence Proof")) {
  missing.push("real behavior proof is missing");
}

if (body.match(/\b(mock|mocks|unit tests?|lint|typecheck|type check|ci only)\b/i) && !body.match(/\b(real session|local reproduction|manual run|command run|observed result)\b/i)) {
  mockOnly = true;
}

const proofLabels = [];
if (mockOnly) proofLabels.push("proof:mock-only");
if (missing.length > 0) proofLabels.push("proof:needed");
if (!mockOnly && missing.length === 0) proofLabels.push("proof:supplied");

if (missing.some((item) => item.includes("candidate"))) {
  proofLabels.push("candidate:needs-evidence");
}

await replaceLabelPrefixes(pr.number, ["proof:"], proofLabels);
if (proofLabels.includes("candidate:needs-evidence")) {
  await replaceLabelPrefixes(pr.number, ["candidate:needs-evidence"], ["candidate:needs-evidence"]);
}

await upsertMarkerComment(
  pr.number,
  "<!-- evozeus-proof-gate-report -->",
  `## EvoZeus Proof Gate

**Mode:** ${process.env.EVOZEUS_ENFORCE_PROOF === "1" ? "enforce" : "dry-run"}

**Proof labels**
${formatList(proofLabels)}

**Missing or weak fields**
${formatList(missing)}

**Next action**
${missing.length || mockOnly ? "- Add real behavior proof, not only mocks/lint/CI." : "- Proof fields are present. Maintainer still decides sufficiency."}`
);

if (process.env.EVOZEUS_ENFORCE_PROOF === "1" && (missing.length > 0 || mockOnly)) {
  process.exitCode = 1;
}

console.log(`Proof labels: ${proofLabels.join(", ") || "none"}`);
