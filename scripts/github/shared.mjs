import fs from "node:fs";
import { LABEL_DEFS } from "./label-defs.mjs";

const API = "https://api.github.com";

export function readEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is required");
  }
  return JSON.parse(fs.readFileSync(eventPath, "utf8"));
}

export function getPullRequest(event = readEvent()) {
  if (!event.pull_request) {
    throw new Error("This script must run on a pull_request event");
  }
  return event.pull_request;
}

export function getRepo() {
  const full = process.env.GITHUB_REPOSITORY;
  if (!full || !full.includes("/")) {
    throw new Error("GITHUB_REPOSITORY must be owner/repo");
  }
  const [owner, repo] = full.split("/");
  return { owner, repo };
}

export function isDryRun() {
  return process.env.EVOZEUS_DRY_RUN !== "0";
}

export async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required");
  }
  const response = await fetch(`${API}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 204) {
    return null;
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || text || response.statusText;
    const error = new Error(`${options.method || "GET"} ${path} failed: ${message}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function listPullRequestFiles(prNumber) {
  const { owner, repo } = getRepo();
  const files = [];
  for (let page = 1; page < 20; page += 1) {
    const batch = await github(`/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

export async function listIssueLabels(issueNumber) {
  const { owner, repo } = getRepo();
  return github(`/repos/${owner}/${repo}/issues/${issueNumber}/labels?per_page=100`);
}

export async function ensureLabel(name) {
  const def = LABEL_DEFS[name];
  if (!def) return;
  const { owner, repo } = getRepo();
  const [color, description] = def;
  try {
    await github(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
  } catch (error) {
    if (error.status !== 404) throw error;
    await github(`/repos/${owner}/${repo}/labels`, {
      method: "POST",
      body: { name, color, description }
    });
  }
}

export async function addLabels(issueNumber, labels) {
  const unique = [...new Set(labels)].filter(Boolean);
  if (unique.length === 0) return;
  for (const label of unique) {
    await ensureLabel(label);
  }
  const { owner, repo } = getRepo();
  await github(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
    method: "POST",
    body: { labels: unique }
  });
}

export async function replaceLabelPrefixes(issueNumber, prefixes, labels) {
  const wanted = new Set(labels);
  const current = await listIssueLabels(issueNumber);
  const { owner, repo } = getRepo();
  for (const label of current) {
    if (prefixes.some((prefix) => label.name.startsWith(prefix)) && !wanted.has(label.name)) {
      await github(`/repos/${owner}/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(label.name)}`, {
        method: "DELETE"
      });
    }
  }
  await addLabels(issueNumber, labels);
}

export async function upsertMarkerComment(issueNumber, marker, body) {
  const { owner, repo } = getRepo();
  const comments = await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`);
  const existing = comments.find((comment) => comment.body?.includes(marker));
  const fullBody = `${marker}\n\n${body}`;
  if (existing) {
    await github(`/repos/${owner}/${repo}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: { body: fullBody }
    });
  } else {
    await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      body: { body: fullBody }
    });
  }
}

export function fileNames(files) {
  return files.map((file) => file.filename || file);
}

export function changedLineCount(files) {
  return files.reduce((sum, file) => sum + (file.additions || 0) + (file.deletions || 0), 0);
}

export function surfaceForPath(path) {
  if (path === "SKILL.md" || path.startsWith("skills/")) return "skill";
  if (path.startsWith(".github/workflows/") || path.startsWith("scripts/github/")) return "workflow";
  if (path.startsWith(".github/") || path === "CONTRIBUTING.md" || path === "CODE_OF_CONDUCT.md") return "governance";
  if (path === "ZEUS_STATUS.yml" || path.startsWith("docs/governance/") || path.startsWith("docs/rfcs/")) return "governance";
  if (path.startsWith("schemas/")) return "schema";
  if (path.startsWith("candidates/") || path.startsWith("examples/valid-candidates/")) return "candidate";
  if (path.startsWith("docs/") || path === "README.md" || path.startsWith("examples/")) return "docs";
  if (path.includes("package-lock") || path.includes("pnpm-lock") || path.includes("yarn.lock")) return "dependency";
  return "code";
}

export function classifyLabels(files) {
  const paths = fileNames(files);
  const surfaces = new Set(paths.map(surfaceForPath));
  const labels = new Set();

  for (const surface of surfaces) {
    if (surface === "skill") {
      labels.add("type:skill-instruction");
      labels.add("risk:agent-behavior");
      labels.add("risk:skill-entry");
    } else if (surface === "workflow") {
      labels.add("type:workflow");
      labels.add("risk:workflow");
      labels.add("risk:github-token");
    } else if (surface === "governance") {
      labels.add("type:governance");
      labels.add("risk:governance");
    } else if (surface === "schema") {
      labels.add("type:schema");
      labels.add("risk:schema-break");
    } else if (surface === "candidate") {
      labels.add("type:candidate");
      labels.add("candidate:community");
    } else if (surface === "docs") {
      labels.add("type:docs");
    } else if (surface === "dependency") {
      labels.add("type:dependency");
      labels.add("risk:dependency");
    } else {
      labels.add("type:code");
    }
  }

  if (paths.some((path) => path.includes("privacy") || path.includes("redaction"))) {
    labels.add("risk:privacy");
  }

  const changedLines = changedLineCount(files);
  if (changedLines <= 120 && paths.length <= 8) labels.add("size:S");
  else if (changedLines <= 600 && paths.length <= 25) labels.add("size:M");
  else labels.add("size:L");

  return { labels: [...labels].sort(), surfaces: [...surfaces].sort(), changedLines };
}

export function hasHeading(body, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+${escaped}\\s*$`, "im").test(body || "");
}

export function lineFieldFilled(body, field) {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}:\\s*\\S`, "i").test(body || "");
}

export function formatList(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- none";
}
