#!/usr/bin/env node
import path from "node:path";

import {
  createCandidateValidator,
  loadJson,
  loadCandidateSchema,
  validateCandidateFile,
  walkJsonFiles
} from "./candidate-validator.mjs";

const ROOT = process.cwd();
const schema = loadCandidateSchema(ROOT);
const validator = createCandidateValidator(schema);

const schemaFiles = walkJsonFiles(path.join(ROOT, "schemas"));
const candidateFiles = [
  ...walkJsonFiles(path.join(ROOT, "candidates")),
  ...walkJsonFiles(path.join(ROOT, "examples", "valid-candidates"))
];
const invalidExampleFiles = walkJsonFiles(path.join(ROOT, "examples", "invalid-candidates"));
const errors = [];

for (const file of schemaFiles) {
  try {
    loadJson(file);
  } catch (error) {
    errors.push(`${path.relative(ROOT, file)}: schema JSON invalid: ${error.message}`);
  }
}

for (const file of candidateFiles) {
  errors.push(...validateCandidateFile(file, ROOT, validator));
}

for (const file of invalidExampleFiles) {
  const invalidErrors = validateCandidateFile(file, ROOT, validator);
  if (invalidErrors.length === 0) {
    errors.push(`${path.relative(ROOT, file)}: invalid example unexpectedly passed validation`);
  }
}

if (errors.length > 0) {
  console.error("Candidate schema check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Candidate schema check passed (${candidateFiles.length} candidate file(s), ${schemaFiles.length} schema file(s), ${invalidExampleFiles.length} invalid example(s))`
);
