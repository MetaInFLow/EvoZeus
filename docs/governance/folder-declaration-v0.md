# Folder Declaration v0

- Status: active
- Last updated: 2026-06-16

## Root Files

| Path | Responsibility |
| --- | --- |
| `README.md` | Project entry, current surface, contribution path |
| `SKILL.md` | Agent-readable EvoZeus entry |
| `CONTRIBUTING.md` | Human contribution rules |
| `CODE_OF_CONDUCT.md` | Community behavior and enforcement policy |
| `SECURITY.md` | Security and disclosure policy |
| `ZEUS_STATUS.yml` | Governance automation status, queue limits, and required checks |
| `LICENSE` | Project license |

## Directories

| Directory | Responsibility |
| --- | --- |
| `.github/` | Issue and PR templates |
| `assets/` | README and public visual assets |
| `candidates/` | Candidate lifecycle directories: community, reviewed, core, deprecated |
| `cases/` | Case library surface |
| `factors/` | Factor library surface |
| `patterns/` | Pattern library surface |
| `examples/` | Redacted examples for Cases and reports |
| `docs/` | Project documentation |
| `schemas/` | JSON schemas for Candidate, Session, and Evidence Report artifacts |
| `skills/` | Agent-readable scenario skills for development, contribution, runtime, reporting, redaction, debugging, Factor authoring, and skill proposals |
| `scripts/` | Local repository checks and maintainer utility scripts |

## Important Subdirectories

| Directory | Responsibility |
| --- | --- |
| `.github/workflows/` | GitHub Actions for dry-run governance gates |
| `scripts/github/` | GitHub triage, proof, privacy, queue, schema, and marker comment scripts |
| `docs/rfcs/` | Governance and workflow RFCs |

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
