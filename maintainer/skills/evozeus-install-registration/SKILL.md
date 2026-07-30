---
name: evozeus-install-registration
description: Use when registering the user-level EvoZeus home, installing the EvoZeus skeleton, installing EvoZeus skills, or reconciling existing ~/.evozeus registration state.
---

# EvoZeus-Install Registration

This skill owns the install-first path from `https://evozeus-community.vercel.app/skill`. It is the agent-readable install skill handoff: the user copies it to a local agent, the agent asks before local writes, then runs the local installer to register or restore the user-level EvoZeus home at `~/.evozeus`, install the EvoZeus skeleton, install the local EvoZeus CLI, install EvoZeus scenario skills, and stop before judgment, runtime execution, wrapper writes, or GitHub publication.

## Trigger

Use this skill when the user:

- opens or copies the community `/skill` instruction
- asks to join, install, register, restore, or check EvoZeus
- already has `~/.evozeus` and wants to know whether EvoZeus is registered
- needs EvoZeus skeleton and scenario skills installed before running judgment

## Install Flow

```text
community /skill
  -> read this skill
  -> read ../../../docs/reference/install-onboarding-conversation.md
  -> resolve the latest immutable EvoZeus Stable Release assets and checksum
  -> check ~/.evozeus registration state
  -> explain registration value, privacy boundaries, and approval choices
  -> ask before identity writes, network registration, source writes, or user-home writes
  -> run installer with verified Release tag, commit, and archive SHA-256
  -> install bootstrap skeleton and ~/.evozeus/bin/evozeus
  -> run evozeus update --channel stable --approve-write using the Stable product manifest
  -> output install report
  -> run ~/.evozeus/bin/evozeus --help
  -> run ~/.evozeus/bin/evozeus features --json
  -> run ~/.evozeus/bin/evozeus capabilities --json
  -> translate relevant product features into natural language for the user's goal
  -> ask which concrete EvoZeus path the user wants next
```

## State Reconciliation

| State | Action |
| --- | --- |
| No `~/.evozeus` | Ask before creating user-level registration and install manifest |
| `~/.evozeus` exists but no registration | Try to restore by hash or ask before creating registration |
| Registration exists but skeleton is missing | Install or update root `SKILL.md` and protocol skeleton |
| Registration exists but skills are missing | Install or update `skills/` inventory |
| Registration, skeleton, and skills exist | Report current state and optional update plan |

## Source Material

The bootstrap installer must run from the verified custom EvoZeus Release archive. The public path requires the matching `.sha256` asset and `evozeus-product-stable.json`. Do not fall back to `main`, a moving branch, an unreleased commit, or GitHub's automatic source archive.

Report the install material explicitly:

- `release_archive`: verified custom Release asset used for bootstrap and Stable Core installation.
- `product_manifest`: immutable Stable component map with exact commits and SHA-256 values.

An existing checkout may help maintainers inspect code, but it is not a Stable user installation source.

## Allowed Local Files

Only after user approval, the install path may write:

| File | Purpose |
| --- | --- |
| `~/.evozeus/registration.json` | user-level registration status, registration id, agent identity pointer |
| `~/.evozeus/install-manifest.json` | skeleton source, resolved commit, installed skills inventory, last checked time |
| `~/.evozeus/skeleton/` | local copy of the EvoZeus root `SKILL.md`, scenario skills, reference docs, and install / doctor scripts |
| `~/.evozeus/bin/evozeus` | local CLI shim for capability discovery and approved P0 operations |
| `~/.evozeus/releases/stable/` | immutable Stable component archives selected by the product manifest |
| `~/.evozeus/channel-state.json` | Stable/UAT installed manifests and rollback pointers |
| `~/.evozeus/active-channel.json` | active Stable or single UAT selection |

Only after user approval, the install path may also create or reuse `~/.evozeus/agent-identity.json` and call the EvoZeus Web registration API. Registration is hash-only and must not upload raw session, private paths, tokens, workspace contents, customer data, or unreleased code.

Only after separate user approval, local capabilities may send safe activity feedback to the EvoZeus Web activity API. Activity feedback may include runtime hash, agent handle, capability name, event kind, public GitHub target URL when explicitly marked public, and redacted summary. It must not upload raw session, private paths, tokens, workspace contents, customer data, or unreleased code.

Do not create `~/.evozeus/runtime/`, runtime lockfiles, local scan outputs, factor results, report files, GitHub issues, or PRs during install.

## Registration Conversation Reference

Before asking for registration or install approval, read:

```text
../../../docs/reference/install-onboarding-conversation.md
```

Use it to explain:

