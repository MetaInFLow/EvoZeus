# AGENTS.md

## Pack role

- This directory is the built-in EvoZeus Session Signal pack.
- Product version, Issue, PR, UAT, Release and Harness belong to the EvoZeus Git Repo root.
- This pack cannot own `.evozeus-wrapper/` or `.evozeus_evoinfra/`.
- Factor signals remain evidence inputs; they do not become automatic Agent scores or automatic public contributions.

## Development entry

- Read `SKILL.md` and `README.md` before changing the signal method, Factor contract, schema or Factor tools.
- Run pack tests from this directory with `python -m pytest -q`.
- Changes that affect Runtime integration, product channels or user output must also pass the root `npm test` suite.
