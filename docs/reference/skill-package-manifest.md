# Skill Package Manifest

- Status: draft
- Last updated: 2026-06-15

Skill package manifest describes a downloadable EvoZeus skill before installation.

## Package Layout

Each downloadable skill package uses this layout:

```text
skills/
  <skill-id>/
    SKILL.md
    supporting-file.*
```

Do not place standalone skill markdown files directly under `skills/`.

## Required Fields

| Field | Meaning |
| --- | --- |
| `id` | Stable package id |
| `version` | Package version |
| `status` | `draft`, `candidate`, `accepted`, `deprecated` |
| `audience` | Human or Agent role |
| `triggers` | Scenarios where the root `SKILL.md` should suggest this package |
| `permissions` | File, network, GitHub, local write, or model-call needs |
| `dependencies` | Required local tools or packages |
| `inputs` | Data the skill expects |
| `outputs` | Artifacts the skill may produce |
| `privacy` | Raw session, PII, secret, and upload behavior |
| `rollback` | How to disable or remove the package |

## Example

```yaml
id: evozeus-development
version: 0.1.0
status: draft
audience:
  - developer-agent
  - maintainer
triggers:
  - developing EvoZeus infra
  - changing docs structure
permissions:
  file_read: required
  file_write: after_user_task_request
  network: not_required
  github: only_after_user_approval
dependencies:
  - git
  - rg
inputs:
  - repo files
  - design docs
  - implementation plans
outputs:
  - docs updates
  - ADR drafts
  - implementation plans
  - validation notes
privacy:
  raw_session_upload: forbidden
  pii_redaction_required: true
rollback:
  - disable skill in local registry
  - remove downloaded package files
```

## Install Rule

The root `SKILL.md` may suggest a package. It must not install one without explicit user approval.