- joining EvoZeus creates a local user-level identity and capability entry, not a raw session upload
- registration is hash-only and safe metadata only
- local writes go to `~/.evozeus/`
- network registration, activity feedback, scans, reports, and GitHub actions each require explicit approval
- the user can choose dry-run, approved install, or status check

Do not dump internal capability names as the first user-facing explanation. Explain the business function first, then include the exact command when it matters.

The public copy prompt must remain exactly one short handoff sentence:

```text
加入 EvoZeus: https://evozeus-community.vercel.app/skill
```

Do not ask users to copy approval lists, privacy lists, command lists, or capability descriptions. Those details belong in this skill and the conversation reference.

## Local Installer

After the user approves local writes, run the installer from the resolved EvoZeus repo:

```bash
node scripts/evozeus-install.mjs --workspace "<target-workspace>" --source-root "<verified-release>/EvoZeus-vX.Y.Z" --release-tag "vX.Y.Z" --release-commit "<40-hex-release-commit>" --release-archive-sha256 "<verified-archive-sha256>" --approve-write
~/.evozeus/bin/evozeus update --channel stable --manifest "<verified-release>/evozeus-product-stable.json" --approve-write --json
```

Without approval, run a dry-run first:

```bash
node scripts/evozeus-install.mjs --workspace "<target-workspace>" --source-root "<verified-release>/EvoZeus-vX.Y.Z" --release-tag "vX.Y.Z" --release-commit "<40-hex-release-commit>" --release-archive-sha256 "<verified-archive-sha256>"
~/.evozeus/bin/evozeus update --channel stable --manifest "<verified-release>/evozeus-product-stable.json" --dry-run --json
```

The dry-run must not write `~/.evozeus/`; it only reports planned files and the approval needed.

## Install Report

After install or reconciliation, output:

```text
Registration status -> Skeleton source -> Skills inventory -> Files written -> Next command -> Approval needed
```

The installer emits this report as JSON so the agent can summarize it without guessing.

After install, run local help and the product feature router before asking for the next approval:

```bash
~/.evozeus/bin/evozeus --help
~/.evozeus/bin/evozeus version --json
~/.evozeus/bin/evozeus doctor --json
```

Use CLI help as the installed command surface. Then run:

```bash
~/.evozeus/bin/evozeus features --json
```

Use `features --json` as the product menu. Then run:

```bash
~/.evozeus/bin/evozeus capabilities --json
```

Use `capabilities --json` as the source of write mode, risk level, approval, and examples. Show the natural-language feature summary with the fixed `Post-Install Capability Template` from `../../../docs/reference/install-onboarding-conversation.md` before asking the user what to do:

| Product feature | Status after health OK |
| --- | --- |
| Review Agent Session | Available for explicit user input through `evozeus review session --input <path|-> --json`; do not scan local stores by default |
| Generate Session Insights Report | Plan route through `evozeus insights plan --source codex --json`; after separate approval, execute `evozeus-runtime session-insights --workspace "$HOME" --official-repo-root <EvoZeus-session-signal-skill>` from the runtime checkout to generate `.evozeus/runtime/reports/ai-usage-profile/index.html` |
| Preserve Artifact Draft | Available through `evozeus preserve draft --from-report <path> --json`; does not upload or publish |
| Attach Co-evolution Harness | Available as a plan through `evozeus coevolve attach --target <path|url> --json`; do not write repos or GitHub by default |
| Check / Repair EvoZeus | Available through `evozeus doctor --json` |
| Update EvoZeus | Dry-run plan available through `evozeus update --dry-run --json`; writes require approval |
| Uninstall / Archive EvoZeus | Dry-run plan available through `evozeus uninstall --dry-run --json`; deletion requires approval |
| Workspace scan, runtime execution, factor execution on user data, report files, artifact preservation, GitHub issue/PR/public artifact | Not enabled by install; ask for explicit user approval and route to the matching scenario skill first |

The next command should be feature-first:

```text
Run ~/.evozeus/bin/evozeus --help, then run ~/.evozeus/bin/evozeus features --json and ~/.evozeus/bin/evozeus capabilities --json. Translate the available EvoZeus product features into the user's current business goal using the fixed template, recommend one safe next path, and ask the user to choose. Do not scan local sessions, write files, or submit to GitHub unless the user explicitly approves the specific action.
```

## Boundaries

- Do not run judgment from `/skill`; ask the user first.
- Do not install or enable runtime, scanner, factor runner, default official factors, MCP, browser companion, or report execution.
- Do not upload raw session, private paths, tokens, customer data, or workspace contents.
- Do not create GitHub Issue, PR, branch, commit, or push without explicit user approval.
- If the user approves runtime later, route through `../evozeus-runtime-routing/SKILL.md`.
