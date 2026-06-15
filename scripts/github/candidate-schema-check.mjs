#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REQUIRED = [
  "id",
  "title",
  "type",
  "status",
  "source_session",
  "observed_behavior",
  "evidence",
  "pattern",
  "operational_rule",
  "when_to_use",
  "when_not_to_use",
  "counterexamples",
  "privacy_review"
];
const TYPES = new Set(["skill", "factor", "pattern", "habit", "environment_rule", "report_template", "negative_pattern"]);
const STATUSES = new Set(["draft", "community", "reviewed", "core", "deprecated", "rejected"]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return full.endsWith(".json") ? [full] : [];
  });
}

function fail(file, message, errors) {
  errors.push(`${path.relative(ROOT, file)}: ${message}`);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateCandidate(file, errors) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, `invalid JSON: ${error.message}`, errors);
    return;
  }

  for (const field of REQUIRED) {
    if (!(field in data)) fail(file, `missing required field ${field}`, errors);
  }

  if (!nonEmptyString(data.id) || !data.id.startsWith("candidate-")) fail(file, "id must start with candidate-", errors);
  if (!nonEmptyString(data.title) || data.title.length < 8) fail(file, "title must be at least 8 characters", errors);
  if (!TYPES.has(data.type)) fail(file, `invalid type ${data.type}`, errors);
  if (!STATUSES.has(data.status)) fail(file, `invalid status ${data.status}`, errors);

  for (const field of ["source_session", "observed_behavior", "pattern", "operational_rule"]) {
    if (!nonEmptyString(data[field])) fail(file, `${field} must be non-empty`, errors);
  }

  for (const field of ["when_to_use", "when_not_to_use", "counterexamples"]) {
    if (!Array.isArray(data[field]) || data[field].length === 0) fail(file, `${field} must be a non-empty array`, errors);
  }

  if (!data.evidence || typeof data.evidence !== "object") {
    fail(file, "evidence must be an object", errors);
  } else {
    if (!Number.isInteger(data.evidence.level) || data.evidence.level < 0 || data.evidence.level > 5) {
      fail(file, "evidence.level must be an integer from 0 to 5", errors);
    }
    if (!nonEmptyString(data.evidence.summary)) fail(file, "evidence.summary must be non-empty", errors);
    if (data.status === "community" && data.evidence.level < 2) fail(file, "community candidates require evidence Level 2+", errors);
    if (data.status === "reviewed" && data.evidence.level < 3) fail(file, "reviewed candidates require evidence Level 3+", errors);
    if (data.status === "core" && data.evidence.level < 4) fail(file, "core candidates require evidence Level 4+", errors);
  }

  const privacy = data.privacy_review || {};
  if (privacy.raw_logs_included !== false) fail(file, "privacy_review.raw_logs_included must be false", errors);
  for (const field of ["secrets_removed", "private_paths_removed", "customer_data_removed"]) {
    if (privacy[field] !== true) fail(file, `privacy_review.${field} must be true`, errors);
  }
}

const schemaFiles = walk(path.join(ROOT, "schemas"));
const candidateFiles = [
  ...walk(path.join(ROOT, "candidates")),
  ...walk(path.join(ROOT, "examples", "valid-candidates"))
];
const errors = [];

for (const file of schemaFiles) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, `schema JSON invalid: ${error.message}`, errors);
  }
}

for (const file of candidateFiles) {
  validateCandidate(file, errors);
}

if (errors.length > 0) {
  console.error("Candidate schema check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Candidate schema check passed (${candidateFiles.length} candidate file(s), ${schemaFiles.length} schema file(s))`);
