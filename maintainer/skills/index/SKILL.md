---
name: evozeus-maintainer-skill-index
description: Use when an EvoZeus maintainer needs to route repository development, governance, contribution, Factor, Runtime, release, debugging, redaction, or instruction changes after the user task has already been identified.
---

# EvoZeus maintainer Skill index

This directory is excluded from the default user plugin surface. User tasks begin in [`../../../skills/using-evozeus/SKILL.md`](../../../skills/using-evozeus/SKILL.md).

## Routing

| Maintainer task | Read next |
| --- | --- |
| Repository code, docs, architecture, CI, plugin or product behavior | `../evozeus-development/SKILL.md` |
| User-facing Skill, prompt or instruction changes | `../evozeus-skill-proposal/SKILL.md` plus Development |
| Case, Candidate or public contribution | `../evozeus-community-contribution/SKILL.md` |
| Preserve a confirmed Verdict | `../evozeus-artifact-preservation/SKILL.md` |
| Evidence Report or Verdict Card format | `../evozeus-reporting/SKILL.md` |
| Runtime execution, scanner, local ledger or report generation | `../evozeus-runtime-routing/SKILL.md` |
| Factor semantics | `../evozeus-factor-authoring/SKILL.md` |
| Executable Factor pack or scanner | `../evozeus-scanner-pack-authoring/SKILL.md` |
| Registry, compatibility, deprecation or release metadata | `../evozeus-registry-release/SKILL.md` |
| Public evidence and privacy | `../evozeus-redaction/SKILL.md` |
| Failure or environment diagnosis | `../evozeus-doctor-debugging/SKILL.md` |
| Historical install migration | `../evozeus-install-registration/SKILL.md` |

## Architecture boundaries

- EvoZeus main Repo owns plugin, CLI, Runtime, built-in Session Signal, Stable/UAT and product governance.
- CoEvolve owns the generic evolution contract and Harness SDK for independent Skillware Repos.
- Only an independent Git Repo root can own a Harness.
- `packages/runtime/`, `packs/session-signal/`, `skills/` and `maintainer/skills/` inherit the EvoZeus root Harness.
- Public writes require redaction and user authorization; Harness upgrades additionally require verified target Repo `ADMIN` permission.

## Required checks

Follow [`../../../docs/governance/pr-guidelines.md`](../../../docs/governance/pr-guidelines.md) and run the tests required by the changed surface. Cross-layer migrations use:

```bash
python3 scripts/check_pr_ready.py --allow-cross-layer
npm test
npm run test:python
git diff --check
```
