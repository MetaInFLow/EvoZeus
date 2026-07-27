# Changelog

## [Unreleased]

### Fixed

- UAT overwrite and explicit channel activation now reconcile a missing, legacy, or version-mismatched CoEvolve dispatcher with the active channel.
- Dispatcher repair preserves the previous verified UAT and creates a restorable backup before replacing existing Hook state.

### Verification

- Channel regressions cover repairing a stale dispatcher through both UAT overwrite and `channel use uat` without creating a second UAT.

## [v0.3.4] - 2026-07-26

### Fixed

- Stable and UAT updates now recover an unreferenced partial install left by an interrupted process.
- Recovery remains limited to the deterministic target root and never removes the current or rollback installation.

### Verification

- Channel transaction regression covers retrying an interrupted Stable installation.
- Full Core CLI, installer, Doctor, channel transaction and GitHub governance suites pass.

## [v0.3.3] - 2026-07-26

### Fixed

- `evozeus coevolve status` now executes the installed CoEvolve diagnosis and reports its canonical Harness result.
- Harness attach plans use `.evozeus-wrapper/` as the current layout while retaining both legacy layout names for migration guidance.
- Core no longer treats the removed `.evozeus_evoinfra/wrapper.json` path as the source of truth.

### Verification

- Regression tests prove the current manifest is detected through the CoEvolve contract and the backend is executed during status checks.
- Full Core CLI, installer, Doctor, channel transaction and GitHub governance suites pass.

## [v0.3.2] - 2026-07-26

### Fixed

- A previously verified UAT root can be selected again when the single `uat/current` manifest points back to it.
- Reused UAT roots are checked for exact commits, local changes, required files, smoke health, and compatibility before the atomic switch.
- Failed reuse keeps the current verified UAT and its rollback path unchanged.

### Verification

- Channel transaction regression covers UAT A → B → A reuse without creating another user-visible UAT.

## [v0.3.1] - 2026-07-26

### Fixed

- Release bootstrap installs now record the verified Release tag, exact commit, archive SHA-256, and `release_archive` material type instead of being misidentified as a local source checkout.
- Partial or malformed Release provenance flags fail before any local writes.

### Verification

- Installer regression tests cover verified Release metadata and invalid incomplete metadata.

## [v0.3.0] - 2026-07-26

### Added

- Stable and single-UAT product channel manifests.
- `version`, `channel status/use/rollback`, channel-aware `update` and truthful Doctor output.
- Immutable Stable Release installation and exact-commit UAT worktree transactions.
- UAT run-time auto-refresh with previous-version continuation on failure.
- Stable/UAT Runtime state isolation and channel-marked CLI/CoEvolve Hook output.
- Legacy local-install and CoEvolve dispatcher backup/migration.

### Verification

- Core CLI, installer, Doctor, channel transaction and GitHub governance suites.
- Stable/UAT install, overwrite, idempotency, smoke failure, compatibility failure, rollback and Legacy migration cases.
