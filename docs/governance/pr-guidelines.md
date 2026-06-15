# PR Guidelines

- Status: active
- Last updated: 2026-06-16

This document adapts the useful parts of OpenClaw's layered governance discipline to EvoZeus. OpenClaw optimizes for a high-volume code repository with automation and real behavior proof. EvoZeus currently optimizes for semantic clarity, evidence-backed contribution, and small governance-safe changes.

## Source Notes

OpenClaw references used for this adaptation:

- [OpenClaw CONTRIBUTING.md](https://github.com/openclaw/openclaw/blob/main/CONTRIBUTING.md)
- [OpenClaw pull request template](https://github.com/openclaw/openclaw/blob/main/.github/pull_request_template.md)
- [OpenClaw real behavior proof scripts](https://github.com/openclaw/openclaw/tree/main/scripts/github)

Do not copy OpenClaw's full bot, label, automerge, or release system yet. EvoZeus should first keep the rule set small enough for maintainers and agents to apply manually.

## Governance Stack

EvoZeus should evolve the PR system in this order:

```text
README / VISION
-> CONTRIBUTING
-> Issue templates
-> PR templates
-> Evidence proof gate
-> Label / auto-response policy
-> Review / repair assistant
-> CODEOWNERS
-> Release and promotion policy
```

The current repository implements the first five layers manually. Later automation may classify and request proof, but must not approve or merge without maintainer-controlled gates.

## Contribution Routing

| Contribution | Route |
| --- | --- |
| Bug or small docs/governance fix | PR is allowed |
| New feature or architecture change | Start with an issue, Case, or maintainer discussion |
| Long-tail behavior idea | Community Candidate, not core repo by default |
| Skill / instruction change | Use the skill instruction PR template and evidence proof |
| Refactor-only change | Not accepted unless linked to a fix or maintainer request |
| Test-only change | Must validate a new behavior, new Case, or bug fix in the same PR |
| Question / support | Do not open a PR; use issue only when it is evidence-backed |

External contributors should keep at most 3 open Candidate PRs and at most 1 open code PR at the same time.

## PR Unit

One PR should have one primary purpose, one primary layer, and one review target.

| Layer | Good PR | Avoid |
| --- | --- | --- |
| Semantic Layer | Add or refine ontology, evidence grading, verdict, review contract | Mixing ontology changes with runtime code |
| Execution Layer | Add a minimal script, schema, CLI behavior, or deterministic extraction step | Rewriting governance while changing runtime |
| Governance Layer | Update PR template, issue template, branch rule, checklist, or contribution process | Sneaking product direction changes into template work |

## Required PR Shape

Every PR should explain:

- problem being solved
- why now
- intended outcome
- out-of-scope boundary
- linked issue, Case, or maintainer request
- primary layer and artifact kind
- evidence proof
- tests and validation
- risk and mitigation
- current review state

Use the closest template:

| Template | Use when |
| --- | --- |
| `.github/PULL_REQUEST_TEMPLATE.md` | Default fallback |
| `candidate_submission.md` | Case, Candidate, Artifact, Factor, Pattern, or Negative Pattern |
| `code_change.md` | Runtime, CLI, tooling, or behavior change |
| `schema_change.md` | Ontology, schema, protocol, or compatibility change |
| `skill_instruction_change.md` | `SKILL.md`, skill, prompt, or agent instruction change |

## Evidence Proof

EvoZeus uses evidence proof instead of score or vibe. For external or behavior-changing PRs, tests alone are supplemental. The PR body should include:

```text
Behavior, Case, or issue addressed
Real environment or session tested
Exact steps or command run after this patch
Evidence after change
Observed result after change
What was not tested
Proof limitations or constraints
```

For docs-only PRs, evidence proof can be simple: changed files, rendered Markdown check if relevant, link check, and `git diff --check`.

## Refactor And Test-Only Rules

- Refactor-only PRs need a linked issue, active fix, or maintainer request.
- Test-only PRs should validate a new behavior, a new Case, or a known bug in the same PR.
- Do not open PRs that only reshuffle wording, labels, or files without a reviewable outcome.
- Changelog edits are maintainer-owned unless the PR is explicitly about release notes or governance history.

## Issue Quality

Issues are work items, not chat. Bug reports must include concrete reproduction steps, expected behavior, actual behavior, environment, severity, and redacted evidence. Feature requests must include problem, proposed solution, alternatives, target route, evidence, and expected impact.

If the reporter does not know a field, they should write `NOT_ENOUGH_INFO` instead of guessing.

## AI-Assisted PR Rules

AI-assisted PRs are allowed, but the author must make the assistance visible.

The PR should state:

- which agent or tool materially changed the work
- what the agent did
- which checks were run by a human or local environment
- whether the author understands the changed behavior

If a review bot or reviewer leaves comments, the author owns follow-through: address the issue, reply with rationale, or mark it not applicable with a short explanation.

## Label And Bot Policy

EvoZeus can add labels later for classification, for example:

```text
candidate:needs-evidence
candidate:needs-redaction
candidate:experimental
candidate:reviewed
risk:agent-behavior
risk:privacy
risk:skill-entry
risk:workflow
risk:dependency
triage:blank-template
triage:refactor-only
triage:dirty
```

Bots may request evidence, flag privacy risk, detect blank templates, or warn about cross-layer PRs. Bots must not approve or merge.

## CODEOWNERS And High-Risk Surfaces

High-risk paths need owner review once the maintainer handles or GitHub team names are confirmed:

- `SKILL.md`
- `.github/workflows/`
- `.github/CODEOWNERS`
- `SECURITY.md`
- `docs/governance/privacy-and-redaction.md`
- `docs/reference/ontology.md`
- `docs/reference/evidence-grading.md`
- future schema, redaction, session, upload, or candidate extraction code

Do not add placeholder CODEOWNERS entries that GitHub cannot resolve.

## Pre-PR Checks

Run the lightweight local gate before requesting review:

```bash
python3 scripts/check_pr_ready.py
git diff --check
```

If preparing a PR body locally:

```bash
python3 scripts/check_pr_ready.py --pr-body path/to/pr-body.md
```

For runtime or tooling changes, add the relevant language test command when available. For docs and governance-only changes, `scripts/check_pr_ready.py` and `git diff --check` are the minimum.

## Reviewer Focus

Reviewers should check:

- Is the PR one thing?
- Does it touch one primary layer?
- Does it have evidence proof?
- Does it preserve privacy boundaries?
- Does it explain out-of-scope work?
- Is the current review state clear?
- If rejected, does the rejection reason map to `docs/reference/negative-patterns.md`?
