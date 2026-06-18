---
name: evozeus-install-registration
description: Use when registering a local EvoZeus workspace, installing the EvoZeus skeleton, installing EvoZeus skills, or reconciling existing .evozeus registration state.
---

# EvoZeus-Install Registration

This skill owns the install-first path from `https://evozeus-community.vercel.app/skill`. It registers or restores the local workspace, installs the EvoZeus skeleton, installs EvoZeus scenario skills, and stops before judgment or runtime execution.

## Trigger

Use this skill when the user:

- opens or copies the community `/skill` instruction
- asks to join, install, register, restore, or check EvoZeus
- already has `.evozeus` and wants to know whether the workspace is registered
- needs EvoZeus skeleton and scenario skills installed before running judgment

## Install Flow

```text
community /skill
  -> read this skill
  -> check .evozeus registration state
  -> install or update EvoZeus skeleton
  -> install or update EvoZeus skills
  -> output install report
  -> ask whether to run protocol-only judgment
```

## State Reconciliation

| State | Action |
| --- | --- |
| No `.evozeus` | Ask before creating local registration and install manifest |
| `.evozeus` exists but no registration | Try to restore by hash or ask before creating registration |
| Registration exists but skeleton is missing | Install or update root `SKILL.md` and protocol skeleton |
| Registration exists but skills are missing | Install or update `skills/` inventory |
| Registration, skeleton, and skills exist | Report current state and optional update plan |

## Allowed Local Files

Only after user approval, the install path may write:

| File | Purpose |
| --- | --- |
| `.evozeus/registration.json` | workspace registration status, registration id, agent identity pointer |
| `.evozeus/install-manifest.json` | skeleton source, resolved commit, installed skills inventory, last checked time |

Do not create `.evozeus/runtime/`, runtime lockfiles, local scan outputs, factor results, report files, GitHub issues, or PRs during install.

## Install Report

After install or reconciliation, output:

```text
Registration status -> Skeleton source -> Skills inventory -> Files written -> Next command -> Approval needed
```

The next command should be protocol-only:

```text
Read this repository's SKILL.md and judge the current Agent Session with EvoZeus. First output only a Session Verdict Card. Do not write local files or submit to GitHub.
```

## Boundaries

- Do not run judgment from `/skill`; ask the user first.
- Do not install or enable runtime, scanner, factor runner, default official factors, MCP, browser companion, or report execution.
- Do not upload raw session, private paths, tokens, customer data, or workspace contents.
- Do not create GitHub Issue, PR, branch, commit, or push without explicit user approval.
- If the user approves runtime later, route through `../evozeus-runtime-routing/SKILL.md`.
