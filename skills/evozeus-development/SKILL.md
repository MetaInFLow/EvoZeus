---
name: evozeus-development
description: Use when an agent is developing EvoZeus repo infrastructure, docs structure, runtime architecture, templates, ADRs, validation rules, or protocol-facing files.
---

# EvoZeus Development

Use this skill for EvoZeus repo development work. It focuses on infra, docs, runtime boundaries, protocol contracts, and validation.

## When to Use

- Changing docs hub, docs structure, folder declaration, or changelog.
- Adding or updating Design Docs, Implementation Plans, or ADRs.
- Designing TUI, browser companion, doctor, status, or local workspace.
- Changing report types, factor protocol, verdict contract, skill routing, or privacy gates.
- Reviewing whether ordinary users and developers have separate paths.

## Repo Rules

- Default project output is Chinese; key technical terms may stay English.
- Follow `docs/governance/change-scope-policy.md` before changing protected paths.
- Keep root README focused on what the project does.
- Keep design docs out of README.
- Keep ordinary user docs separate from development records.
- Put ADRs under `docs/decisions/`.
- Put downloadable scenario skills under `skills/<skill-name>/SKILL.md`.
- Do not revert unrelated user changes.

## Change Scope Gate

Infra, protocol, governance, skill routing, ADR, GitHub template, and development-rule changes require a linked issue, Design Doc, Implementation Plan, or ADR. Keep Case / Factor / Pattern contributions separate from infra changes unless the infra change is required for that contribution.

## Docs Areas

| Area | Purpose |
| --- | --- |
| `docs/start/` | First-run path and docs directory |
| `docs/judgment/` | Session judgment loop |
| `docs/reports/` | Report types and report reading |
| `docs/factors/` | Factor library and analysis framework |
| `skills/` | Downloadable scenario skills |
| `docs/community/` | Contribution loop and graph assets |
| `docs/runtime/` | TUI, browser companion, doctor, status, workspace |
| `docs/development/` | Developer entry, architecture, workflows |
| `docs/reference/` | Stable protocols, schemas, templates |

## Development Records

| Record | Location | Use When |
| --- | --- | --- |
| Design Doc | `docs/design/{backlog,active,done}/` | Product intent, architecture, user flow, scope |
| Implementation Plan | `docs/plans/` | File map, slices, validation order |
| ADR | `docs/decisions/` | Important default, architecture, safety, protocol, or runtime decision |
| Skill Package | `skills/<skill-name>/SKILL.md` | Downloadable scenario behavior |

## Templates

### Design Doc

```text
# Design Doc: <topic>

- Status:
- Owner:
- Last updated:
- Linked ADR(s):

## Problem
## Scope
## Default User Mode
## Roles
## Workflows
## Data / Artifact Boundaries
## Privacy and Authorization Gates
## Acceptance Criteria
```

### Implementation Plan

```text
# Implementation Plan: <topic>

- Status:
- Source Design Doc:
- Last updated:

## File Map
## Vertical Slices
## Validation Gates
## Rollback Plan
```

### ADR

```text
# ADR-000X: <decision>

- Status:
- Date:
- Deciders:

## Context
## Options Considered
## Decision
## Consequences
## Validation
```

## Validation

- Run Markdown link checks across `docs/**/*.md`, `skills/**/*.md`, `README.md`, `SKILL.md`, and `VISION.md`.
- Run `git diff --check`.
- Scan removed route names and current wording policy.
- Confirm public docs do not include raw private session data.
