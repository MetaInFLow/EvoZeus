#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { getPullRequest, listIssueLabels, upsertMarkerComment } from "./shared.mjs";

const RESPONSES = {
  "proof:needed": "needs-evidence.md",
  "proof:mock-only": "mock-only-proof.md",
  "triage:too-many-prs": "too-many-prs.md",
  "triage:dirty-pr": "dirty-pr.md",
  "triage:rfc-needed": "rfc-needed.md",
  "triage:owner-only": "owner-only.md",
  "candidate:needs-redaction": "needs-redaction.md"
};

const pr = getPullRequest();
const labels = await listIssueLabels(pr.number);
const names = labels.map((label) => label.name);
const matched = names.filter((name) => RESPONSES[name]);
if (matched.length === 0) {
  console.log("No auto-response labels matched");
  process.exit(0);
}

const chunks = [];
for (const label of matched) {
  const file = path.join(process.cwd(), "scripts", "github", "responses", RESPONSES[label]);
  chunks.push(fs.readFileSync(file, "utf8").trim());
}

await upsertMarkerComment(
  pr.number,
  "<!-- evozeus-auto-response -->",
  `## EvoZeus Auto Response

${chunks.join("\n\n---\n\n")}`
);

console.log(`Auto-response matched: ${matched.join(", ")}`);
