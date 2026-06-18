---
name: evozeus-start-here-onboarding
description: Use when a user starts from EvoZeus community registration, copies Start Here, or joins EvoZeus for the first time.
---

# EvoZeus Start Here Onboarding

Start Here activates the EvoZeus skeleton. It does not silently install runtime, scan files, write local state, or create GitHub artifacts.

## Entry Flow

```text
community/#register
  -> copy Start Here
  -> read root SKILL.md
  -> output initial Session Verdict Card
  -> ask before enabling runtime or preserving artifacts
```

## First Pass

On the first pass:

- read root `../../SKILL.md`
- keep raw session local
- produce a Session Verdict Card in the response
- avoid writing files unless the user asks
- avoid runtime, scanner, factor installation, network, GitHub, or external upload

## Optional Next Routes

| User asks for | Read next |
| --- | --- |
| local scan, runtime, default official factors, report generation | `../evozeus-runtime/SKILL.md` |
| preserve this result, create Case/Candidate/Artifact | `../evozeus-artifact-preservation/SKILL.md` |
| public issue, PR, example, or contribution | `../evozeus-redaction/SKILL.md` then `../evozeus-community-contribution/SKILL.md` |
| repository docs, governance, schema, or Skill edits | `../evozeus-development/SKILL.md` |

## Boundaries

- Do not write `.evozeus/` state during onboarding.
- Do not install or enable default factors without user approval.
- Do not create GitHub issues or PRs without user approval.
- Do not turn onboarding into runtime implementation work.
