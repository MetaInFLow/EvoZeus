---
name: evozeus-install-registration
description: Use when registering the user-level EvoZeus home, installing the single active EvoZeus plugin for Codex or Claude Code, aligning Stable/UAT, or reconciling an existing installation.
---

# EvoZeus-Install Registration

This skill owns the install-first path from `https://evozeus-community.vercel.app/skill`. The local Agent asks before writes, installs or restores `~/.evozeus`, then aligns the verified product channel with one active `evozeus` plugin in Codex, Claude Code, or both. It stops before judgment, session access, target Repo writes, or GitHub publication.

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
  -> Step 0: inspect the local CLI and state before Release resolution
  -> run direct version + Doctor and a Stable HEAD when an installed CLI exists
  -> choose exactly one local state and stop on unknown evidence
  -> run the read-only pre-fetch gate for a fresh candidate
  -> fetch and verify the minimal checker, then run the full Stable preflight
  -> resolve the latest immutable EvoZeus Stable Release assets and checksum only when the state is not_installed
  -> explain registration value, privacy boundaries, and approval choices
  -> ask before identity writes, network registration, source writes, or user-home writes
  -> run installer with verified Release tag, commit, and archive SHA-256
  -> install bootstrap skeleton and ~/.evozeus/bin/evozeus
  -> create update-policy.json with Stable/UAT automatic checks enabled
  -> detect Codex / Claude Code hosts
  -> run evozeus align --channel stable --host auto --approve-write using the Stable product manifest
  -> verify Runtime and the single active plugin use the same channel and Commit
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
| `not_installed` | Ask before fresh Stable installation; this is the only state accepted by the bootstrap installer |
| `healthy_current` | Report a strict no-op with zero product download, write, or Plugin registration |
| `update_available` | Use the installed update / align route and request its approval separately |
| `repair_required` | Preserve the current root and rollback evidence; dry-run `align`, then rematerialize the same verified manifest in a new root after approval |
| `legacy_migration_required` | Use the migration route; do not call the fresh installer |
| `unknown_or_unverifiable` | Stop and identify the missing local version, Doctor, manifest, or channel evidence |

## Mandatory Step 0 and Preflight

Read `../../../docs/reference/install-preflight.md` completely before installation work.

Before any Release resolution or asset GET, inspect `EVOZEUS_HOME` (default `~/.evozeus`), `bin/evozeus`, `active-channel.json`, `channel-state.json`, and legacy install markers.

When `~/.evozeus/bin/evozeus` exists, bypass automatic refresh and activity feedback while collecting direct local evidence:

```bash
EVOZEUS_AUTO_UPDATE=0 EVOZEUS_AUTO_UPDATE_CHILD=1 ~/.evozeus/bin/evozeus version --json
EVOZEUS_AUTO_UPDATE=0 EVOZEUS_AUTO_UPDATE_CHILD=1 ~/.evozeus/bin/evozeus doctor --json
```

Resolve the latest Stable tag with a payload-free HEAD and compare semantic versions. A healthy current result ends here. Missing install or update dependencies do not change that no-op into a repair or install attempt.

For `repair_required`, run the installed channel command without approval first:

```bash
~/.evozeus/bin/evozeus align --channel <stable|uat> --host auto --manifest <verified-channel-manifest> --json
```

The plan must report `decision=repair` and `writes_now=false`. After explicit approval, rerun with `--approve-write`. Repair downloads or checks out the same verified component versions into a new isolated root, validates required paths, fixed smoke checks, embedded components, compatibility, current-link binding, and dispatcher state, then atomically switches channel state. Before manifest fetch, the plan rejects symlinked or non-directory write prefixes for channel storage, the UAT Git cache, skeleton scripts, hooks, channel runtime state, and migration backups. Bootstrap refresh stages a complete scripts directory, preserves non-bootstrap files, and swaps it atomically. The prior root remains as rollback evidence. Run Doctor after the switch.

