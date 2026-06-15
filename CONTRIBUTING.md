# Contributing to EvoZeus

EvoZeus is built through Cases.

A Case is not a vague idea. It is a session-derived finding with evidence, a proposed verdict, and a clear reason it should enter or change the library.

## What to Contribute

| Type | Where it goes | Use when |
| --- | --- | --- |
| Case | `cases/` or GitHub issue | A real session exposed a reusable judgment |
| Factor | `factors/` | A judgment rule should be reusable |
| Pattern | `patterns/` | A behavior pattern should be preserved, fixed, or rejected |
| Report template | `docs/reference/report-templates.md` or `examples/reports/` | A better review surface is needed |
| Privacy improvement | `docs/governance/privacy-and-redaction.md` or `SECURITY.md` | The contribution flow needs stronger safety |

## Case Requirements

Every Case must include:

- Session context: what kind of Agent task was running
- Evidence: command output, tool trace, diff, error, conversation excerpt, or report excerpt
- Proposed verdict: one of the verdicts in [docs/reference/verdicts.md](docs/reference/verdicts.md)
- Why it matters: how this helps future Agent sessions
- Privacy note: what was removed or generalized

Do not submit raw sessions, private code, customer data, secrets, tokens, private paths, or unreleased business context.

## Contribution Flow

1. Open a Case issue using the Case template, or add a local file under `examples/cases/`.
2. Maintainers and contributors review the evidence.
3. The Case receives a verdict.
4. Accepted Cases move into the relevant library area: `cases/`, `factors/`, `patterns/`, or docs.
5. Rejected Cases can still be valuable if they document token-wasting or quality-lowering behavior.

## Verdict Review Gates

| Gate | Question |
| --- | --- |
| Ontology Gate | Is this a Case, Candidate, or Artifact, and does it have one primary kind? |
| Evidence Gate | Is the claim backed by concrete session evidence? |
| Privacy Gate | Can this be public without leaking sensitive data? |
| Value Gate | Can another agent or user benefit from it? |
| Operational Gate | Is the recommended action executable? |
| Negative Gate | Does it match a documented rejection reason? |

Detailed review rules live in:

- [Ontology Layer](docs/reference/ontology.md)
- [Evidence Grading](docs/reference/evidence-grading.md)
- [Negative Patterns](docs/reference/negative-patterns.md)
- [Review Contract](docs/reference/review-contract.md)
- [Minimal Loop](docs/reference/minimal-loop.md)

## Pull Requests

PRs should be small and reviewable.

Each PR should have one primary purpose, one primary layer, and one review target. Use [PR Guidelines](docs/governance/pr-guidelines.md) for the full contract.

External contributors should keep at most 3 open Candidate PRs and at most 1 open code PR at the same time. If a coordinated change needs more, discuss the plan with maintainers before opening more PRs.

Good PRs usually do one of these:

- Add one Case with evidence.
- Add or revise one Factor.
- Add one report template.
- Improve privacy or contribution rules.
- Improve README or onboarding without changing the whole project direction.

Avoid:

- New feature or architecture PRs without an issue, Case, or maintainer request.
- Refactor-only PRs without a linked issue, active fix, or maintainer request.
- Test-only PRs that do not validate a new behavior, new Case, or bug fix in the same PR.
- Mixed PRs that combine runtime code, governance, docs, and community Case contribution.
- Changelog edits unless the PR is explicitly about release notes or governance history.

External or behavior-changing PRs must include EvoZeus Evidence Proof in the PR body. Unit tests, mocks, lint, type checks, and CI are useful but supplemental; reviewers need evidence from the changed behavior, session, command, rendered document, or local environment.

AI-assisted PRs are welcome when disclosed. Say which agent or tool materially changed the work, what it did, and which checks were run locally.

Before opening a PR:

```bash
python3 scripts/check_pr_ready.py
git diff --check
```

Use the closest PR template:

- `candidate_submission.md` for Case / Candidate / Artifact contribution.
- `code_change.md` for runtime, CLI, tooling, or behavior changes.
- `schema_change.md` for ontology, schema, protocol, or compatibility changes.
- `skill_instruction_change.md` for `SKILL.md` or agent instruction changes.

If your PR adds markdown examples, check that links are relative and do not point to local private paths.

Authors own review follow-through. Address reviewer or bot comments, reply with rationale, or mark the concern not applicable with a short explanation.
