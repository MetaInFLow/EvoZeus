---
name: evozeus-install-registration
description: Use when registering a local EvoZeus workspace, installing the EvoZeus skeleton, installing EvoZeus skills, or reconciling existing .evozeus registration state.
---

# EvoZeus-Install Registration

This skill owns the install-first path from `https://evozeus-community.vercel.app/skill`. It is the agent-readable install skill handoff: the user copies it to a local agent, the agent asks before local writes, then runs the local installer to register or restore the workspace, install the EvoZeus skeleton, install the local EvoZeus CLI, install EvoZeus scenario skills, and stop before judgment, runtime execution, wrapper writes, or GitHub publication.

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
  -> resolve EvoZeus source tree from latest release tag or main fallback
  -> check .evozeus registration state
  -> ask before identity writes, network registration, source writes, or workspace writes
  -> run node scripts/evozeus-install.mjs --workspace <workspace> --approve-write
  -> install or update .evozeus/skeleton and .evozeus/bin/evozeus
  -> output install report
  -> run ./.evozeus/bin/evozeus capabilities --json
  -> ask which EvoZeus capability the user wants
```

## State Reconciliation

| State | Action |
| --- | --- |
| No `.evozeus` | Ask before creating local registration and install manifest |
| `.evozeus` exists but no registration | Try to restore by hash or ask before creating registration |
| Registration exists but skeleton is missing | Install or update root `SKILL.md` and protocol skeleton |
| Registration exists but skills are missing | Install or update `skills/` inventory |
| Registration, skeleton, and skills exist | Report current state and optional update plan |

## Source Material

The installer installs from a resolved EvoZeus source tree. The latest release tag selects the source ref; it does not imply a binary release artifact or package installer.

Report the install material explicitly:

- `local_source_checkout`: use an existing local `MetaInFLow/EvoZeus` checkout that is aligned to the resolved ref.
- `git_checkout`: clone or checkout the resolved ref after user approval.
- `github_source_archive`: download the GitHub source archive after user approval.

If a local checkout is aligned to a release tag, report both the tag and commit. Do not say a release artifact was installed unless an actual release asset was downloaded.

## Allowed Local Files

Only after user approval, the install path may write:

| File | Purpose |
| --- | --- |
| `.evozeus/registration.json` | workspace registration status, registration id, agent identity pointer |
| `.evozeus/install-manifest.json` | skeleton source, resolved commit, installed skills inventory, last checked time |
| `.evozeus/skeleton/` | local copy of the EvoZeus root `SKILL.md`, scenario skills, reference docs, and install / doctor scripts |
| `.evozeus/bin/evozeus` | local CLI shim for capability discovery and approved P0 operations |

Only after user approval, the install path may also create or reuse `~/.evozeus/agent-identity.json` and call the EvoZeus Web registration API. Registration is hash-only and must not upload raw session, private paths, tokens, workspace contents, customer data, or unreleased code.

Do not create `.evozeus/runtime/`, runtime lockfiles, local scan outputs, factor results, report files, GitHub issues, or PRs during install.

## Local Installer

After the user approves local writes, run the installer from the resolved EvoZeus repo:

```bash
node scripts/evozeus-install.mjs --workspace "<target-workspace>" --approve-write
```

Without approval, run a dry-run first:

```bash
node scripts/evozeus-install.mjs --workspace "<target-workspace>"
```

The dry-run must not write `.evozeus/`; it only reports planned files and the approval needed.

## Install Report

After install or reconciliation, output:

```text
Registration status -> Skeleton source -> Skills inventory -> Files written -> Next command -> Approval needed
```

The installer emits this report as JSON so the agent can summarize it without guessing.

After install, run the local capability router before asking for the next approval:

```bash
./.evozeus/bin/evozeus capabilities --json
```

Show a short capability summary before asking the user what to do:

| Capability | Status after health OK |
| --- | --- |
| Analyze Agent Session | Available for explicit user input through `evozeus session analyze --input <path|-> --json`; do not scan local stores by default |
| Attach Co-evolution Harness | Available as a plan through `evozeus harness attach --target <path|url> --json`; do not write repos or GitHub by default |
| Check / Repair EvoZeus | Available through `evozeus doctor --json` |
| Update EvoZeus | Dry-run plan available through `evozeus update --dry-run --json`; writes require approval |
| Uninstall / Archive EvoZeus | Dry-run plan available through `evozeus uninstall --dry-run --json`; deletion requires approval |
| Workspace scan, runtime execution, factor execution on user data, report files, artifact preservation, GitHub issue/PR/public artifact | Not enabled by install; ask for explicit user approval and route to the matching scenario skill first |

The next command should be capability-first:

```text
Run ./.evozeus/bin/evozeus capabilities --json, show the available EvoZeus capabilities, then ask the user which path to take. Do not scan local sessions, write files, or submit to GitHub unless the user explicitly approves the specific action.
```

## Boundaries

- Do not run judgment from `/skill`; ask the user first.
- Do not install or enable runtime, scanner, factor runner, default official factors, MCP, browser companion, or report execution.
- Do not upload raw session, private paths, tokens, customer data, or workspace contents.
- Do not create GitHub Issue, PR, branch, commit, or push without explicit user approval.
- If the user approves runtime later, route through `../evozeus-runtime-routing/SKILL.md`.
