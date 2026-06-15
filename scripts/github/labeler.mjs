#!/usr/bin/env node
import {
  addLabels,
  classifyLabels,
  formatList,
  getPullRequest,
  listPullRequestFiles,
  replaceManagedLabels,
  upsertMarkerComment
} from "./shared.mjs";

const pr = getPullRequest();
const files = await listPullRequestFiles(pr.number);
const result = classifyLabels(files);
const candidateLabels = result.labels.filter((label) => label.startsWith("candidate:"));
const replaceableLabels = result.labels.filter((label) => !label.startsWith("candidate:"));
const structuralLabels = [
  "type:code",
  "type:candidate",
  "type:schema",
  "type:skill-instruction",
  "type:governance",
  "type:docs",
  "type:workflow",
  "type:dependency",
  "risk:agent-behavior",
  "risk:skill-entry",
  "risk:schema-break",
  "risk:workflow",
  "risk:github-token",
  "risk:dependency",
  "risk:governance",
  "size:S",
  "size:M",
  "size:L"
];

await replaceManagedLabels(pr.number, structuralLabels, replaceableLabels.filter((label) => structuralLabels.includes(label)));
await addLabels(pr.number, candidateLabels);

await upsertMarkerComment(
  pr.number,
  "<!-- evozeus-labeler-report -->",
  `## EvoZeus Labeler Report

PR type/risk labels were updated from changed files.

**Surfaces**
${formatList(result.surfaces)}

**Labels**
${formatList(result.labels)}

**Changed lines**
- ${result.changedLines}`
);

console.log(`Applied labels: ${result.labels.join(", ")}`);
