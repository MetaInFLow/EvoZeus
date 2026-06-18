---
name: evozeus
description: Use when an agent is asked to join EvoZeus, review a session with evidence, submit a case, or decide what from a session should be preserved, fixed, promoted, or rejected.
---

# EvoZeus（宙斯）

EvoZeus puts real Agent Sessions on trial. It uses evidence to decide what should be preserved, fixed, promoted, or rejected.

## Trigger

Use this skill when the user asks for protocol-only EvoZeus judgment, evidence review, Case submission, Evidence Report, or preservation after registration/install is complete.

```text
Read this repository's SKILL.md and judge the current Agent Session with EvoZeus. First output only a Session Verdict Card. Do not write local files or submit to GitHub.
```

If the user starts from `https://evozeus-community.vercel.app/skill`, first read `skills/evozeus-install-registration/SKILL.md`; `/skill` is registration and install guidance, not judgment or runtime execution.

## Scenario Skill Routing

This root skill is the stable zero-install protocol entry. If the user starts from community `/skill`, use `skills/evozeus-install-registration/SKILL.md` first. If registration and install are complete and this is first judgment, read `skills/evozeus-start-here-onboarding/SKILL.md`. If the user asks for repository development, community contribution, runtime routing, redaction, report writing, Factor authoring, debugging, or skill proposal work, read `skills/index/SKILL.md` and then the matching scenario skill before acting.

User-facing local scenario skill names must start with `EvoZeus-`. Keep the frontmatter `name` and folder paths lowercase `evozeus-*` so Codex skill validation and routing continue to work.

Development requests such as changing docs, scripts, templates, PR rules, branch rules, `SKILL.md`, or `skills/` must read `EvoZeus-Development` at `skills/evozeus-development/SKILL.md` first. Changes to `SKILL.md`, `skills/`, prompts, or agent-facing instructions must also read `EvoZeus-Skill Proposal` at `skills/evozeus-skill-proposal/SKILL.md`.

## Core Rule

Do not score sessions. Produce evidence-backed tags, cases, verdicts, artifacts, and suggestions.

## Flow

```text
Session -> Evidence -> Case -> Verdict -> Artifact -> Library
```

1. First pass: do not write files. Produce a Session Verdict Card in the response.
2. Collect evidence from conversation, tool calls, errors, files, diffs, commands, and final output.
3. Identify possible Cases.
4. Assign a proposed Verdict.
5. Convert valuable Verdicts into concrete Artifacts: Skill, Factor, Habit, Environment Rule, Accepted Case, Pending Case, or Rejected Pattern.
6. Ask the user before creating local files, `.evozeus/` state, GitHub issue, branch, commit, PR, runtime scan, install, network access, or external upload.
7. If the user approves runtime, local report generation, scanner execution, factor execution, or default official factors consumption, route to `skills/evozeus-runtime-routing/SKILL.md`.

## User Journey

EvoZeus starts with explicit registration and install, then protocol-only judgment:

```text
community /skill
  -> check .evozeus registration
  -> install EvoZeus skeleton
  -> install EvoZeus skills
  -> ask before running protocol-only judgment
  -> read this SKILL.md
  -> Session Verdict Card
  -> ask before enabling runtime or preservation
  -> runtime uses registry pointer and default official factors
  -> route to the right repo
```

If local execution, default official factors, scanner behavior, report generation, or `.evozeus/runtime/` state are needed, route through `skills/index/SKILL.md` to `skills/evozeus-runtime-routing/SKILL.md` and require user approval before installing or enabling anything.

If the user wants to preserve a judgment, read `skills/evozeus-artifact-preservation/SKILL.md` before choosing the repo route.

Preservation routes:

| Artifact | Route |
| --- | --- |
| Case, Evidence Report, judgment summary | `EvoZeus` issue or Candidate PR |
| Semantic Factor proposal | `EvoZeus` Candidate / Factor proposal first |
| Executable Factor pack or scanner module | `evozeus-factor-lab` |
| Promoted official pack | `evozeus-factors-official` |
| Runtime, infra, CLI, scanner execution, local state | `evozeus-runtime` |

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
