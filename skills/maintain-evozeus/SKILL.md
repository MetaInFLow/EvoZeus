---
name: maintain-evozeus
description: Use when the user asks to install EvoZeus, align all local components, check versions, switch between stable and the single UAT, update, run Doctor, rollback, promote UAT, or diagnose an old installation.
---

# Maintain EvoZeus

## User model

- `stable`: formal, immutable release.
- `uat`: one mutable test candidate. A UAT bug fix replaces this candidate.
- `development`: maintainer worktree or branch; never presented as a user release.

Stable and UAT are quality subscriptions. Both check for updates automatically; automatic updates stay inside the selected channel and never switch the user's subscription.

Runtime and Session Signal are built into EvoZeus and share its version. CoEvolve is the only optional independent component with its own version and Harness.

## Install Step 0

For every install, join, restore, or “is EvoZeus installed?” request, read `../../docs/reference/install-preflight.md` and identify local state before Release resolution, product download, approval, or alignment.

1. Inspect `EVOZEUS_HOME` (default `~/.evozeus`), `bin/evozeus`, `active-channel.json`, `channel-state.json`, and legacy markers.
2. When the installed CLI exists, set `EVOZEUS_AUTO_UPDATE=0` and `EVOZEUS_AUTO_UPDATE_CHILD=1`, then run direct `version --json` and `doctor --json` checks before any launcher refresh.
3. Use a payload-free Stable HEAD to distinguish `healthy_current` from `update_available`.
4. Return exactly one state: `not_installed`, `healthy_current`, `update_available`, `repair_required`, `legacy_migration_required`, or `unknown_or_unverifiable`.
5. Stop on unknown evidence. Return a strict zero-download, zero-write, zero-registration no-op for `healthy_current`.
6. Only `not_installed` may enter fresh install. Run the inline pre-fetch gate, verify the standalone checker checksum, then require a schema-valid full Stable preflight before any product asset download or `~/.evozeus` write.

The full preflight command is `evozeus install preflight --channel stable --json` for an installed or trusted local checker. A checker acquired from Release must report its checker and checksum GETs through `--checker-asset-get-count 2`. Preflight v1 rejects UAT; after Stable is healthy, UAT resolves from the installed UAT manifest source and uses the channel alignment flow.

## One-command alignment

Prefer one product operation that resolves the selected channel, verifies all managed paths, updates transactionally, runs Doctor, and switches the active pointer only after checks pass. Do not require users to update repositories manually.

The canonical command is:

```text
evozeus align --channel <stable|uat> --host auto --approve-write --json
```

It must align the Runtime and the single active Codex/Claude plugin together. A failed host registration restores the prior verified channel when a rollback target exists.

Before writes, report:

```text
🧭 EvoZeus · 版本状态｜当前 <channel/version> → 目标 <channel/version>
```

Installation approval creates `~/.evozeus/update-policy.json` and enables verified automatic updates for both channels. Ask separately for channel switches, rollback, policy changes, or unrelated managed-file replacement. Read-only `version`, `status`, and Doctor checks can run directly.

## Automatic update contract

- Check on Claude SessionStart and whenever an EvoZeus or CoEvolve-managed entry runs.
- Use a one-hour freshness window by default to avoid repeated network calls.
- Update EvoZeus Core, the active Plugin, Runtime, Session Signal, and pinned CoEvolve as one transaction.
- Verify the new product before switching the active pointer; restore the previous verified product on failure.
- Show `🧭 EvoZeus · 发现更新`, `🛠️ EvoZeus · 自动更新中`, and one completion or failure marker only when state changes.
- Keep quiet when the installed product is current.
- Respect `enabled`, per-channel flags, and interval in `~/.evozeus/update-policy.json`; rollback after a failed switch is a non-configurable safety invariant.

## Promotion

Only an authorized release administrator may promote the single verified UAT Commit to stable. Promotion must not rebuild different source code.

## Historical installations

An old root Skill routes to `using-evozeus`, whose first action runs the installed launcher. A released bootstrap upgrades itself through the selected product manifest, then refreshes the Plugin and embedded surfaces. Legacy installations that predate the channel launcher report migration guidance until the user completes one approved alignment.

Stable `v0.4.0` and earlier cannot acquire this behavior retroactively because their installed launcher only checks UAT. They require one approved alignment to `v0.4.1+`; every later in-channel update is automatic. An active `v0.4.0` UAT with auto-refresh can bootstrap directly from the overwritten `uat/current` candidate.

## Verification target

- Active channel and exact Commit are visible.
- Stable and UAT paths remain isolated.
- UAT repair leaves one user-visible UAT.
- Doctor passes after alignment.
- Rollback target remains available.
- No internal Web deployment appears as a local product component.
