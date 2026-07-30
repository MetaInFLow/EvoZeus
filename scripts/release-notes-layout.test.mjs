import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test("keeps versioned Release Notes out of the repository root", () => {
  const rootNotes = readdirSync(ROOT).filter((name) => /^release-notes-v\d+\.\d+\.\d+\.md$/.test(name));
  assert.deepEqual(rootNotes, []);

  const notes = readdirSync(join(ROOT, "docs", "releases")).filter((name) => /^v\d+\.\d+\.\d+\.md$/.test(name));
  assert.ok(notes.length > 0);
});

test("resolves tag Release Notes from docs/releases", () => {
  const workflow = readFileSync(join(ROOT, ".github", "workflows", "release.yml"), "utf8");
  assert.match(workflow, /RELEASE_NOTES_DIR:\s*docs\/releases/);
  assert.match(workflow, /--notes-file "\$\{RELEASE_NOTES_DIR\}\/\$\{GITHUB_REF_NAME\}\.md"/);
  assert.match(workflow, /test -s "\$\{RELEASE_NOTES_DIR\}\/\$\{GITHUB_REF_NAME\}\.md"/);
});
