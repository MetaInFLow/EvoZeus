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
| Start from community registration or Start Here onboarding | `EvoZeus-Start Here Onboarding` | `../evozeus-start-here-onboarding/SKILL.md` |
| Develop this repository, change docs, scripts, templates, or infra | `EvoZeus-Development` | `../evozeus-development/SKILL.md` |
| Submit a Case, Candidate, Factor, Pattern, or community contribution | `EvoZeus-Community Contribution` | `../evozeus-community-contribution/SKILL.md` |
| Preserve a Verdict as a Case, Candidate, Factor, Pattern, Habit, or PR | `EvoZeus-Artifact Preservation` | `../evozeus-artifact-preservation/SKILL.md` |
| Generate or review Evidence Report, Verdict Card, or session summary | `EvoZeus-Reporting` | `../evozeus-reporting/SKILL.md` |
| Enable or work on runtime, default official factors, local registry, TUI, doctor, browser companion, scanner execution, or status surface | `EvoZeus-Runtime` | `../evozeus-runtime/SKILL.md` |
| Author or refine a Factor | `EvoZeus-Factor Authoring` | `../evozeus-factor-authoring/SKILL.md` |
| Author or route executable Factor pack, scanner module, scanner pack, or resolver | `EvoZeus-Scanner Pack Authoring` | `../evozeus-scanner-pack-authoring/SKILL.md` |
| Work on registry pointer, default official factors, manifest reference, checksum, SBOM, attestation, deprecation, or yank | `EvoZeus-Registry Release` | `../evozeus-registry-release/SKILL.md` |
| Prepare public examples, issues, PR evidence, logs, or session excerpts | `EvoZeus-Redaction` | `../evozeus-redaction/SKILL.md` |
| Diagnose failed, blocked, slow, or environment-dependent sessions | `EvoZeus-Doctor Debugging` | `../evozeus-doctor-debugging/SKILL.md` |
| Propose a new skill or change agent instructions | `EvoZeus-Skill Proposal` | `../evozeus-skill-proposal/SKILL.md` |

## Default Order

1. If the user asks to use EvoZeus, start with root `../../SKILL.md`; if this came from community registration, also read `EvoZeus-Start Here Onboarding`.
2. If the root flow needs local execution or default official factors, read `EvoZeus-Runtime` before enabling runtime.
3. If a Verdict will be preserved, read `EvoZeus-Artifact Preservation` before choosing a repo route.
4. If the user asks to develop the repo, read `EvoZeus-Development` before editing.
5. If public contribution or publication is involved, also read `EvoZeus-Redaction`.
6. If the work changes `SKILL.md`, `skills/`, templates, ontology, evidence grading, privacy, or PR rules, treat it as governance-risk work.

## Boundaries

- Scenario skills do not grant permission to upload, install, push, create PRs, or publish private session data.
- Runtime and default official factors require explicit user approval before install, scan, network, or local state changes.
- Raw sessions stay local unless the user explicitly approves a redacted public artifact.
- Community contribution does not allow unrelated infra, governance, CI, or runtime changes.
- Development work follows `../../docs/governance/pr-guidelines.md` and `../../scripts/check_pr_ready.py`.
