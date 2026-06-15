# Folder Declaration v0

- Status: active
- Last updated: 2026-06-15

## Root Files

| Path | Responsibility |
| --- | --- |
| `README.md` | Project entry, current surface, contribution path |
| `VISION.md` | Project philosophy, value function thesis, community graph direction |
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
| `skills/` | Scenario-based downloadable skill packages; each package owns `skills/<skill-id>/SKILL.md` |
| `examples/` | Redacted examples for Cases and reports |
| `docs/` | Project documentation |
| `docs/start/` | First-run paths, step-by-step guides, and docs directory |
| `docs/judgment/` | Session judgment loop, Cases, Verdicts, and Artifacts |
| `docs/reports/` | Report types, report reading paths, and report-to-action decisions |
| `docs/factors/` | Factor library, analysis framework, and factor runtime docs |
| `docs/community/` | Contribution loop, rule graph, Golden Cases, and history |
| `docs/runtime/` | TUI, browser companion, doctor, status, and local workspace |
| `docs/concepts/` | Project concepts, scope map, and explanatory concept docs |
| `docs/glossary/` | Short term definitions, aliases, states, and links |
| `docs/development/` | Developer entry, architecture, and workflow scenarios |
| `docs/decisions/` | ADRs and architecture decision history for developers |
| `docs/design/` | Design docs for product intent, architecture boundaries, roles, and workflows |
| `docs/plans/` | Implementation plans, file maps, slices, validation gates, and rollback plans |
| `docs/reference/` | Stable protocols, schemas, templates, and contracts |
| `docs/governance/` | Privacy, terminology, folder ownership, change scope, and changelog |
| `docs/help/` | Troubleshooting, FAQ, and common support paths |

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
- Contributor write scope is governed by [Change Scope Policy](change-scope-policy.md).
