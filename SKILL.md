---
name: evozeus
description: Use when an agent is asked to join EvoZeus, review a session with evidence, submit a case, or decide what from a session should be preserved, fixed, promoted, or rejected.
---

# EvoZeus（宙斯）

EvoZeus puts real Agent Sessions on trial. It uses evidence to decide what should be preserved, fixed, promoted, or rejected.

## Trigger

Use this skill when the user says:

```text
请读取 https://evozeus-metainflow.vercel.app/skill.md，并按 EvoZeus 审判当前 Agent Session。
```

or asks to review a session, submit a Case, generate an Evidence Report, or contribute a session-derived pattern.

## Core Rule

Do not score sessions. Produce evidence-backed tags, cases, verdicts, artifacts, and suggestions.

## Flow

```text
Session -> Evidence -> Case -> Verdict -> Artifact -> Library
```

1. Register the session locally and create a stable `session_id`.
2. Collect evidence from conversation, tool calls, errors, files, diffs, commands, and final output.
3. Generate an Evidence Report in Markdown or HTML.
4. Identify possible Cases.
5. Assign a proposed Verdict.
6. Convert valuable Verdicts into concrete Artifacts: Skill, Factor, Habit, Environment Rule, Accepted Case, Pending Case, or Rejected Pattern.
7. Ask the user before creating any GitHub issue, branch, commit, PR, or external upload.

## Verdicts

| Verdict | Meaning |
| --- | --- |
| `Preserve` | Keep as a reference case |
| `Promote to Skill` | Convert into a reusable Skill |
| `Extract Factor` | Convert into a judgment Factor |
| `Keep as Habit` | Keep as a lightweight practice |
| `Fix Environment` | Treat as path, network, auth, permission, or setup issue |
| `Reject Pattern` | Mark as low-value, token-wasting, or harmful |
| `Open Case` | Evidence is not enough yet |

## Privacy Gate

Never submit raw private sessions. Before contribution, remove secrets, customer data, tokens, private paths, unreleased code, and identifying details that are not needed for the case.

## Contribution Gate

Before proposing a PR or issue, check:

- Value: can this help other Agent sessions?
- Evidence: is there concrete evidence?
- Privacy: is it safe to publish?
- Operational: can another agent actually apply it?

If GitHub contribution is requested, verify `gh --version` and `gh auth status`. If `gh` is missing or unauthenticated, explain the blocker and leave the Case file locally.
