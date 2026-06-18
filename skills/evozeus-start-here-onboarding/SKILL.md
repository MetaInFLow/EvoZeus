---
name: evozeus-start-here-onboarding
description: Use when a user has completed EvoZeus registration and install, then starts protocol-only EvoZeus judgment for the first time.
---

# EvoZeus Start Here Onboarding

Start Here is the first protocol-only judgment after registration and install. It does not register the workspace, install skills, silently install runtime, scan files, write local state, or create GitHub artifacts.

## Entry Flow

```text
community /skill
  -> EvoZeus-Install Registration completes
  -> user approves protocol-only judgment
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
| install, registration, `.evozeus` reconciliation, missing skills | `../evozeus-install-registration/SKILL.md` |
| local scan, runtime, default official factors, report generation | `../evozeus-runtime-routing/SKILL.md` |
| preserve this result, create Case/Candidate/Artifact | `../evozeus-artifact-preservation/SKILL.md` |
| public issue, PR, example, or contribution | `../evozeus-redaction/SKILL.md` then `../evozeus-community-contribution/SKILL.md` |
| repository docs, governance, schema, or Skill edits | `../evozeus-development/SKILL.md` |

## Boundaries

- Do not write `.evozeus/` state during onboarding.
- Do not install EvoZeus skeleton or skills during onboarding.
- Do not install or enable default factors without user approval.
- Do not create GitHub issues or PRs without user approval.
- Do not turn onboarding into runtime implementation work.
