#!/usr/bin/env node
import {
  formatList,
  getPullRequest,
  listPullRequestFiles,
  replaceManagedLabels,
  upsertMarkerComment
} from "./shared.mjs";
import { privacyFindingsForPatch } from "./gate-logic.mjs";

const pr = getPullRequest();
const files = await listPullRequestFiles(pr.number);
const findings = [];

for (const file of files) {
  findings.push(...privacyFindingsForPatch(file.filename, file.patch || ""));
}

const managedLabels = ["risk:privacy", "candidate:needs-redaction"];
await replaceManagedLabels(pr.number, managedLabels, findings.length > 0 ? managedLabels : []);

await upsertMarkerComment(
  pr.number,
  "<!-- evozeus-privacy-scan-report -->",
  `## EvoZeus Privacy Scan

**Mode:** ${process.env.EVOZEUS_ENFORCE_PRIVACY === "1" ? "enforce" : "dry-run"}

**Findings**
${formatList(findings)}

**Next action**
${findings.length ? "- Redact or explain these findings before maintainer review." : "- No simple privacy pattern matched in the PR diff."}`
);

if (process.env.EVOZEUS_ENFORCE_PRIVACY === "1" && findings.length > 0) {
  process.exitCode = 1;
}

console.log(`Privacy findings: ${findings.length}`);
