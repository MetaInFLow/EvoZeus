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
