---
name: evozeus-skill-proposal
description: Use when proposing, changing, promoting, rejecting, or reviewing EvoZeus skills, scenario skills, prompts, or agent-facing instructions.
---

# EvoZeus-Skill Proposal

Skill changes alter agent behavior. Treat them as governance-risk work, not normal docs polish.

## When A Skill Is Justified

Propose a Skill when repeated evidence shows:

- agents fail the same workflow under pressure
- the fix requires judgment, not only a script or regex
- the pattern applies beyond one private session
- the public instruction can be written without leaking private context
- success and rejection criteria are clear

Do not create a Skill for a one-off result, generic advice, or behavior that should be enforced by code.

## Proposal Shape

Include:

- trigger condition
- failure evidence
- desired behavior
- non-goals
- safety boundary
- related ontology terms
- public/private evidence status
- rollback or deprecation path

Use `../../.github/PULL_REQUEST_TEMPLATE/skill_instruction_change.md` when opening a PR.

## Editing Existing Skills

- Keep root `../../SKILL.md` as the stable session judgment entry.
- Put scenario-specific rules under `../`.
- Keep descriptions as trigger conditions only; do not summarize the whole workflow in frontmatter.
- Reuse project terms from `../../docs/governance/terminology-glossary.md`.
- Run `python3 scripts/check_pr_ready.py --base <base-ref>` from repository root before review.
