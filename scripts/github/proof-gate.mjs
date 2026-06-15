#!/usr/bin/env node
import {
  classifyLabels,
  formatList,
  getPullRequest,
  listPullRequestFiles,
  replaceManagedLabels,
  upsertMarkerComment
} from "./shared.mjs";
import { evaluateProofGate } from "./gate-logic.mjs";

const pr = getPullRequest();
const body = pr.body || "";
const files = await listPullRequestFiles(pr.number);
const { labels } = classifyLabels(files);
const result = evaluateProofGate({ labels, body });
const managedLabels = ["proof:mock-only", "proof:needed", "proof:supplied", "candidate:needs-evidence"];

await replaceManagedLabels(pr.number, managedLabels, result.labels);

await upsertMarkerComment(
  pr.number,
  "<!-- evozeus-proof-gate-report -->",
  `## EvoZeus Proof Gate

**Mode:** ${process.env.EVOZEUS_ENFORCE_PROOF === "1" ? "enforce" : "dry-run"}

**Proof labels**
${formatList(result.labels)}

**Missing or weak fields**
${formatList(result.missing)}

**Next action**
${result.missing.length || result.mockOnly ? "- Add real behavior proof, not only mocks/lint/CI." : "- Proof fields are present. Maintainer still decides sufficiency."}`
);

if (process.env.EVOZEUS_ENFORCE_PROOF === "1" && (result.missing.length > 0 || result.mockOnly)) {
  process.exitCode = 1;
}

console.log(`Proof labels: ${result.labels.join(", ") || "none"}`);
