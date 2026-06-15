#!/usr/bin/env node
import {
  addLabels,
  classifyLabels,
  formatList,
  getPullRequest,
  listPullRequestFiles,
  replaceLabelPrefixes,
  upsertMarkerComment
} from "./shared.mjs";

const pr = getPullRequest();
const files = await listPullRequestFiles(pr.number);
const result = classifyLabels(files);
const candidateLabels = result.labels.filter((label) => label.startsWith("candidate:"));
const replaceableLabels = result.labels.filter((label) => !label.startsWith("candidate:"));

await replaceLabelPrefixes(pr.number, ["type:", "risk:", "size:"], replaceableLabels);
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
