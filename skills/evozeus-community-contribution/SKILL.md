---
name: evozeus-community-contribution
description: Use when preparing an external EvoZeus contribution, community Candidate, Case, Pattern, Factor, report, issue, or pull request.
---

# EvoZeus Community Contribution

Community contribution is evidence contribution first. It does not grant broad permission to change infra, runtime, governance, PR templates, or development rules.

## Contribution Routes

| Contribution | Allowed route |
| --- | --- |
| Session-derived Case | Issue or Candidate PR with redacted evidence |
| Candidate Pattern, Habit, Factor, or Environment Rule | Candidate PR |
| Small docs fix | Docs PR |
| Runtime or infra change | Maintainer-discussed code PR |
| Governance, ontology, PR rule, or skill instruction change | Maintainer-discussed governance PR |

External contributors should keep at most 3 open Candidate PRs and at most 1 open code PR.

## Candidate Boundary

A Candidate PR may touch candidate assets and supporting redacted examples. It must not casually change:

- `SKILL.md`
- `skills/`
- `.github/`
- `docs/governance/`
- `docs/reference/ontology.md`
- `docs/reference/evidence-grading.md`
- runtime, upload, redaction, or extraction code

If those files need changes, split a separate governance or code PR.

## Required Evidence

Every Candidate should include:

- source Session or Case context, with private details removed
- concrete Evidence, not only opinion
- proposed Verdict or promotion route
- privacy note
- limitations or uncertainty
- reviewer action requested

Use `../../.github/PULL_REQUEST_TEMPLATE/candidate_submission.md` for Candidate PRs and `../../docs/reference/review-contract.md` for review expectations.

## Rejection Is Normal

Rejected contributions should map to `../../docs/reference/negative-patterns.md`. A rejected Candidate is useful when it clarifies what EvoZeus should not absorb.
