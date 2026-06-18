---
name: evozeus-skill-index
description: Use when an agent needs to choose the right EvoZeus scenario skill for registration, install, development, contribution, reporting, runtime routing, redaction, debugging, or skill proposal work.
---

# EvoZeus-Skill Index

This is the scenario router for EvoZeus. The root `SKILL.md` remains the stable zero-install entry for judging a session; this index routes work into narrower skills only when the user asks for a concrete scenario.

## Naming Contract

User-facing local scenario skill names must start with `EvoZeus-`. Machine IDs and folder paths stay lowercase `evozeus-*` to satisfy Codex skill validation.

## Routing

| User intent | Local skill | Read next |
| --- | --- | --- |
| Judge the current Agent Session | `EvoZeus` | root `../../SKILL.md` |
| Register, install, restore, check `.evozeus`, install skeleton, or install skills | `EvoZeus-Install Registration` | `../evozeus-install-registration/SKILL.md` |
| Start first protocol-only judgment after install | `EvoZeus-Start Here Onboarding` | `../evozeus-start-here-onboarding/SKILL.md` |
| Develop this repository, change docs, scripts, templates, or infra | `EvoZeus-Development` | `../evozeus-development/SKILL.md` |
| Submit a Case, Candidate, Factor, Pattern, or community contribution | `EvoZeus-Community Contribution` | `../evozeus-community-contribution/SKILL.md` |
| Preserve a Verdict as a Case, Candidate, Factor, Pattern, Habit, or PR | `EvoZeus-Artifact Preservation` | `../evozeus-artifact-preservation/SKILL.md` |
| Generate or review Evidence Report, Verdict Card, or session summary | `EvoZeus-Reporting` | `../evozeus-reporting/SKILL.md` |
| Enable or route runtime, default official factors consumption, local registry, TUI, browser companion, scanner execution, factor execution, or report execution | `EvoZeus-Runtime Routing` | `../evozeus-runtime-routing/SKILL.md` |
| Author or refine a Factor | `EvoZeus-Factor Authoring` | `../evozeus-factor-authoring/SKILL.md` |
| Author or route executable Factor pack, scanner module, scanner pack, or resolver | `EvoZeus-Scanner Pack Authoring` | `../evozeus-scanner-pack-authoring/SKILL.md` |
| Work on registry pointer, default official factors, manifest reference, checksum, SBOM, attestation, deprecation, or yank | `EvoZeus-Registry Release` | `../evozeus-registry-release/SKILL.md` |
| Prepare public examples, issues, PR evidence, logs, or session excerpts | `EvoZeus-Redaction` | `../evozeus-redaction/SKILL.md` |
| Diagnose failed, blocked, slow, or environment-dependent sessions | `EvoZeus-Doctor Debugging` | `../evozeus-doctor-debugging/SKILL.md` |
| Propose a new skill or change agent instructions | `EvoZeus-Skill Proposal` | `../evozeus-skill-proposal/SKILL.md` |

## Default Order

1. If the user arrives from community `/skill`, read `EvoZeus-Install Registration` first and stop after install report unless the user approves judgment.
2. If the user asks to use EvoZeus after install, start with root `../../SKILL.md`; if this is first use, also read `EvoZeus-Start Here Onboarding`.
3. If the root flow needs local execution or default official factors consumption, read `EvoZeus-Runtime Routing` before enabling runtime.
4. If a Verdict will be preserved, read `EvoZeus-Artifact Preservation` before choosing a repo route.
5. If the user asks to develop the repo, read `EvoZeus-Development` before editing.
6. If public contribution or publication is involved, also read `EvoZeus-Redaction`.
7. If the work changes `SKILL.md`, `skills/`, templates, ontology, evidence grading, privacy, or PR rules, read both `EvoZeus-Development` and `EvoZeus-Skill Proposal`.

## Precedence

| Conflict | Rule |
| --- | --- |
| `/skill` vs judgment | `/skill` goes to `EvoZeus-Install Registration`; judgment only after user approval |
| runtime vs registry release | `EvoZeus-Registry Release` publishes or changes registry pointer; `EvoZeus-Runtime Routing` consumes verified releases |
| reporting vs runtime | `EvoZeus-Reporting` writes report content; runtime routing is only for local execution or generated files |
| doctor vs runtime | `EvoZeus-Doctor Debugging` diagnoses first; runtime routing handles implementation or runtime execution after diagnosis |
| development vs skill proposal | Skill or instruction changes must read both skills |
| preservation vs contribution | Preservation chooses artifact route; public contribution also needs redaction and contribution skills |

## Boundaries

- Scenario skills do not grant permission to upload, install, push, create PRs, or publish private session data.
- Runtime and default official factors require explicit user approval before install, scan, network, or local state changes.
- Raw sessions stay local unless the user explicitly approves a redacted public artifact.
- Community contribution does not allow unrelated infra, governance, CI, or runtime changes.
- Development work follows `../../docs/governance/pr-guidelines.md` and `../../scripts/check_pr_ready.py`.
