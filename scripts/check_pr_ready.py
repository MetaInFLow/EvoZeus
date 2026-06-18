#!/usr/bin/env python3
"""Lightweight local PR readiness checks for EvoZeus."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PR_TEMPLATE = ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md"
PR_TEMPLATE_DIR = ROOT / ".github" / "PULL_REQUEST_TEMPLATE"

BRANCH_PATTERN = re.compile(
    r"^(?:codex/)?"
    r"(dev|bug|refactor|docs|test|chore)/"
    r"\d{8}-"
    r"(runtime|factor|verdict-card|doctor|tui|companion|workspace|docs|governance|skill|infra|template)"
    r"-[a-z0-9]+(?:-[a-z0-9]+){0,6}$"
)
SKILL_NAME_PATTERN = re.compile(r"^[a-z0-9-]+$")

REQUIRED_TEMPLATE_HEADINGS = [
    "## Summary",
    "## Linked Context",
    "## PR Scope",
    "## EvoZeus Evidence Proof",
    "## Verdict / Review Gate",
    "## Tests and Validation",
    "## Risk Checklist",
    "## AI-Assisted Work",
    "## Current Review State",
    "## Privacy Checklist",
    "## Operational Checklist",
]

REQUIRED_PROOF_FIELDS = [
    "- Behavior, Case, or issue addressed:",
    "- Real environment or session tested:",
    "- Exact steps or command run after this patch:",
    "- Evidence after change:",
    "- Observed result after change:",
    "- What was not tested:",
    "- Proof limitations or constraints:",
]

SPECIALIZED_TEMPLATES = {
    "candidate_submission.md": [
        "## Candidate summary",
        "## Source session",
        "## Evidence",
        "## Operational rule",
        "## When NOT to use",
        "## Counterexamples",
        "## Privacy checklist",
    ],
    "code_change.md": [
        "## PR type",
        "## Problem",
        "## Scope",
        "## Real behavior proof",
        "## Tests",
        "## Rollback plan",
    ],
    "schema_change.md": [
        "## Schema changed",
        "## Breaking or non-breaking",
        "## Migration needed?",
        "## Validator updated?",
        "## Examples updated?",
    ],
    "skill_instruction_change.md": [
        "## Instruction surface changed",
        "## Agent behavior before / after",
        "## Safety boundary",
        "## Prompt injection risk",
        "## Rollback plan",
    ],
    "governance_change.md": [
        "## Governance surface changed",
        "## Linked RFC",
        "## Problem with current rule",
        "## Proposed rule",
        "## Rollback plan",
    ],
    "docs_example_change.md": [
        "## Docs / Example Change Summary",
        "## Evidence source",
        "## Privacy checklist",
        "## Link and render checks",
    ],
}

LAYER_PATHS = {
    "semantic": (
        "docs/reference/",
        "docs/governance/terminology-glossary.md",
        "schemas/",
        "candidates/",
        "examples/valid-candidates/",
        "examples/invalid-candidates/",
    ),
    "execution": (
        "scripts/",
    ),
    "governance": (
        ".github/",
        "CONTRIBUTING.md",
        "CODE_OF_CONDUCT.md",
        "SKILL.md",
        "skills/",
        "docs/governance/",
        "docs/rfcs/",
        "ZEUS_STATUS.yml",
        "scripts/check_pr_ready.py",
        "scripts/github/",
    ),
}

REQUIRED_GOVERNANCE_FILES = [
    ".github/CODEOWNERS",
    ".github/labeler.yml",
    ".github/workflows/labeler.yml",
    ".github/workflows/proof-gate.yml",
    ".github/workflows/privacy-scan.yml",
    ".github/workflows/dirty-pr-check.yml",
    ".github/workflows/queue-guard.yml",
    ".github/workflows/candidate-schema-check.yml",
    "docs/governance/pr-routing-policy.md",
    "docs/governance/candidate-ontology.md",
    "docs/governance/evidence-policy.md",
    "docs/governance/labels.md",
    "docs/governance/protected-paths.md",
    "docs/governance/maintainer-playbook.md",
    "docs/governance/auto-triage-policy.md",
    "docs/governance/github-settings.md",
    "schemas/candidate.schema.json",
    "package.json",
    "package-lock.json",
    "scripts/github/gate-logic.mjs",
    "scripts/github/gate-tests.mjs",
    "scripts/github/candidate-validator.mjs",
    "scripts/github/labeler.mjs",
    "scripts/github/proof-gate.mjs",
    "scripts/github/privacy-scan.mjs",
    "scripts/github/dirty-pr-check.mjs",
    "scripts/github/queue-guard.mjs",
    "scripts/github/candidate-schema-check.mjs",
]


def run_git(*args: str, check: bool = True) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or completed.stdout.strip())
    return completed.stdout.strip()


def error(message: str, errors: list[str]) -> None:
    errors.append(message)


def check_branch(errors: list[str]) -> None:
    branch = run_git("branch", "--show-current")
    if not branch:
        error("branch: detached HEAD is not allowed for PR readiness", errors)
        return
    if not BRANCH_PATTERN.match(branch):
        error(
            "branch: expected codex/<type>/<yyyymmdd>-<component>-<summary>; "
            f"got {branch!r}",
            errors,
        )


def check_diff_whitespace(errors: list[str]) -> None:
    completed = subprocess.run(
        ["git", "diff", "--check"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if completed.returncode != 0:
        error("diff: git diff --check failed\n" + completed.stdout + completed.stderr, errors)


def changed_files(base: str) -> list[str]:
    merge_base = run_git("merge-base", base, "HEAD")
    output = run_git("diff", "--name-only", f"{merge_base}...HEAD")
    return [line for line in output.splitlines() if line]


def classify_layers(files: list[str]) -> set[str]:
    layers: set[str] = set()
    for path in files:
        if path == "scripts/check_pr_ready.py" or path.startswith("scripts/github/"):
            layers.add("governance")
            continue
        for layer, prefixes in LAYER_PATHS.items():
            if any(path == prefix or path.startswith(prefix) for prefix in prefixes):
                layers.add(layer)
    return layers


def check_scope(base: str, allow_cross_layer: bool, errors: list[str]) -> None:
    files = changed_files(base)
    layers = classify_layers(files)
    if len(layers) > 1 and not allow_cross_layer:
        error(
            "scope: changed files cross multiple layers "
            f"{sorted(layers)}; pass --allow-cross-layer only for intentional migrations",
            errors,
        )


def check_template(path: Path, errors: list[str]) -> None:
    if not path.exists():
        error(f"template: missing {path.relative_to(ROOT)}", errors)
        return
    text = path.read_text(encoding="utf-8")
    for heading in REQUIRED_TEMPLATE_HEADINGS:
        if heading not in text:
            error(f"template: missing heading {heading!r}", errors)
    for field in REQUIRED_PROOF_FIELDS:
        if field not in text:
            error(f"template: missing evidence proof field {field!r}", errors)
    for filename, headings in SPECIALIZED_TEMPLATES.items():
        template_path = PR_TEMPLATE_DIR / filename
        if not template_path.exists():
            error(f"template: missing specialized template {template_path.relative_to(ROOT)}", errors)
            continue
        specialized_text = template_path.read_text(encoding="utf-8")
        for heading in headings:
            if heading not in specialized_text:
                error(
                    f"template: {template_path.relative_to(ROOT)} missing heading {heading!r}",
                    errors,
                )


def check_governance_files(errors: list[str]) -> None:
    for rel_path in REQUIRED_GOVERNANCE_FILES:
        if not (ROOT / rel_path).exists():
            error(f"governance: missing required file {rel_path}", errors)

    workflows = ROOT / ".github" / "workflows"
    if workflows.exists():
        for workflow in sorted(workflows.glob("*.yml")):
            text = workflow.read_text(encoding="utf-8")
            if "permissions:" not in text:
                error(f"workflow: {workflow.relative_to(ROOT)} must declare permissions", errors)
            if "pull_request_target:" in text and "pull-requests: write" in text:
                if "actions/checkout@v4" in text and "github.event.pull_request.head" in text:
                    error(
                        f"workflow: {workflow.relative_to(ROOT)} must not checkout PR head under pull_request_target",
                        errors,
                    )


def check_skill_frontmatter(errors: list[str]) -> None:
    paths = [ROOT / "SKILL.md"]
    skills_dir = ROOT / "skills"
    if skills_dir.exists():
        paths.extend(sorted(skills_dir.glob("*/SKILL.md")))

    for path in paths:
        text = path.read_text(encoding="utf-8")
        rel_path = path.relative_to(ROOT)
        lines = text.splitlines()
        if not lines or lines[0] != "---":
            error(f"skill: {rel_path} missing YAML frontmatter", errors)
            continue

        try:
            end = lines[1:].index("---") + 1
        except ValueError:
            error(f"skill: {rel_path} has unterminated YAML frontmatter", errors)
            continue

        frontmatter = "\n".join(lines[: end + 1])
        if len(frontmatter) > 1024:
            error(f"skill: {rel_path} frontmatter exceeds 1024 characters", errors)

        fields: dict[str, str] = {}
        for line in lines[1:end]:
            key, separator, value = line.partition(":")
            if separator:
                fields[key.strip()] = value.strip().strip("\"'")

        name = fields.get("name")
        description = fields.get("description")
        if not name:
            error(f"skill: {rel_path} missing name", errors)
        elif not SKILL_NAME_PATTERN.match(name):
            error(f"skill: {rel_path} name must use lowercase letters, numbers, and hyphens", errors)

        if not description:
            error(f"skill: {rel_path} missing description", errors)
        elif not description.startswith("Use when"):
            error(f"skill: {rel_path} description must start with 'Use when'", errors)


def check_pr_body(path: Path, errors: list[str]) -> None:
    if not path.exists():
        error(f"pr-body: missing file {path}", errors)
        return
    text = path.read_text(encoding="utf-8")
    for heading in REQUIRED_TEMPLATE_HEADINGS[:9]:
        if heading not in text:
            error(f"pr-body: missing heading {heading!r}", errors)
    for field in REQUIRED_PROOF_FIELDS:
        if field not in text:
            error(f"pr-body: missing evidence proof field {field!r}", errors)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/main", help="base ref for scope checks")
    parser.add_argument("--pr-body", type=Path, help="optional PR body markdown to validate")
    parser.add_argument(
        "--allow-cross-layer",
        action="store_true",
        help="allow semantic/execution/governance changes in one PR",
    )
    args = parser.parse_args()

    errors: list[str] = []
    check_branch(errors)
    check_diff_whitespace(errors)
    check_scope(args.base, args.allow_cross_layer, errors)
    check_template(PR_TEMPLATE, errors)
    check_governance_files(errors)
    check_skill_frontmatter(errors)
    if args.pr_body:
        check_pr_body(args.pr_body, errors)

    if errors:
        print("PR readiness check failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1

    print("PR readiness check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
