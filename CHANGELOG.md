# Changelog

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
