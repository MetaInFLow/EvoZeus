#!/usr/bin/env node
import {
  formatList,
  getPullRequest,
  getRepo,
  github,
  replaceManagedLabels,
  upsertMarkerComment
} from "./shared.mjs";

const LIMITS = {
  externalAuthor: 3,
  botBranchFamily: 5,
  governance: 2,
  highRisk: 1
};

function branchFamily(ref) {
  const parts = ref.split("/");
  if (parts[0] === "codex" && parts.length >= 3) {
    return parts.slice(0, 3).join("/");
  }
  return parts.slice(0, 2).join("/");
}

const pr = getPullRequest();
const { owner, repo } = getRepo();
const openPrs = await github(`/repos/${owner}/${repo}/pulls?state=open&per_page=100`);
const authorOpen = openPrs.filter((item) => item.user.login === pr.user.login);
const family = branchFamily(pr.head.ref);
const familyOpen = openPrs.filter((item) => branchFamily(item.head.ref) === family);
const currentLabels = (pr.labels || []).map((label) => label.name);
const isGovernance = currentLabels.includes("type:governance") || pr.title.match(/\bgovernance|RFC|template|workflow\b/i);
const isHighRisk = currentLabels.some((label) => label.startsWith("risk:")) || currentLabels.includes("triage:owner-only");
const violations = [];

if (authorOpen.length > LIMITS.externalAuthor) {
  violations.push(`author has ${authorOpen.length} open PRs; limit ${LIMITS.externalAuthor}`);
}
if (familyOpen.length > LIMITS.botBranchFamily) {
  violations.push(`branch family ${family} has ${familyOpen.length} open PRs; limit ${LIMITS.botBranchFamily}`);
}
if (isGovernance) {
  const governanceOpen = openPrs.filter((item) => item.title.match(/\bgovernance|RFC|template|workflow\b/i));
  if (governanceOpen.length > LIMITS.governance) {
    violations.push(`governance queue has ${governanceOpen.length} open PRs; limit ${LIMITS.governance}`);
  }
}
if (isHighRisk) {
  const highRiskOpen = authorOpen.filter((item) => item.number !== pr.number && item.title.match(/\bskill|workflow|schema|privacy|security|token\b/i));
  if (highRiskOpen.length >= LIMITS.highRisk) {
    violations.push(`author already has ${highRiskOpen.length} other high-risk-looking PR(s); limit ${LIMITS.highRisk}`);
  }
}

await replaceManagedLabels(pr.number, ["triage:too-many-prs"], violations.length > 0 ? ["triage:too-many-prs"] : []);

await upsertMarkerComment(
  pr.number,
  "<!-- evozeus-queue-guard-report -->",
  `## EvoZeus Queue Guard

**Mode:** ${process.env.EVOZEUS_ENFORCE_QUEUE === "1" ? "enforce" : "dry-run"}

**Author open PRs:** ${authorOpen.length}

**Branch family:** ${family}

**Branch family open PRs:** ${familyOpen.length}

**Violations**
${formatList(violations)}

**Next action**
${violations.length ? "- Reduce open PR queue or ask maintainers to override." : "- Queue limits are currently OK."}`
);

if (process.env.EVOZEUS_ENFORCE_QUEUE === "1" && violations.length > 0) {
  await github(`/repos/${owner}/${repo}/pulls/${pr.number}`, {
    method: "PATCH",
    body: { state: "closed" }
  });
}

console.log(`Queue violations: ${violations.length}`);
