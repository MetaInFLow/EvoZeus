# Folder Declaration v0

- Status: active
- Last updated: 2026-06-14

## Root Files

| Path | Responsibility |
| --- | --- |
| `README.md` | Project entry, current surface, contribution path |
| `SKILL.md` | Agent-readable EvoZeus entry |
| `CONTRIBUTING.md` | Human contribution rules |
| `SECURITY.md` | Security and disclosure policy |
| `LICENSE` | Project license |

## Directories

| Directory | Responsibility |
| --- | --- |
| `.github/` | Issue and PR templates |
| `assets/` | README and public visual assets |
| `cases/` | Case library surface |
| `factors/` | Factor library surface |
| `patterns/` | Pattern library surface |
| `examples/` | Redacted examples for Cases and reports |
| `docs/` | Project documentation |

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
