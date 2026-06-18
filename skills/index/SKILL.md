---
name: evozeus-skill-index
description: Use when an agent needs to choose the right EvoZeus scenario skill for development, contribution, reporting, runtime, redaction, debugging, or skill proposal work.
---

# EvoZeus-Skill Index

This is the scenario router for EvoZeus. The root `SKILL.md` remains the stable zero-install entry for judging a session; this index routes work into narrower skills only when the user asks for a concrete scenario.

## Naming Contract

User-facing local scenario skill names must start with `EvoZeus-`. Machine IDs and folder paths stay lowercase `evozeus-*` to satisfy Codex skill validation.

## Routing

| User intent | Local skill | Read next |
| --- | --- | --- |
| Judge the current Agent Session | `EvoZeus` | root `../../SKILL.md` |
| Develop this repository, change docs, scripts, templates, or infra | `EvoZeus-Development` | `../evozeus-development/SKILL.md` |
| Submit a Case, Candidate, Factor, Pattern, or community contribution | `EvoZeus-Community Contribution` | `../evozeus-community-contribution/SKILL.md` |
| Generate or review Evidence Report, Verdict Card, or session summary | `EvoZeus-Reporting` | `../evozeus-reporting/SKILL.md` |
| Work on runtime, local registry, TUI, doctor, browser companion, or status surface | `EvoZeus-Runtime` | `../evozeus-runtime/SKILL.md` |
| Author or refine a Factor | `EvoZeus-Factor Authoring` | `../evozeus-factor-authoring/SKILL.md` |
| Prepare public examples, issues, PR evidence, logs, or session excerpts | `EvoZeus-Redaction` | `../evozeus-redaction/SKILL.md` |
| Diagnose failed, blocked, slow, or environment-dependent sessions | `EvoZeus-Doctor Debugging` | `../evozeus-doctor-debugging/SKILL.md` |
| Propose a new skill or change agent instructions | `EvoZeus-Skill Proposal` | `../evozeus-skill-proposal/SKILL.md` |

## Default Order

1. If the user asks to use EvoZeus, start with root `../../SKILL.md`.
2. If the user asks to develop the repo, read `EvoZeus-Development` before editing.
3. If public contribution or publication is involved, also read `EvoZeus-Redaction`.
4. If the work changes `SKILL.md`, `skills/`, templates, ontology, evidence grading, privacy, or PR rules, treat it as governance-risk work.

## Boundaries

- Scenario skills do not grant permission to upload, install, push, create PRs, or publish private session data.
- Raw sessions stay local unless the user explicitly approves a redacted public artifact.
- Community contribution does not allow unrelated infra, governance, CI, or runtime changes.
- Development work follows `../../docs/governance/pr-guidelines.md` and `../../scripts/check_pr_ready.py`.
