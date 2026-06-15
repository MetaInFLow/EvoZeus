#!/usr/bin/env node
import {
  formatList,
  getPullRequest,
  listPullRequestFiles,
  replaceLabelPrefixes,
  upsertMarkerComment
} from "./shared.mjs";

const PATTERNS = [
  ["private key", /-----BEGIN (RSA |OPENSSH |EC |DSA |)?PRIVATE KEY-----/i],
  ["github token", /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/],
  ["openai key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["aws access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["bearer token", /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i],
  ["dotenv content", /^\+\s*[A-Z0-9_]{3,}=.+$/m],
  ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ["phone-like number", /\b(?:\+?\d[\d\s().-]{8,}\d)\b/],
  ["private mac path", /\/Users\/[A-Za-z0-9._-]+\/[^\s)"']*/],
  ["internal url", /https?:\/\/[A-Za-z0-9.-]*(?:internal|corp|intranet|local)[A-Za-z0-9.-]*/i]
];

const pr = getPullRequest();
const files = await listPullRequestFiles(pr.number);
const findings = [];

for (const file of files) {
  const patch = file.patch || "";
  for (const [name, pattern] of PATTERNS) {
    if (pattern.test(patch)) {
      findings.push(`${file.filename}: ${name}`);
    }
  }
}

if (findings.length > 0) {
  await replaceLabelPrefixes(pr.number, ["risk:privacy", "candidate:needs-redaction"], ["risk:privacy", "candidate:needs-redaction"]);
}

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
