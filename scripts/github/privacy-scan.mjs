#!/usr/bin/env node
import { pathToFileURL } from "node:url";
import {
  formatList,
  getPullRequest,
  listPullRequestFiles,
  replaceManagedLabels,
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

function addedPatchText(patch) {
  return (patch || "")
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .join("\n");
}

function hasPrivacyMatch(name, pattern, text) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(regex)) {
    if (name === "phone-like number" && /^\d{4}-\d{2}-\d{2}$/.test(match[0])) {
      continue;
    }
    return true;
  }
  return false;
}

export function privacyFindingsForPatch(filename, patch) {
  const added = addedPatchText(patch);
  const findings = [];
  for (const [name, pattern] of PATTERNS) {
    if (hasPrivacyMatch(name, pattern, added)) {
      findings.push(`${filename}: ${name}`);
    }
  }
  return findings;
}

async function main() {
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
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
