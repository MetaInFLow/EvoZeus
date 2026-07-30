---
name: maintain-evozeus
description: Use when the user asks to install EvoZeus, align all local components, check versions, switch between stable and the single UAT, update, run Doctor, rollback, promote UAT, or diagnose an old installation.
---

# Maintain EvoZeus

## User model

- `stable`: formal, immutable release.
- `uat`: one mutable test candidate. A UAT bug fix replaces this candidate.
- `development`: maintainer worktree or branch; never presented as a user release.

Runtime and Session Signal are built into EvoZeus and share its version. CoEvolve is the only optional independent component with its own version and Harness.

## One-command alignment

Prefer one product operation that resolves the selected channel, verifies all managed paths, updates transactionally, runs Doctor, and switches the active pointer only after checks pass. Do not require users to update repositories manually.

Before writes, report:

```text
🧭 EvoZeus · 版本状态｜当前 <channel/version> → 目标 <channel/version>
```

Ask for approval for installation, update, channel switch, rollback, or managed file replacement. Read-only `version`, `status`, and Doctor checks can run directly.

## Promotion

Only an authorized release administrator may promote the single verified UAT Commit to stable. Promotion must not rebuild different source code.

## Historical installations

An old Skill invocation may perform a read-only compatibility check and explain the upgrade. It must not auto-upgrade stable files merely because the Skill was run. User-requested update and in-run repair remain distinct actions.

## Verification target

- Active channel and exact Commit are visible.
- Stable and UAT paths remain isolated.
- UAT repair leaves one user-visible UAT.
- Doctor passes after alignment.
- Rollback target remains available.
- No internal Web deployment appears as a local product component.