`decision=unsafe_stop` is final for that attempt. Invalid persisted JSON/schema, out-of-home roots, unsafe previous roots, and symlinked control/component evidence must stop before manifest fetch or write. Collect trusted local evidence before retrying.

For a fresh candidate, run the public inline pre-fetch gate before any checker or product asset GET. A blocked gate must report zero GETs and zero writes. A passing gate allows only these bootstrap downloads:

- `evozeus-install-preflight.mjs`
- `evozeus-install-preflight.mjs.sha256`

Call both transfers checker downloads, count them in the full report, and verify the checker SHA-256 before execution. Then run:

```bash
/bin/sh evozeus-install-preflight.mjs --evozeus-home "${EVOZEUS_HOME:-$HOME/.evozeus}" --channel stable --checker-asset-get-count 2 --json
```

Preflight v1 supports Stable only. UAT remains available through the installed channel workflow after Stable is healthy. Do not substitute the Stable Release HEAD for the UAT manifest source.

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
| `~/.evozeus/update-policy.json` | automatic update enablement, one-hour interval, and per-channel subscriptions |
| `~/.evozeus/skeleton/` | local copy of the EvoZeus root `SKILL.md`, scenario skills, reference docs, and install / doctor scripts |
| `~/.evozeus/bin/evozeus` | local CLI shim for capability discovery and approved P0 operations |
| `~/.evozeus/releases/stable/` | immutable Stable component archives selected by the product manifest |
| `~/.evozeus/channel-state.json` | Stable/UAT installed manifests and rollback pointers |
| `~/.evozeus/active-channel.json` | active Stable or single UAT selection |
| `~/.evozeus/hosts/` | generated Codex/Claude marketplace, the one active plugin bundle, and alignment evidence |

The approved alignment may also ask the detected host CLI to register its local EvoZeus marketplace and reinstall plugin id `evozeus`. Do not create `evozeus-uat`, `evozeus-stable`, or a second user-visible UAT plugin.

The first approved installation also enables future verified automatic updates inside the active channel. Explain this before approval. Stable follows the latest immutable Release; UAT follows the single mutable `uat/current`. Automatic updates never switch channels, publish repositories, or upload user data. The user may disable or configure the behavior in `~/.evozeus/update-policy.json`.

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
printf '%s\n' "<fresh-full-preflight-json>" | node scripts/evozeus-install.mjs --workspace "<target-workspace>" --source-root "<verified-release>/EvoZeus-vX.Y.Z" --release-tag "vX.Y.Z" --release-commit "<40-hex-release-commit>" --release-archive-sha256 "<verified-archive-sha256>" --preflight-stdin --approve-write
~/.evozeus/bin/evozeus align --channel stable --host auto --manifest "<verified-release>/evozeus-product-stable.json" --approve-write --json
```

Without approval, run a dry-run first:

```bash
printf '%s\n' "<fresh-full-preflight-json>" | node scripts/evozeus-install.mjs --workspace "<target-workspace>" --source-root "<verified-release>/EvoZeus-vX.Y.Z" --release-tag "vX.Y.Z" --release-commit "<40-hex-release-commit>" --release-archive-sha256 "<verified-archive-sha256>" --preflight-stdin
```

The dry-run must not write `~/.evozeus/`; it only reports planned files and the approval needed. It still requires the same full fresh preflight and must not plan reconciliation for an existing installation.

The approved installer rejects preliminary, stale, blocked, wrong-target, wrong-channel, non-fresh, or wrong-next-action preflight reports. Rerun the full checker when the report is more than one hour old or the target changes.

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

Doctor must report `ready` or `ready_after_new_session`. When a new session is required, tell the user to open one before testing EvoZeus discovery; do not claim the current chat reloaded the plugin.

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
| Align or update EvoZeus | Dry-run plan available through `evozeus align --channel <stable|uat> --host auto --json`; one approved transaction aligns Runtime and the active plugin |
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
