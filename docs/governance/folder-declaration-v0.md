# Folder Declaration v0

- Status: active
- Last updated: 2026-06-18

## Root Files

| Path | Responsibility |
| --- | --- |
| `README.md` | Project entry, current surface, contribution path |
| `SKILL.md` | Agent-readable EvoZeus entry |
| `CONTRIBUTING.md` | Human contribution rules |
| `CODE_OF_CONDUCT.md` | Community behavior and enforcement policy |
| `SECURITY.md` | Security and disclosure policy |
| `ZEUS_STATUS.yml` | Governance automation status, queue limits, and required checks |
| `package.json` | Node dependency and script definitions for GitHub governance gates |
| `package-lock.json` | Locked Node dependency tree for reproducible governance checks |
| `LICENSE` | Project license |

## Directories

| Directory | Responsibility |
| --- | --- |
| `.github/` | Issue and PR templates |
| `assets/` | README and public visual assets |
| `candidates/` | Candidate lifecycle directories: community, reviewed, core, deprecated |
| `cases/` | Case library surface |
| `factors/` | Factor registry pointer and semantic contract; not executable pack or scanner storage |
| `patterns/` | Pattern library surface |
| `examples/` | Redacted examples for Cases and reports |
| `docs/` | Project documentation |
| `schemas/` | JSON schemas for Candidate, Session, and Evidence Report artifacts |
| `skills/` | Agent-readable scenario skills. User-facing local names use `EvoZeus-...`; machine names and folder paths stay lowercase `evozeus-*` |
| `scripts/` | Local repository checks and maintainer utility scripts |

## Important Subdirectories

| Directory | Responsibility |
| --- | --- |
| `.github/workflows/` | GitHub Actions for dry-run governance gates |
| `scripts/github/` | GitHub triage, proof, privacy, queue, schema, and marker comment scripts |
| `docs/rfcs/` | Governance and workflow RFCs |

## External Factor Repos

| Repo | Responsibility |
| --- | --- |
| `evozeus-factor-lab` | Factor pack and scanner module submissions, reviewed/rejected records, and incubation templates |
| `evozeus-session-signal-skill` | Official Factor pack releases, manifests, checksums, SBOM, and attestations |

The main repo remains the public intake and canonical governance surface. It should not host executable Factor pack code or scanner modules directly.

## Planned Runtime Directories

These are local runtime directories and should not be committed when generated:

| Directory | Responsibility |
| --- | --- |
| `.evozeus/` | Local registry, reports, cases, artifacts, cache |
| `.evozeus/sessions/` | Local session metadata |
| `.evozeus/reports/` | Local evidence reports |
| `.evozeus/cache/` | Optional downloaded public library cache |

## Change Rules

- New top-level directories must update this file.
- Runtime output must stay local by default.
- Public examples must be redacted before commit.
