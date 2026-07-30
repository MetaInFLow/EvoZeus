# AGENTS.md

## Package role

- This directory is the built-in EvoZeus Runtime package.
- Product version, Issue, PR, UAT, Release and Harness belong to the EvoZeus Git Repo root.
- This package cannot own `.evozeus-wrapper/` or `.evozeus_evoinfra/`.
- Runtime access to local sessions, files, external commands or network remains explicit and approval-gated.

## Development entry

- Read `SKILL.md` and `README.md` before Runtime changes.
- Run package tests from this directory with `python -m pytest -q`.
- Cross-package Session Signal tests use `../../packs/session-signal`.
- Changes that affect installation, channel resolution or product behavior must also pass the root `npm test` suite.
