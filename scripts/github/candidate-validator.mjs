import fs from "node:fs";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const STATUSES = new Set(["draft", "community", "reviewed", "core", "deprecated", "rejected"]);

export function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkJsonFiles(full);
    return full.endsWith(".json") ? [full] : [];
  });
}

export function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadCandidateSchema(root = process.cwd()) {
  return loadJson(path.join(root, "schemas", "candidate.schema.json"));
}

export function createCandidateValidator(schema = loadCandidateSchema()) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  return ajv.compile(schema);
}

function lifecycleErrors(data, file) {
  const errors = [];
  if (!STATUSES.has(data.status)) {
    errors.push(`${file}: invalid status ${data.status}`);
    return errors;
  }
  const level = data.evidence?.level;
  if (data.status === "community" && level < 2) {
    errors.push(`${file}: community candidates require evidence Level 2+`);
  }
  if (data.status === "reviewed" && level < 3) {
    errors.push(`${file}: reviewed candidates require evidence Level 3+`);
  }
  if (data.status === "core" && level < 4) {
    errors.push(`${file}: core candidates require evidence Level 4+`);
  }
  return errors;
}

export function validateCandidateData(data, file = "candidate.json", validator = createCandidateValidator()) {
  const errors = [];
  if (!validator(data)) {
    for (const error of validator.errors || []) {
      const field = error.instancePath || "/";
      errors.push(`${file}: ${field} ${error.message}`);
    }
  }
  errors.push(...lifecycleErrors(data, file));
  return errors;
}

export function validateCandidateFile(file, root = process.cwd(), validator = createCandidateValidator(loadCandidateSchema(root))) {
  let data;
  try {
    data = loadJson(file);
  } catch (error) {
    return [`${path.relative(root, file)}: invalid JSON: ${error.message}`];
  }
  return validateCandidateData(data, path.relative(root, file), validator);
}
