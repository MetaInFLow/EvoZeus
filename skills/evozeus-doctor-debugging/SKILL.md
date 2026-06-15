---
name: evozeus-doctor-debugging
description: Use when an EvoZeus session, runtime, report, contribution, or agent workflow is failed, blocked, slow, flaky, or environment-dependent.
---

# EvoZeus Doctor Debugging

Doctor work separates environment failure from reasoning failure. Do not turn every failed session into a Skill or Factor.

## Diagnose First

Classify the issue:

| Signal | Likely Verdict |
| --- | --- |
| Missing path, command, auth, permission, network, package, shell, or platform capability | `Fix Environment` |
| Evidence is insufficient or contradictory | `Open Case` |
| Agent repeated a bad workflow despite available evidence | `Reject Pattern` or `Promote to Skill` |
| Runtime output is malformed or non-deterministic | Execution bug |
| Public evidence contains secrets or private data | Redaction failure |

## Evidence To Collect

- command or tool invoked
- exact error text
- changed files or runtime state
- environment assumptions
- expected behavior
- actual behavior
- whether the failure reproduces

Keep raw logs local. If a public issue or PR is needed, apply `../evozeus-redaction/SKILL.md`.

## Boundaries

- Do not install packages, change shell profile, upload logs, edit secrets, or create GitHub issues without user approval.
- Do not classify a path/auth/network issue as a reusable agent skill unless repeated sessions prove a general pattern.
- Do not hide uncertainty. Use `Open Case` when evidence is thin.

## Output Shape

Use this order:

```text
Symptom -> Evidence -> Classification -> Smallest next check -> Proposed Verdict
```
