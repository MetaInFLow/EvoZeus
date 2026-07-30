---
name: evozeus-artifact-preservation
description: Use when a user wants to preserve, save, publish, or turn a Verdict into a Case, Candidate, Factor, Pattern, Habit, Environment Rule, report, or PR.
---

# EvoZeus Artifact Preservation

Preservation starts only after a judgment exists and the user approves a next action. The goal is to route the artifact to the correct lifecycle, not to push everything into one repo.

## Preservation Flow

```text
Verdict
  -> Artifact candidate
  -> user approval
  -> redaction
  -> route by artifact type
  -> issue / PR / lab submission / runtime PR
```

## Route Table

| Artifact candidate | Route |
| --- | --- |
| Case, Evidence Report, Session Verdict Card | `EvoZeus` issue or Candidate PR |
| Semantic Factor proposal | `EvoZeus` Factor proposal / Candidate PR first |
| Habit, Pattern, Environment Rule | `EvoZeus` Candidate PR |
| Built-in executable Factor | `EvoZeus/packs/session-signal/` |
| Built-in scanner, resolver, Runtime or report execution | `EvoZeus/packages/runtime/` |
| Third-party Factor pack or scanner | Independent extension Repo |
| CLI, plugin, local registry and channel behavior | `EvoZeus` |

## Required Gates

Before public preservation:

1. Apply `../evozeus-redaction/SKILL.md`.
2. Confirm evidence is sufficient for the route.
3. Confirm the user approves the issue, PR, upload, or local file write.
4. Use `../evozeus-community-contribution/SKILL.md` for public contribution.
5. Use `../evozeus-scanner-pack-authoring/SKILL.md` for executable pack or scanner work.

## Boundaries

- Do not publish raw private sessions.
- Built-in executable and Runtime changes require high-risk review in the main Repo.
- Third-party executable extensions require an independent Repo boundary.
- Do not invent reviewed or official status.
