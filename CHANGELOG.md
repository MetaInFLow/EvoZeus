# Changelog

## [v0.2.0] - 2026-07-26

### Added

- Stable/UAT runtime state isolation through `EVOZEUS_RUNTIME_STATE_ROOT`.
- Explicit official Session Signal repo resolution through CLI or `EVOZEUS_OFFICIAL_REPO_ROOT`.
- CoEvolve `external-sidecar` attachment runtime and compatible contract loader.

### Changed

- Removed sibling-directory guessing from the user runtime path.
- Extended the CoEvolve contract compatibility gate to Runtime `0.2.x`.

### Verification

- `EVOZEUS_OFFICIAL_REPO_ROOT=<checkout> PYTHONPATH=src python -m pytest -q` (88 passed, 4 optional GraphQLite checks skipped).
