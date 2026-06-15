---
name: evozeus-community-contribution
description: Use when an agent is preparing EvoZeus community contributions from local Cases, Rules, Factors, Golden Cases, reports, or scenario-rule graph assets.
---

# EvoZeus Community Contribution

Use this skill for community contribution preparation.

## When to Use

- Turning local evidence into a public Case.
- Drafting Scenario + Rule proposals.
- Preparing Factor or Golden Case contributions.
- Reviewing whether a contribution has enough evidence.
- Choosing issue or PR path after user approval.

## Contribution Chain

```text
Local Evidence Report
-> Agent Review
-> Case Draft
-> User Approval
-> Issue / PR
-> Community Review
-> Accepted Artifact
```

## Required Checks

- Scenario is explicit.
- Evidence is concrete and redacted.
- Proposed verdict is clear.
- Privacy note is present.
- User has approved public contribution.
- Change scope follows `docs/governance/change-scope-policy.md`.

## Scope Gate

Pair Contribution only changes graph fragment assets: `cases/**`, `factors/**`, `patterns/**`, `examples/cases/**`, or `examples/reports/**`. Do not change infra, protocol, governance, skill routing, ADRs, GitHub templates, or development rules in the same PR.

## Graph Shape

```text
Scenario
-> Rule
-> Factor
-> Persona Signal
-> Domain Signal
-> Golden Case
```
