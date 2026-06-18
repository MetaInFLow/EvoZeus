---
name: evozeus-development
description: Use when developing EvoZeus itself, changing repository files, branch structure, PR templates, docs, scripts, runtime code, governance, or agent-facing instructions.
---

# EvoZeus-Development

Development work must keep EvoZeus small, reviewable, and evidence-backed. One PR should have one primary purpose, one primary layer, and one validation story.

## Branch Rule

Use this branch format:

```text
codex/<type>/<yyyymmdd>-<component>-<summary>
```

Allowed `type`:

| Type | Use for |
| --- | --- |
| `dev` | New runtime, CLI, script, or product behavior |
| `bug` | Defect fix with reproduction or evidence |
| `refactor` | Behavior-preserving restructuring tied to an issue or maintainer request |
| `docs` | Documentation, templates, governance text, or skill docs |
| `test` | Test coverage tied to a behavior, Case, or bug |
| `chore` | Maintenance that does not change user-visible behavior |

Allowed `component` should match the touched surface where possible: `runtime`, `factor`, `verdict-card`, `doctor`, `tui`, `companion`, `workspace`, `docs`, `governance`, `skill`, `infra`, or `template`.

Examples:

```text
codex/docs/20260616-skill-scenario-routing
codex/refactor/20260616-infra-python-package
codex/bug/20260616-runtime-report-id
```

## Scope Rule

Pick one primary layer:

| Layer | Typical files |
| --- | --- |
| Semantic | `docs/reference/`, terminology, ontology, evidence grading |
| Execution | `src/`, `tests/`, runtime scripts, CLI behavior |
| Governance | `SKILL.md`, `skills/`, `.github/`, `CONTRIBUTING.md`, `docs/governance/`, PR checks |

Do not mix Candidate content, runtime code, and governance changes in one PR unless it is a maintainer-approved migration and the PR states why a cross-layer change is necessary.

## Naming Rule

- User-facing local scenario skill names must start with `EvoZeus-`; keep frontmatter `name` and folder paths lowercase `evozeus-*` to pass skill validation.
- Reuse project terms from `../../docs/governance/terminology-glossary.md` and `../../docs/reference/ontology.md`.
- Prefer canonical names such as `Session`, `Evidence`, `Case`, `Verdict`, `Artifact`, `Candidate`, `Factor`, `Pattern`, `Rejected Pattern`, and `Environment Rule`.
- New variables, filenames, headings, schemas, and CLI flags should make the layer and artifact kind obvious.
- Do not introduce synonyms for established project terms unless the terminology glossary is updated in the same governance PR.

## High-Risk Surfaces

These require explicit evidence and maintainer-level attention:

- `SKILL.md`
- `skills/`
- `.github/` templates or workflows
- `scripts/github/`
- `SECURITY.md`
- `schemas/`
- `candidates/core/`
- `candidates/reviewed/`
- `docs/governance/privacy-and-redaction.md`
- `docs/reference/ontology.md`
- `docs/reference/evidence-grading.md`
- future schema, redaction, upload, session ingestion, or candidate extraction code

## Pre-Submit Gate

Before staging or pushing, run the checks that match the change:

```bash
python3 scripts/check_pr_ready.py --base <base-ref>
git diff --check
```

For this repository, docs and governance-only work should at minimum pass:

```bash
python3 -m py_compile scripts/check_pr_ready.py
python3 scripts/check_pr_ready.py --base <base-ref>
git diff --check
```

If issue templates changed, also parse `.github/ISSUE_TEMPLATE/*.yml` with a YAML parser available in the local environment.

## PR Template

Use the closest template:

| Work | Template |
| --- | --- |
| Default or mixed docs/governance | `../../.github/PULL_REQUEST_TEMPLATE.md` |
| Candidate, Case, Pattern, Factor, or Artifact | `../../.github/PULL_REQUEST_TEMPLATE/candidate_submission.md` |
| Runtime, CLI, script, or behavior | `../../.github/PULL_REQUEST_TEMPLATE/code_change.md` |
| Ontology, schema, protocol, compatibility | `../../.github/PULL_REQUEST_TEMPLATE/schema_change.md` |
| `SKILL.md`, `skills/`, prompts, or agent instructions | `../../.github/PULL_REQUEST_TEMPLATE/skill_instruction_change.md` |
