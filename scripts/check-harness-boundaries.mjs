#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const CURRENT_HARNESS_DIR = ".evozeus-wrapper";
const LEGACY_HARNESS_DIR = ".evozeus_evoinfra";

export function findHarnessBoundaryViolations(paths) {
  const violations = [];

  for (const rawPath of paths) {
    const path = String(rawPath).replaceAll("\\", "/").replace(/^\.\//, "");
    const segments = path.split("/").filter(Boolean);

    for (const directory of [CURRENT_HARNESS_DIR, LEGACY_HARNESS_DIR]) {
      const index = segments.indexOf(directory);
      if (index === -1) continue;

      if (directory === LEGACY_HARNESS_DIR || index !== 0) {
        violations.push({ path, directory, reason: directory === LEGACY_HARNESS_DIR ? "legacy_layout" : "nested_harness" });
      }
    }
  }

  return violations;
}

export function listRepositoryPaths(repoRoot) {
  const output = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repoRoot, encoding: "utf8" }
  );
  return output.split("\0").filter(Boolean);
}

function main() {
  const repoRoot = resolve(process.argv[2] ?? process.cwd());
  const violations = findHarnessBoundaryViolations(listRepositoryPaths(repoRoot));

  if (violations.length > 0) {
    console.error("Harness boundary check failed. Only an independent Git repo root may own .evozeus-wrapper/.");
    for (const violation of violations) {
      console.error(`- ${violation.path} (${violation.reason})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Harness boundary check passed: no nested or legacy Harness directories detected.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}

